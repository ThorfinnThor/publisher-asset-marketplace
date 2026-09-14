import { describe, expect, it } from "vitest";

import {
  completeCreatorAnalyticsWindow,
  creatorAssetAnalyticsSql,
  creatorDiscoveryQueriesSql,
  getCreatorDashboard,
  normalizeCreatorAssetAnalytics,
} from "../src/lib/analytics/creator-dashboard";

describe("creator dashboard analytics", () => {
  it("uses the latest complete 28-day UTC window", () => {
    expect(completeCreatorAnalyticsWindow(new Date("2026-09-14T16:30:00.000Z"))).toEqual({
      start: "2026-08-17",
      end: "2026-09-14",
    });
  });

  it("normalizes counts, hides sensitive queries, and ranks discovery queries", () => {
    const result = normalizeCreatorAssetAnalytics(
      [
        {
          id: "asset-1",
          slug: "solar",
          title: "Solar",
          asset_type: "chart",
          status: "published",
          impressions: "4",
          detail_views: 2,
          embed_copies: null,
          citation_copies: "1",
          source_clicks: 0,
        },
      ],
      [
        { asset_id: "asset-1", query_normalized: "solar photovoltaic", impressions: "2" },
        { asset_id: "asset-1", query_normalized: "solar pv", impressions: 3 },
        { asset_id: "asset-1", query_normalized: "alice@example.test", impressions: 20 },
      ],
    );

    expect(result[0]).toMatchObject({
      impressions: 4,
      detail_views: 2,
      embed_copies: 0,
      citation_copies: 1,
      source_clicks: 0,
      top_discovery_queries: [{ query: "solar pv", impressions: 5 }],
    });
  });

  it("keeps every analytics query scoped to the authenticated creator", () => {
    expect(creatorAssetAnalyticsSql).toContain("WHERE a.creator_id = ?");
    expect(creatorAssetAnalyticsSql).toContain("a.status = 'published'");
    expect(creatorDiscoveryQueriesSql).toContain("WHERE creator_id = ?");
    expect(creatorDiscoveryQueriesSql).toContain("ae.event_type = 'impression'");
    expect(creatorDiscoveryQueriesSql).toContain("ROW_NUMBER");
  });

  it("binds the creator id and time window in prepared statements", async () => {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        return {
          bind: (...values: unknown[]) => {
            const statement = { sql, values };
            prepared.push(statement);
            return statement;
          },
        };
      },
      batch: async () => [
        {
          results: [
            {
              id: "asset-1",
              slug: "solar",
              title: "Solar",
              asset_type: "chart",
              status: "published",
              impressions: 1,
              detail_views: 1,
              embed_copies: 0,
              citation_copies: 0,
              source_clicks: 0,
            },
          ],
        },
        { results: [] },
      ],
    } as unknown as D1Database;

    const result = await getCreatorDashboard(db, "github:123", new Date("2026-09-14T00:00:00Z"));
    expect(result.assets).toHaveLength(1);
    expect(prepared).toHaveLength(2);
    expect(prepared[0]?.values).toEqual([
      "2026-08-17T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
      "github:123",
      100,
    ]);
    expect(prepared[1]?.values).toEqual([
      "2026-08-17T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
      "github:123",
      3,
    ]);
  });
});
