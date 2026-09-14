import { describe, expect, it } from "vitest";

import {
  aggregateDemandEvents,
  previousUtcDay,
  runDemandAggregation,
  type DemandAssetEventRow,
  type DemandSearchEventRow,
} from "../src/lib/analytics/demand-aggregation";

const day = "2026-09-13";
const writtenAt = "2026-09-14T03:00:00.000Z";

const searchEvents: DemandSearchEventRow[] = [
  {
    id: "search-1",
    anonymous_session_id: "session-a",
    query_raw: "SaaS churn rate",
    result_count: 0,
    created_at: `${day}T10:00:00.000Z`,
  },
  {
    id: "search-2",
    anonymous_session_id: "session-a",
    query_raw: "saas churn",
    result_count: 2,
    created_at: `${day}T11:00:00.000Z`,
  },
  {
    id: "search-3",
    anonymous_session_id: "session-b",
    query_raw: "alice@example.test churn",
    result_count: 1,
    created_at: `${day}T12:00:00.000Z`,
  },
];

const assetEvents: DemandAssetEventRow[] = [
  { search_event_id: "search-2", event_type: "detail_view" },
  { search_event_id: "search-2", event_type: "source_click" },
  { search_event_id: "search-2", event_type: "embed_copy" },
  { search_event_id: "search-2", event_type: "citation_copy" },
  { search_event_id: null, event_type: "detail_view" },
];

describe("demand aggregation", () => {
  it("aggregates variants, sessions, result distribution and attributed actions", () => {
    const result = aggregateDemandEvents(day, searchEvents, assetEvents, writtenAt);
    expect(result.eligible_searches).toBe(2);
    expect(result.suppressed_searches).toBe(1);
    expect(result.aggregates).toEqual([
      expect.objectContaining({
        aggregation_key: "saas churn",
        searches: 2,
        unique_anonymous_sessions: 1,
        result_count_distribution_json: '{"0":1,"2":1}',
        no_result_searches: 1,
        no_result_rate: 0.5,
        asset_clicks: 2,
        embed_copies: 1,
        citation_copies: 1,
      }),
    ]);
  });

  it("selects the previous UTC day at the scheduled run time", () => {
    expect(previousUtcDay("2026-09-14T03:00:00.000Z")).toBe(day);
  });

  it("rewrites the same day in one delete-plus-insert batch", async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql.trim().split("\n")[0] ?? sql);
        return {
          bind: (...values: unknown[]) => ({ values, sql }),
        };
      },
      batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
        calls.push(`batch:${statements.length}`);
        if (statements[0]?.sql.includes("FROM search_events")) {
          return [
            { results: searchEvents.filter((event) => !event.query_raw.includes("alice")) },
            { results: assetEvents },
          ];
        }
        return statements.map(() => ({ success: true, results: [], meta: {} }));
      },
    } as unknown as D1Database;

    const result = await runDemandAggregation(db, { day, written_at: writtenAt });
    expect(result.database_written).toBe(true);
    expect(result.aggregates).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("batch:")).length).toBe(2);
    expect(calls.some((call) => call.includes("DELETE FROM demand_daily_aggregates"))).toBe(true);
  });
});
