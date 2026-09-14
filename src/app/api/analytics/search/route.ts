import { isAnonymousSessionId } from "@/lib/analytics/events";
import { getDatabase } from "@/lib/db/client";
import { normalizeQuery } from "@/lib/search/normalize-query";

type SearchEventBody = {
  query?: unknown;
  result_count?: unknown;
  asset_ids?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const anonymousSessionId = request.headers.get("x-anonymous-session-id") ?? "";
  if (!isAnonymousSessionId(anonymousSessionId)) {
    return Response.json({ error: "A valid anonymous session id is required." }, { status: 400 });
  }

  const body = await readBody(request);
  if (!body || typeof body.query !== "string" || body.query.trim().length === 0) {
    return Response.json({ error: "A non-empty query is required." }, { status: 400 });
  }
  if (body.query.length > 120 || !Number.isInteger(body.result_count)) {
    return Response.json({ error: "The search event payload is invalid." }, { status: 400 });
  }
  const resultCount = body.result_count as number;
  if (resultCount < 0 || resultCount > 50 || !Array.isArray(body.asset_ids)) {
    return Response.json({ error: "The search event payload is invalid." }, { status: 400 });
  }
  const assetIds = body.asset_ids;
  if (assetIds.length > 50 || assetIds.some((assetId) => typeof assetId !== "string")) {
    return Response.json({ error: "The search event payload is invalid." }, { status: 400 });
  }

  const queryRaw = body.query;
  const queryNormalized = normalizeQuery(queryRaw);
  if (!queryNormalized) {
    return Response.json({ error: "A non-empty query is required." }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const validIds = await findPublishedAssetIds(db, assetIds as string[]);
    const searchEventId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const statements = [
      db
        .prepare(
          `
            INSERT INTO search_events (
              id,
              anonymous_session_id,
              query_raw,
              query_normalized,
              result_count,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(searchEventId, anonymousSessionId, queryRaw, queryNormalized, resultCount, createdAt),
      ...assetIds
        .map((assetId, index) =>
          validIds.has(assetId)
            ? db
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
                    ) VALUES (?, ?, ?, 'impression', ?, ?, ?)
                  `,
                )
                .bind(
                  crypto.randomUUID(),
                  anonymousSessionId,
                  assetId,
                  searchEventId,
                  index + 1,
                  createdAt,
                )
            : null,
        )
        .filter((statement): statement is Exclude<typeof statement, null> => statement !== null),
    ];
    await db.batch(statements);
    return Response.json({ ok: true, search_event_id: searchEventId });
  } catch {
    return Response.json({ error: "The search event could not be recorded." }, { status: 503 });
  }
}

async function findPublishedAssetIds(db: D1Database, assetIds: string[]): Promise<Set<string>> {
  if (assetIds.length === 0) return new Set();
  const placeholders = assetIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `
        SELECT id
        FROM assets
        WHERE id IN (${placeholders})
          AND status = 'published'
          AND rights_status IN ('safe', 'restricted')
      `,
    )
    .bind(...assetIds)
    .all<{ id: string }>();
  return new Set(result.results.map((row) => row.id));
}

async function readBody(request: Request): Promise<SearchEventBody | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as SearchEventBody) : null;
  } catch {
    return null;
  }
}
