import { canCopyEmbed, type EmbedAsset } from "@/lib/assets/embed";
import { getDatabase } from "@/lib/db/client";

type EmbedAssetRow = EmbedAsset & { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const anonymousSessionId = request.headers.get("x-anonymous-session-id") ?? "";
  if (!isAnonymousSessionId(anonymousSessionId)) {
    return Response.json({ error: "A valid anonymous session id is required." }, { status: 400 });
  }

  const { slug } = await params;
  let asset: EmbedAssetRow | null;
  try {
    asset = await getDatabase()
      .prepare(
        `
          SELECT
            a.id,
            a.source_id,
            a.embed_url,
            a.embed_origin,
            a.rights_json,
            a.rights_status,
            a.title,
            a.attribution_name,
            a.attribution_url,
            s.base_url AS source_base_url
          FROM assets a
          LEFT JOIN sources s ON s.id = a.source_id
          WHERE a.slug = ?
            AND a.status = 'published'
            AND a.rights_status IN ('safe', 'restricted')
          LIMIT 1
        `,
      )
      .bind(slug)
      .first<EmbedAssetRow>();
  } catch {
    return Response.json({ error: "The asset could not be checked." }, { status: 503 });
  }

  if (!asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }
  if (!canCopyEmbed(asset)) {
    return Response.json({ error: "Embed permission is not approved." }, { status: 403 });
  }

  try {
    await getDatabase()
      .prepare(
        `
          INSERT INTO asset_events (
            id,
            anonymous_session_id,
            asset_id,
            event_type,
            search_event_id,
            result_position,
            created_at
          ) VALUES (?, ?, ?, 'embed_copy', NULL, NULL, ?)
        `,
      )
      .bind(crypto.randomUUID(), anonymousSessionId, asset.id, new Date().toISOString())
      .run();
  } catch {
    return Response.json(
      { error: "The embed was copied, but the event could not be recorded." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}

function isAnonymousSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
