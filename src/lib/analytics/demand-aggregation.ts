import {
  demandQueryNormalizationVersion,
  normalizeDemandQuery,
} from "../search/normalize-demand-query";

const MAX_D1_BATCH_STATEMENTS = 900;
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export type DemandSearchEventRow = {
  id: string;
  anonymous_session_id: string;
  query_raw: string;
  result_count: number;
  created_at: string;
};

export type DemandAssetEventRow = {
  search_event_id: string | null;
  event_type: "detail_view" | "source_click" | "embed_copy" | "citation_copy";
};

export type DemandAggregateRow = {
  aggregate_date: string;
  normalization_version: typeof demandQueryNormalizationVersion;
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  unique_anonymous_sessions: number;
  result_count_distribution_json: string;
  no_result_searches: number;
  no_result_rate: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
  created_at: string;
  updated_at: string;
};

type MutableAggregate = Omit<
  DemandAggregateRow,
  "result_count_distribution_json" | "no_result_rate"
> & {
  result_counts: Map<number, number>;
  sessions: Set<string>;
};

export type DemandAggregationOptions = {
  day?: string;
  now?: string;
  written_at?: string;
};

export type DemandAggregationResult = {
  aggregate_date: string;
  aggregates: DemandAggregateRow[];
  eligible_searches: number;
  suppressed_searches: number;
  database_written: boolean;
};

function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function previousUtcDay(now = new Date().toISOString()): string {
  const parsed = new Date(now);
  if (Number.isNaN(parsed.getTime())) throw new Error("A valid ISO timestamp is required.");
  return new Date(parsed.getTime() - millisecondsPerDay).toISOString().slice(0, 10);
}

function dayBounds(day: string): { start: string; end: string } {
  if (!isIsoDay(day)) throw new Error(`Invalid UTC aggregate day: ${day}`);
  const start = new Date(`${day}T00:00:00.000Z`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + millisecondsPerDay).toISOString(),
  };
}

function createAggregate(day: string, key: string, displayQuery: string): MutableAggregate {
  return {
    aggregate_date: day,
    normalization_version: demandQueryNormalizationVersion,
    aggregation_key: key,
    display_query: displayQuery,
    topic_key: null,
    searches: 0,
    unique_anonymous_sessions: 0,
    result_counts: new Map(),
    sessions: new Set(),
    no_result_searches: 0,
    asset_clicks: 0,
    embed_copies: 0,
    citation_copies: 0,
    created_at: "",
    updated_at: "",
  };
}

function resultDistribution(resultCounts: Map<number, number>): string {
  const ordered = [...resultCounts.entries()].sort(([left], [right]) => left - right);
  return JSON.stringify(
    Object.fromEntries(ordered.map(([count, occurrences]) => [String(count), occurrences])),
  );
}

export function aggregateDemandEvents(
  day: string,
  searchEvents: DemandSearchEventRow[],
  assetEvents: DemandAssetEventRow[],
  writtenAt: string,
): { aggregates: DemandAggregateRow[]; eligible_searches: number; suppressed_searches: number } {
  const byKey = new Map<string, MutableAggregate>();
  const searchToKey = new Map<string, string>();
  let eligibleSearches = 0;
  let suppressedSearches = 0;

  for (const event of searchEvents) {
    const normalized = normalizeDemandQuery(event.query_raw);
    if (
      !normalized.aggregation_eligible ||
      !normalized.aggregation_key ||
      !normalized.display_query
    ) {
      suppressedSearches += 1;
      continue;
    }
    eligibleSearches += 1;
    const key = normalized.aggregation_key;
    const aggregate = byKey.get(key) ?? createAggregate(day, key, normalized.display_query);
    aggregate.searches += 1;
    aggregate.sessions.add(event.anonymous_session_id);
    aggregate.result_counts.set(
      event.result_count,
      (aggregate.result_counts.get(event.result_count) ?? 0) + 1,
    );
    if (event.result_count === 0) aggregate.no_result_searches += 1;
    byKey.set(key, aggregate);
    searchToKey.set(event.id, key);
  }

  for (const event of assetEvents) {
    if (!event.search_event_id) continue;
    const key = searchToKey.get(event.search_event_id);
    if (!key) continue;
    const aggregate = byKey.get(key);
    if (!aggregate) continue;
    if (event.event_type === "detail_view" || event.event_type === "source_click") {
      aggregate.asset_clicks += 1;
    } else if (event.event_type === "embed_copy") {
      aggregate.embed_copies += 1;
    } else if (event.event_type === "citation_copy") {
      aggregate.citation_copies += 1;
    }
  }

  const aggregates = [...byKey.values()]
    .sort((left, right) => left.aggregation_key.localeCompare(right.aggregation_key))
    .map((aggregate) => ({
      aggregate_date: aggregate.aggregate_date,
      normalization_version: aggregate.normalization_version,
      aggregation_key: aggregate.aggregation_key,
      display_query: aggregate.display_query,
      topic_key: aggregate.topic_key,
      searches: aggregate.searches,
      unique_anonymous_sessions: aggregate.sessions.size,
      result_count_distribution_json: resultDistribution(aggregate.result_counts),
      no_result_searches: aggregate.no_result_searches,
      no_result_rate:
        aggregate.searches === 0 ? 0 : aggregate.no_result_searches / aggregate.searches,
      asset_clicks: aggregate.asset_clicks,
      embed_copies: aggregate.embed_copies,
      citation_copies: aggregate.citation_copies,
      created_at: writtenAt,
      updated_at: writtenAt,
    }));

  return {
    aggregates,
    eligible_searches: eligibleSearches,
    suppressed_searches: suppressedSearches,
  };
}

const searchEventsSql = `
  SELECT id, anonymous_session_id, query_raw, result_count, created_at
  FROM search_events
  WHERE created_at >= ? AND created_at < ?
  ORDER BY created_at ASC, id ASC
`;

const assetEventsSql = `
  SELECT ae.search_event_id, ae.event_type
  FROM asset_events ae
  INNER JOIN search_events se ON se.id = ae.search_event_id
  WHERE se.created_at >= ?
    AND se.created_at < ?
    AND ae.search_event_id IS NOT NULL
    AND ae.event_type IN ('detail_view', 'source_click', 'embed_copy', 'citation_copy')
`;

const deleteAggregatesSql = `
  DELETE FROM demand_daily_aggregates
  WHERE aggregate_date = ? AND normalization_version = ?
`;

const insertAggregateSql = `
  INSERT INTO demand_daily_aggregates (
    aggregate_date, normalization_version, aggregation_key, display_query, topic_key,
    searches, unique_anonymous_sessions, result_count_distribution_json, no_result_searches,
    no_result_rate, asset_clicks, embed_copies, citation_copies, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function aggregateBindings(row: DemandAggregateRow): unknown[] {
  return [
    row.aggregate_date,
    row.normalization_version,
    row.aggregation_key,
    row.display_query,
    row.topic_key,
    row.searches,
    row.unique_anonymous_sessions,
    row.result_count_distribution_json,
    row.no_result_searches,
    row.no_result_rate,
    row.asset_clicks,
    row.embed_copies,
    row.citation_copies,
    row.created_at,
    row.updated_at,
  ];
}

export async function runDemandAggregation(
  db: D1Database,
  options: DemandAggregationOptions = {},
): Promise<DemandAggregationResult> {
  const day = options.day ?? previousUtcDay(options.now);
  const { start, end } = dayBounds(day);
  const writtenAt = options.written_at ?? options.now ?? new Date().toISOString();
  const reads = await db.batch([
    db.prepare(searchEventsSql).bind(start, end),
    db.prepare(assetEventsSql).bind(start, end),
  ]);
  const searchEvents = (reads[0]?.results ?? []) as DemandSearchEventRow[];
  const assetEvents = (reads[1]?.results ?? []) as DemandAssetEventRow[];
  const computed = aggregateDemandEvents(day, searchEvents, assetEvents, writtenAt);
  const insertStatements = computed.aggregates.map((row) =>
    db.prepare(insertAggregateSql).bind(...aggregateBindings(row)),
  );

  if (insertStatements.length === 0) {
    await db.batch([db.prepare(deleteAggregatesSql).bind(day, demandQueryNormalizationVersion)]);
  } else {
    let offset = 0;
    while (offset < insertStatements.length) {
      const limit = offset === 0 ? MAX_D1_BATCH_STATEMENTS - 1 : MAX_D1_BATCH_STATEMENTS;
      const statements = insertStatements.slice(offset, offset + limit);
      if (offset === 0) {
        statements.unshift(
          db.prepare(deleteAggregatesSql).bind(day, demandQueryNormalizationVersion),
        );
      }
      await db.batch(statements);
      offset += limit;
    }
  }

  return { aggregate_date: day, ...computed, database_written: true };
}
