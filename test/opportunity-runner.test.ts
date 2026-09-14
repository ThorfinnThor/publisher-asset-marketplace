import { describe, expect, it } from "vitest";

import { runOpportunityScoring } from "../src/lib/analytics/opportunity-runner";

describe("D3 opportunity runner", () => {
  it("rolls up the complete 28-day window and writes a reproducible snapshot", async () => {
    const dailyRows = [
      {
        aggregate_date: "2026-09-13",
        normalization_version: "demand-query-v1",
        aggregation_key: "solar",
        display_query: "solar",
        topic_key: null,
        searches: 5,
        result_count_distribution_json: '{"0":5}',
        no_result_searches: 5,
        asset_clicks: 0,
        embed_copies: 0,
        citation_copies: 0,
      },
    ];
    const sessions = [
      { anonymous_session_id: "session-a", query_raw: "solar" },
      { anonymous_session_id: "session-b", query_raw: "solar" },
      { anonymous_session_id: "session-c", query_raw: "solar" },
    ];
    const candidates = Array.from({ length: 4 }, (_, index) => ({
      id: `asset-${index}`,
      slug: `solar-${index}`,
      title: `Solar asset ${index}`,
      description: "A solar chart",
      asset_type: "chart",
      source_name: "Source",
      rights_status: "safe" as const,
      rights_json: JSON.stringify({ embed_allowed: true }),
      source_updated_at: "2026-09-01",
      canonical_url: `https://example.test/solar-${index}`,
      embed_url: `https://example.test/solar-${index}?embed=1`,
      preview_url: null,
      citation_text: null,
      bm25_rank: index + 1,
    }));
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql.trim().split("\n")[0] ?? sql);
        return {
          bind: (...values: unknown[]) => ({
            sql,
            values,
            all: async () => ({ results: candidates }),
          }),
        };
      },
      batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
        calls.push(`batch:${statements.length}`);
        if (statements[0]?.sql.includes("FROM demand_daily_aggregates")) {
          return [{ results: dailyRows }, { results: sessions }];
        }
        return statements.map(() => ({ success: true, results: [], meta: {} }));
      },
    } as unknown as D1Database;

    const result = await runOpportunityScoring(db, {
      scored_at: "2026-09-14T03:00:00.000Z",
      supply_concurrency: 1,
    });

    expect(result.window_start).toBe("2026-08-17T00:00:00.000Z");
    expect(result.window_end).toBe("2026-09-14T00:00:00.000Z");
    expect(result.snapshots).toEqual([
      expect.objectContaining({
        aggregation_key: "solar",
        unique_anonymous_sessions: 3,
        safe_asset_count: 3,
        embeddable_asset_count: 3,
        status: "scored",
        opportunity_score: 4,
      }),
    ]);
    expect(calls.filter((call) => call.startsWith("batch:")).length).toBe(2);
  });
});
