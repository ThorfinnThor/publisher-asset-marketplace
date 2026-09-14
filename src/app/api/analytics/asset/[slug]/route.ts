import {
  isAnonymousSessionId,
  isPublicAssetEventType,
  type PublicAssetEventType,
} from "@/lib/analytics/events";
import { getDatabase } from "@/lib/db/client";

type EventBody = {
  event_type?: unknown;
};

type PublishedAssetRow = {
  id: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const anonymousSessionId = request.headers.get("x-anonymous-session-id") ?? "";
  if (!isAnonymousSessionId(anonymousSessionId)) {
    return Response.json({ error: "A valid anonymous session id is required." }, { status: 400 });
  }

  const body = await readBody(request);
  if (!body || typeof body.event_type !== "string" || !isPublicAssetEventType(body.event_type)) {
    return Response.json({ error: "A valid asset event type is required." }, { status: 400 });
  }

  const { slug } = await params;
  let asset: PublishedAssetRow | null;
  try {
    asset = await getDatabase()
      .prepare(
        `
          SELECT a.id
          FROM assets a
          WHERE a.slug = ?
            AND a.status = 'published'
            AND a.rights_status IN ('safe', 'restricted')
          LIMIT 1
        `,
      )
      .bind(slug)
      .first<PublishedAssetRow>();
  } catch {
    return Response.json({ error: "The asset could not be checked." }, { status: 503 });
  }

  if (!asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  try {
    await recordAssetEvent(asset.id, anonymousSessionId, body.event_type);
  } catch {
    return Response.json({ error: "The event could not be recorded." }, { status: 503 });
  }

  return Response.json({ ok: true });
}

async function recordAssetEvent(
  assetId: string,
  anonymousSessionId: string,
  eventType: PublicAssetEventType,
): Promise<void> {
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
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?)
      `,
    )
    .bind(crypto.randomUUID(), anonymousSessionId, assetId, eventType, new Date().toISOString())
    .run();
}

async function readBody(request: Request): Promise<EventBody | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as EventBody) : null;
  } catch {
    return null;
  }
}
