import { getDatabase } from "@/lib/db/client";

type CitationAssetRow = {
  id: string;
  citation_text: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const anonymousSessionId = request.headers.get("x-anonymous-session-id") ?? "";
  if (!isAnonymousSessionId(anonymousSessionId)) {
    return Response.json({ error: "A valid anonymous session id is required." }, { status: 400 });
  }

  const { slug } = await params;
  let asset: CitationAssetRow | null;
  try {
    asset = await getDatabase()
      .prepare(
        `
          SELECT a.id, a.citation_text
          FROM assets a
          WHERE a.slug = ?
            AND a.status = 'published'
            AND a.rights_status IN ('safe', 'restricted')
            AND a.citation_text IS NOT NULL
            AND length(trim(a.citation_text)) > 0
          LIMIT 1
        `,
      )
      .bind(slug)
      .first<CitationAssetRow>();
  } catch {
    return Response.json({ error: "The citation could not be checked." }, { status: 503 });
  }

  if (!asset) {
    return Response.json({ error: "Citation not found." }, { status: 404 });
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
          ) VALUES (?, ?, ?, 'citation_copy', NULL, NULL, ?)
        `,
      )
      .bind(crypto.randomUUID(), anonymousSessionId, asset.id, new Date().toISOString())
      .run();
  } catch {
    return Response.json(
      { error: "The citation was copied, but the event could not be recorded." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}

function isAnonymousSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
