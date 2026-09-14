import { searchAssets } from "../search/search-assets";
import {
  demandQueryNormalizationVersion,
  normalizeDemandQuery,
} from "../search/normalize-demand-query";
import {
  opportunityScoreVersion,
  scoreOpportunity,
  type OpportunityScoreInput,
  type OpportunityScoreResult,
} from "./opportunity-score";

const DEFAULT_WINDOW_DAYS = 28;
const DEFAULT_SUPPLY_CONCURRENCY = 4;
const MAX_D1_BATCH_STATEMENTS = 900;
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

type DailyAggregateRow = {
  aggregate_date: string;
  normalization_version: string;
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  result_count_distribution_json: string;
  no_result_searches: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
};

type SearchSessionRow = {
  anonymous_session_id: string;
  query_raw: string;
};

type Rollup = {
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  result_counts: Map<number, number>;
  no_result_searches: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
  sessions: Set<string>;
  invalid_reason: string | null;
};

export type OpportunitySnapshotRow = {
  window_start: string;
  window_end: string;
  scored_at: string;
  normalization_version: typeof demandQueryNormalizationVersion;
  score_version: typeof opportunityScoreVersion;
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  unique_anonymous_sessions: number;
  result_count_distribution_json: string;
  median_result_count: number | null;
  no_result_searches: number;
  no_result_rate: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
  safe_asset_count: number | null;
  embeddable_asset_count: number | null;
  demand_points: number | null;
  scarcity_points: number | null;
  engagement_intent: number | null;
  opportunity_score: number | null;
  status: OpportunityScoreResult["status"];
  reason_code: string | null;
  explanation_json: string;
};

export type OpportunityScoringOptions = {
  scored_at?: string;
  window_days?: number;
  supply_concurrency?: number;
};

export type OpportunityScoringResult = {
  window_start: string;
  window_end: string;
  scored_at: string;
  snapshots: OpportunitySnapshotRow[];
  database_written: boolean;
};

function parseIsoTimestamp(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("A valid ISO timestamp is required.");
  return parsed;
}

function utcDayStart(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function windowBounds(scoredAt: string, windowDays: number): { start: string; end: string } {
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
    throw new Error("window_days must be an integer between 1 and 365.");
  }
  const scoredAtDate = parseIsoTimestamp(scoredAt);
  const end = utcDayStart(scoredAtDate);
  return {
    start: new Date(end.getTime() - windowDays * millisecondsPerDay).toISOString(),
    end: end.toISOString(),
  };
}

function getRollup(map: Map<string, Rollup>, row: DailyAggregateRow): Rollup {
  const existing = map.get(row.aggregation_key);
  if (existing) return existing;
  const created: Rollup = {
    aggregation_key: row.aggregation_key,
    display_query: row.display_query,
    topic_key: row.topic_key,
    searches: 0,
    result_counts: new Map(),
    no_result_searches: 0,
    asset_clicks: 0,
    embed_copies: 0,
    citation_copies: 0,
    sessions: new Set(),
    invalid_reason: null,
  };
  map.set(row.aggregation_key, created);
  return created;
}

function addDistribution(rollup: Rollup, value: string, searches: number): void {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      rollup.invalid_reason ??= "invalid_result_distribution";
      return;
    }
    let rowTotal = 0;
    for (const [key, count] of Object.entries(parsed)) {
      const resultCount = Number(key);
      if (
        !/^\d+$/u.test(key) ||
        String(resultCount) !== key ||
        !Number.isInteger(count) ||
        count < 0
      ) {
        rollup.invalid_reason ??= "invalid_result_distribution";
        return;
      }
      rowTotal += count;
      rollup.result_counts.set(resultCount, (rollup.result_counts.get(resultCount) ?? 0) + count);
    }
    if (rowTotal !== searches) rollup.invalid_reason ??= "invalid_result_distribution";
  } catch {
    rollup.invalid_reason ??= "invalid_result_distribution";
  }
}

function distributionObject(rollup: Rollup): Record<string, number> {
  return Object.fromEntries(
    [...rollup.result_counts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([resultCount, count]) => [String(resultCount), count]),
  );
}

function parseRights(value: string | null): { embed_allowed?: boolean | null } {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as { embed_allowed?: boolean | null })
      : {};
  } catch {
    return {};
  }
}

async function supplySnapshot(
  db: D1Database,
  query: string,
  now: string,
): Promise<{ safe_asset_count: number; embeddable_asset_count: number }> {
  const result = await searchAssets(db, { query, limit: 50 }, { now });
  let safeAssetCount = 0;
  let embeddableAssetCount = 0;
  for (const item of result.results) {
    if (item.asset.rights_status === "safe") safeAssetCount = Math.min(3, safeAssetCount + 1);
    if (
      item.asset.embed_url &&
      item.asset.embed_url.trim().length > 0 &&
      parseRights(item.asset.rights_json).embed_allowed === true
    ) {
      embeddableAssetCount = Math.min(3, embeddableAssetCount + 1);
    }
  }
  return { safe_asset_count: safeAssetCount, embeddable_asset_count: embeddableAssetCount };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = Array<R>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(values[index] as T);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, values.length)) }, () =>
      worker(),
    ),
  );
  return results;
}

function unavailableResult(reasonCode: string): OpportunityScoreResult {
  return {
    status: "unavailable",
    reason_code: reasonCode,
    median_result_count: null,
    demand_points: null,
    scarcity_points: null,
    engagement_intent: null,
    opportunity_score: null,
    explanation: { version: opportunityScoreVersion, reason_code: reasonCode },
  };
}

function rowFromResult(
  rollup: Rollup,
  result: OpportunityScoreResult,
  bounds: { start: string; end: string },
  scoredAt: string,
  supply: { safe_asset_count: number | null; embeddable_asset_count: number | null },
): OpportunitySnapshotRow {
  const distribution = distributionObject(rollup);
  return {
    window_start: bounds.start,
    window_end: bounds.end,
    scored_at: scoredAt,
    normalization_version: demandQueryNormalizationVersion,
    score_version: opportunityScoreVersion,
    aggregation_key: rollup.aggregation_key,
    display_query: rollup.display_query,
    topic_key: rollup.topic_key,
    searches: rollup.searches,
    unique_anonymous_sessions: rollup.sessions.size,
    result_count_distribution_json: JSON.stringify(distribution),
    median_result_count: result.median_result_count,
    no_result_searches: rollup.no_result_searches,
    no_result_rate: rollup.searches === 0 ? 0 : rollup.no_result_searches / rollup.searches,
    asset_clicks: rollup.asset_clicks,
    embed_copies: rollup.embed_copies,
    citation_copies: rollup.citation_copies,
    safe_asset_count: supply.safe_asset_count,
    embeddable_asset_count: supply.embeddable_asset_count,
    demand_points: result.demand_points,
    scarcity_points: result.scarcity_points,
    engagement_intent: result.engagement_intent,
    opportunity_score: result.opportunity_score,
    status: result.status,
    reason_code: result.reason_code,
    explanation_json: JSON.stringify(result.explanation),
  };
}

const aggregateRowsSql = `
  SELECT aggregate_date, normalization_version, aggregation_key, display_query, topic_key,
    searches, result_count_distribution_json, no_result_searches, asset_clicks, embed_copies,
    citation_copies
  FROM demand_daily_aggregates
  WHERE aggregate_date >= ? AND aggregate_date < ?
    AND normalization_version = ?
  ORDER BY aggregate_date ASC, aggregation_key ASC
`;

const searchSessionsSql = `
  SELECT anonymous_session_id, query_raw
  FROM search_events
  WHERE created_at >= ? AND created_at < ?
`;

const deleteSnapshotsSql = `
  DELETE FROM opportunity_scores
  WHERE window_end = ? AND normalization_version = ? AND score_version = ?
`;

const insertSnapshotSql = `
  INSERT INTO opportunity_scores (
    window_start, window_end, scored_at, normalization_version, score_version,
    aggregation_key, display_query, topic_key, searches, unique_anonymous_sessions,
    result_count_distribution_json, median_result_count, no_result_searches, no_result_rate,
    asset_clicks, embed_copies, citation_copies, safe_asset_count, embeddable_asset_count,
    demand_points, scarcity_points, engagement_intent, opportunity_score, status, reason_code,
    explanation_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function snapshotBindings(row: OpportunitySnapshotRow): unknown[] {
  return [
    row.window_start,
    row.window_end,
    row.scored_at,
    row.normalization_version,
    row.score_version,
    row.aggregation_key,
    row.display_query,
    row.topic_key,
    row.searches,
    row.unique_anonymous_sessions,
    row.result_count_distribution_json,
    row.median_result_count,
    row.no_result_searches,
    row.no_result_rate,
    row.asset_clicks,
    row.embed_copies,
    row.citation_copies,
    row.safe_asset_count,
    row.embeddable_asset_count,
    row.demand_points,
    row.scarcity_points,
    row.engagement_intent,
    row.opportunity_score,
    row.status,
    row.reason_code,
    row.explanation_json,
  ];
}

export async function runOpportunityScoring(
  db: D1Database,
  options: OpportunityScoringOptions = {},
): Promise<OpportunityScoringResult> {
  const scoredAt = options.scored_at ?? new Date().toISOString();
  const bounds = windowBounds(scoredAt, options.window_days ?? DEFAULT_WINDOW_DAYS);
  const reads = await db.batch([
    db
      .prepare(aggregateRowsSql)
      .bind(bounds.start.slice(0, 10), bounds.end.slice(0, 10), demandQueryNormalizationVersion),
    db.prepare(searchSessionsSql).bind(bounds.start, bounds.end),
  ]);
  const dailyRows = (reads[0]?.results ?? []) as DailyAggregateRow[];
  const sessionRows = (reads[1]?.results ?? []) as SearchSessionRow[];
  const rollups = new Map<string, Rollup>();
  for (const row of dailyRows) {
    const rollup = getRollup(rollups, row);
    if (rollup.display_query !== row.display_query)
      rollup.invalid_reason ??= "inconsistent_display_query";
    if (rollup.topic_key !== row.topic_key) rollup.invalid_reason ??= "inconsistent_topic_key";
    rollup.searches += row.searches;
    rollup.no_result_searches += row.no_result_searches;
    rollup.asset_clicks += row.asset_clicks;
    rollup.embed_copies += row.embed_copies;
    rollup.citation_copies += row.citation_copies;
    addDistribution(rollup, row.result_count_distribution_json, row.searches);
  }
  for (const row of sessionRows) {
    const normalized = normalizeDemandQuery(row.query_raw);
    if (normalized.aggregation_eligible && normalized.aggregation_key) {
      rollups.get(normalized.aggregation_key)?.sessions.add(row.anonymous_session_id);
    }
  }

  const rollupValues = [...rollups.values()].sort((left, right) =>
    left.aggregation_key.localeCompare(right.aggregation_key),
  );
  const scoredRows = await mapWithConcurrency(
    rollupValues,
    options.supply_concurrency ?? DEFAULT_SUPPLY_CONCURRENCY,
    async (rollup) => {
      if (rollup.invalid_reason) {
        return rowFromResult(rollup, unavailableResult(rollup.invalid_reason), bounds, scoredAt, {
          safe_asset_count: null,
          embeddable_asset_count: null,
        });
      }
      let supply: { safe_asset_count: number; embeddable_asset_count: number };
      try {
        supply = await supplySnapshot(db, rollup.aggregation_key, scoredAt);
      } catch {
        return rowFromResult(
          rollup,
          unavailableResult("supply_snapshot_failed"),
          bounds,
          scoredAt,
          { safe_asset_count: null, embeddable_asset_count: null },
        );
      }
      const input: OpportunityScoreInput = {
        normalization_version: demandQueryNormalizationVersion,
        aggregation_key: rollup.aggregation_key,
        display_query: rollup.display_query,
        topic_key: rollup.topic_key,
        searches: rollup.searches,
        unique_anonymous_sessions: rollup.sessions.size,
        result_count_distribution: distributionObject(rollup),
        no_result_searches: rollup.no_result_searches,
        asset_clicks: rollup.asset_clicks,
        embed_copies: rollup.embed_copies,
        citation_copies: rollup.citation_copies,
        safe_asset_count: supply.safe_asset_count,
        embeddable_asset_count: supply.embeddable_asset_count,
      };
      return rowFromResult(rollup, scoreOpportunity(input), bounds, scoredAt, supply);
    },
  );

  const deleteStatement = db
    .prepare(deleteSnapshotsSql)
    .bind(bounds.end, demandQueryNormalizationVersion, opportunityScoreVersion);
  const insertStatements = scoredRows.map((row) =>
    db.prepare(insertSnapshotSql).bind(...snapshotBindings(row)),
  );
  if (insertStatements.length === 0) {
    await db.batch([deleteStatement]);
  } else {
    let offset = 0;
    while (offset < insertStatements.length) {
      const limit = offset === 0 ? MAX_D1_BATCH_STATEMENTS - 1 : MAX_D1_BATCH_STATEMENTS;
      const statements = insertStatements.slice(offset, offset + limit);
      if (offset === 0) statements.unshift(deleteStatement);
      await db.batch(statements);
      offset += limit;
    }
  }

  return {
    window_start: bounds.start,
    window_end: bounds.end,
    scored_at: scoredAt,
    snapshots: scoredRows,
    database_written: true,
  };
}
