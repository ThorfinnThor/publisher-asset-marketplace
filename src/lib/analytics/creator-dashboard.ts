import { normalizeDemandQuery } from "../search/normalize-demand-query";

const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const creatorWindowDays = 28;
const creatorAssetLimit = 100;
const creatorQueryLimit = 3;

type CreatorAssetSqlRow = {
  id: string;
  slug: string;
  title: string;
  asset_type: string;
  status: "published";
  impressions: number | string | null;
  detail_views: number | string | null;
  embed_copies: number | string | null;
  citation_copies: number | string | null;
  source_clicks: number | string | null;
};

type CreatorQuerySqlRow = {
  asset_id: string;
  query_normalized: string;
  impressions: number | string | null;
};

export type CreatorAnalyticsWindow = {
  start: string;
  end: string;
};

export type CreatorAssetAnalytics = {
  id: string;
  slug: string;
  title: string;
  asset_type: string;
  status: "published";
  impressions: number;
  detail_views: number;
  embed_copies: number;
  citation_copies: number;
  source_clicks: number;
  top_discovery_queries: Array<{ query: string; impressions: number }>;
};

export type CreatorDashboardData = {
  window: CreatorAnalyticsWindow;
  assets: CreatorAssetAnalytics[];
};

export const creatorAssetAnalyticsSql = `
  SELECT a.id, a.slug, a.title, a.asset_type, a.status,
    SUM(CASE WHEN ae.event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
    SUM(CASE WHEN ae.event_type = 'detail_view' THEN 1 ELSE 0 END) AS detail_views,
    SUM(CASE WHEN ae.event_type = 'embed_copy' THEN 1 ELSE 0 END) AS embed_copies,
    SUM(CASE WHEN ae.event_type = 'citation_copy' THEN 1 ELSE 0 END) AS citation_copies,
    SUM(CASE WHEN ae.event_type = 'source_click' THEN 1 ELSE 0 END) AS source_clicks
  FROM assets a
  LEFT JOIN asset_events ae
    ON ae.asset_id = a.id
    AND ae.created_at >= ?
    AND ae.created_at < ?
  WHERE a.creator_id = ?
    AND a.status = 'published'
  GROUP BY a.id, a.slug, a.title, a.asset_type, a.status, a.updated_at
  ORDER BY a.updated_at DESC, a.slug ASC
  LIMIT ?
`;

export const creatorDiscoveryQueriesSql = `
  WITH ranked_queries AS (
    SELECT ae.asset_id, se.query_normalized,
      COUNT(*) AS impressions,
      ROW_NUMBER() OVER (
        PARTITION BY ae.asset_id
        ORDER BY COUNT(*) DESC, se.query_normalized ASC
      ) AS query_rank
    FROM asset_events ae
    INNER JOIN search_events se ON se.id = ae.search_event_id
    WHERE ae.event_type = 'impression'
      AND ae.search_event_id IS NOT NULL
      AND ae.created_at >= ?
      AND ae.created_at < ?
      AND ae.asset_id IN (
        SELECT id
        FROM assets
        WHERE creator_id = ?
          AND status = 'published'
      )
    GROUP BY ae.asset_id, se.query_normalized
  )
  SELECT asset_id, query_normalized, impressions
  FROM ranked_queries
  WHERE query_rank <= ?
  ORDER BY asset_id ASC, query_rank ASC
`;

export function completeCreatorAnalyticsWindow(now = new Date()): CreatorAnalyticsWindow {
  if (Number.isNaN(now.getTime())) throw new Error("A valid date is required.");
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - creatorWindowDays * millisecondsPerDay);
  return { start: dateOnly(start), end: dateOnly(end) };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function asInteger(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

export function normalizeCreatorAssetAnalytics(
  assetRows: CreatorAssetSqlRow[],
  queryRows: CreatorQuerySqlRow[],
): CreatorAssetAnalytics[] {
  const queriesByAsset = new Map<string, Map<string, number>>();
  for (const row of queryRows) {
    const normalized = normalizeDemandQuery(row.query_normalized);
    if (!normalized.aggregation_eligible || !normalized.display_query) continue;
    const queries = queriesByAsset.get(row.asset_id) ?? new Map<string, number>();
    queries.set(
      normalized.display_query,
      (queries.get(normalized.display_query) ?? 0) + asInteger(row.impressions),
    );
    queriesByAsset.set(row.asset_id, queries);
  }

  return assetRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    asset_type: row.asset_type,
    status: "published",
    impressions: asInteger(row.impressions),
    detail_views: asInteger(row.detail_views),
    embed_copies: asInteger(row.embed_copies),
    citation_copies: asInteger(row.citation_copies),
    source_clicks: asInteger(row.source_clicks),
    top_discovery_queries: [...(queriesByAsset.get(row.id) ?? new Map()).entries()]
      .map(([query, impressions]) => ({ query, impressions }))
      .sort(
        (left, right) =>
          right.impressions - left.impressions || left.query.localeCompare(right.query),
      )
      .slice(0, creatorQueryLimit),
  }));
}

export async function getCreatorDashboard(
  db: D1Database,
  creatorId: string,
  now = new Date(),
): Promise<CreatorDashboardData> {
  if (!creatorId.trim()) throw new Error("A creator id is required.");
  const window = completeCreatorAnalyticsWindow(now);
  const start = `${window.start}T00:00:00.000Z`;
  const end = `${window.end}T00:00:00.000Z`;
  const reads = await db.batch([
    db.prepare(creatorAssetAnalyticsSql).bind(start, end, creatorId, creatorAssetLimit),
    db.prepare(creatorDiscoveryQueriesSql).bind(start, end, creatorId, creatorQueryLimit),
  ]);
  return {
    window,
    assets: normalizeCreatorAssetAnalytics(
      (reads[0]?.results ?? []) as CreatorAssetSqlRow[],
      (reads[1]?.results ?? []) as CreatorQuerySqlRow[],
    ),
  };
}
