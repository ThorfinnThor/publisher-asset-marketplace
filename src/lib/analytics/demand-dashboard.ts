import { demandQueryNormalizationVersion } from "../search/normalize-demand-query";
import { opportunityScoreVersion } from "./opportunity-score";

const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const dashboardWindowDays = 28;
const dashboardLimit = 12;

type AggregateSqlRow = {
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  no_result_searches: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
};

type ScoreSqlRow = {
  window_start: string;
  window_end: string;
  scored_at: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  unique_anonymous_sessions: number;
  no_result_searches: number;
  no_result_rate: number;
  safe_asset_count: number | null;
  embeddable_asset_count: number | null;
  opportunity_score: number | null;
  status: "scored" | "insufficient_data" | "unavailable";
};

type CopiedAssetSqlRow = {
  slug: string;
  title: string;
  total_copies: number;
  embed_copies: number;
  citation_copies: number;
};

export type DemandWindow = {
  start: string;
  end: string;
};

export type DemandSummaryRow = {
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  no_result_searches: number;
  no_result_rate: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
};

export type FastestGrowingRow = DemandSummaryRow & {
  previous_searches: number;
  growth_rate: number | null;
};

export type OpportunityDashboardRow = ScoreSqlRow;

export type CopiedAssetRow = CopiedAssetSqlRow;

export type DemandDashboardData = {
  window: DemandWindow;
  previousWindow: DemandWindow;
  snapshotWindowEnd: string | null;
  scoredAt: string | null;
  topSearches: DemandSummaryRow[];
  fastestGrowing: FastestGrowingRow[];
  noResultQueries: OpportunityDashboardRow[];
  lowSupplyTopics: OpportunityDashboardRow[];
  topCopiedAssets: CopiedAssetRow[];
};

export function completeDemandWindows(now = new Date()): {
  window: DemandWindow;
  previousWindow: DemandWindow;
} {
  if (Number.isNaN(now.getTime())) throw new Error("A valid date is required.");
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - dashboardWindowDays * millisecondsPerDay);
  const previousStart = new Date(start.getTime() - dashboardWindowDays * millisecondsPerDay);
  return {
    window: { start: dateOnly(start), end: dateOnly(end) },
    previousWindow: { start: dateOnly(previousStart), end: dateOnly(start) },
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function asSummary(row: AggregateSqlRow): DemandSummaryRow {
  return {
    aggregation_key: row.aggregation_key,
    display_query: row.display_query,
    topic_key: row.topic_key,
    searches: row.searches,
    no_result_searches: row.no_result_searches,
    no_result_rate: row.searches > 0 ? row.no_result_searches / row.searches : 0,
    asset_clicks: row.asset_clicks,
    embed_copies: row.embed_copies,
    citation_copies: row.citation_copies,
  };
}

function rankSummaries(rows: DemandSummaryRow[]): DemandSummaryRow[] {
  return [...rows]
    .sort(
      (left, right) =>
        right.searches - left.searches || left.aggregation_key.localeCompare(right.aggregation_key),
    )
    .slice(0, dashboardLimit);
}

export function compareDemandGrowth(
  current: DemandSummaryRow[],
  previous: DemandSummaryRow[],
): FastestGrowingRow[] {
  const previousByKey = new Map(previous.map((row) => [row.aggregation_key, row]));
  return current
    .map((row) => {
      const previousRow = previousByKey.get(row.aggregation_key);
      const previousSearches = previousRow?.searches ?? 0;
      return {
        ...row,
        previous_searches: previousSearches,
        growth_rate:
          previousSearches > 0 ? (row.searches - previousSearches) / previousSearches : null,
      };
    })
    .filter((row) => row.searches >= 5)
    .sort(
      (left, right) =>
        (right.growth_rate ?? Number.POSITIVE_INFINITY) -
          (left.growth_rate ?? Number.POSITIVE_INFINITY) ||
        right.searches - left.searches ||
        left.aggregation_key.localeCompare(right.aggregation_key),
    )
    .slice(0, dashboardLimit);
}

const aggregateSql = `
  SELECT aggregation_key, display_query, topic_key,
    SUM(searches) AS searches,
    SUM(no_result_searches) AS no_result_searches,
    SUM(asset_clicks) AS asset_clicks,
    SUM(embed_copies) AS embed_copies,
    SUM(citation_copies) AS citation_copies
  FROM demand_daily_aggregates
  WHERE aggregate_date >= ? AND aggregate_date < ?
    AND normalization_version = ?
  GROUP BY aggregation_key, display_query, topic_key
`;

const scoreSql = `
  SELECT window_start, window_end, scored_at, display_query, topic_key,
    searches, unique_anonymous_sessions, no_result_searches, no_result_rate,
    safe_asset_count, embeddable_asset_count, opportunity_score, status
  FROM opportunity_scores
  WHERE window_end = (
    SELECT MAX(window_end)
    FROM opportunity_scores
    WHERE window_end <= ?
      AND normalization_version = ?
      AND score_version = ?
  )
    AND normalization_version = ?
    AND score_version = ?
  ORDER BY opportunity_score DESC, unique_anonymous_sessions DESC, searches DESC,
    aggregation_key ASC
  LIMIT ?
`;

const copiedAssetsSql = `
  SELECT a.slug, a.title,
    COUNT(*) AS total_copies,
    SUM(CASE WHEN ae.event_type = 'embed_copy' THEN 1 ELSE 0 END) AS embed_copies,
    SUM(CASE WHEN ae.event_type = 'citation_copy' THEN 1 ELSE 0 END) AS citation_copies
  FROM asset_events ae
  JOIN assets a ON a.id = ae.asset_id
  WHERE ae.created_at >= ? AND ae.created_at < ?
    AND ae.event_type IN ('embed_copy', 'citation_copy')
  GROUP BY a.id, a.slug, a.title
  ORDER BY total_copies DESC, a.slug ASC
  LIMIT ?
`;

function normalizeScoreRows(rows: ScoreSqlRow[]): OpportunityDashboardRow[] {
  return rows.filter((row) => row.searches > 0);
}

export async function getDemandDashboard(
  db: D1Database,
  now = new Date(),
): Promise<DemandDashboardData> {
  const { window, previousWindow } = completeDemandWindows(now);
  const reads = await db.batch([
    db.prepare(aggregateSql).bind(window.start, window.end, demandQueryNormalizationVersion),
    db
      .prepare(aggregateSql)
      .bind(previousWindow.start, previousWindow.end, demandQueryNormalizationVersion),
    db
      .prepare(scoreSql)
      .bind(
        `${window.end}T00:00:00.000Z`,
        opportunityScoreVersion,
        opportunityScoreVersion,
        demandQueryNormalizationVersion,
        opportunityScoreVersion,
        dashboardLimit * 4,
      ),
    db
      .prepare(copiedAssetsSql)
      .bind(`${window.start}T00:00:00.000Z`, `${window.end}T00:00:00.000Z`, dashboardLimit),
  ]);

  const current = ((reads[0]?.results ?? []) as AggregateSqlRow[]).map(asSummary);
  const previous = ((reads[1]?.results ?? []) as AggregateSqlRow[]).map(asSummary);
  const scores = normalizeScoreRows((reads[2]?.results ?? []) as ScoreSqlRow[]);
  const topSearches = rankSummaries(current);
  const noResultQueries = [...scores]
    .filter((row) => row.searches >= 5)
    .sort(
      (left, right) =>
        right.no_result_rate - left.no_result_rate ||
        right.searches - left.searches ||
        left.display_query.localeCompare(right.display_query),
    )
    .slice(0, dashboardLimit);
  const lowSupplyTopics = [...scores]
    .filter(
      (row) =>
        row.status === "scored" &&
        row.opportunity_score !== null &&
        (row.safe_asset_count ?? 0) <= 2 &&
        (row.embeddable_asset_count ?? 0) <= 1,
    )
    .slice(0, dashboardLimit);
  const snapshot = scores[0];

  return {
    window,
    previousWindow,
    snapshotWindowEnd: snapshot?.window_end ?? null,
    scoredAt: snapshot?.scored_at ?? null,
    topSearches,
    fastestGrowing: compareDemandGrowth(current, previous),
    noResultQueries,
    lowSupplyTopics,
    topCopiedAssets: (reads[3]?.results ?? []) as CopiedAssetSqlRow[],
  };
}
