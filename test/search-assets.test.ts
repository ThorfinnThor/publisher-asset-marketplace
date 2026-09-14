import { describe, expect, it } from "vitest";

import {
  buildFallbackSearchSql,
  buildFtsMatchExpression,
  buildPrimarySearchSql,
  rankSearchCandidates,
  retrievalTokens,
  searchAssets,
  type SearchCandidate,
} from "../src/lib/search/search-assets";
import { buildTrigrams } from "../src/lib/search/search-index";

const now = "2026-09-14T12:00:00.000Z";

function candidate(
  slug: string,
  title: string,
  rightsStatus: "safe" | "restricted",
  overrides: Partial<SearchCandidate> = {},
): SearchCandidate {
  return {
    id: `asset_${slug}`,
    slug,
    title,
    description: "A publisher-ready chart",
    asset_type: "chart",
    source_name: "Our World in Data",
    rights_status: rightsStatus,
    rights_json: JSON.stringify({ embed_allowed: true }),
    source_updated_at: "2026-08-01",
    ...overrides,
  };
}

describe("C2 search function", () => {
  it("normalizes retrieval tokens and safely builds FTS prefix syntax", () => {
    expect(retrievalTokens("Cost to sequence a human genome")).toEqual([
      "cost",
      "sequence",
      "human",
      "genome",
    ]);
    expect(buildFtsMatchExpression("Cost to sequence a human genome")).toBe(
      '"cost"* AND "sequence"* AND "human"* AND "genome"*',
    );
  });

  it("keeps the SQL parameterized and applies rights eligibility before ranking", () => {
    const sql = buildPrimarySearchSql({ asset_types: ["chart"] });
    const fallbackSql = buildFallbackSearchSql({ rights_statuses: ["safe"] }, 4);

    expect(sql).toContain("assets_fts MATCH ?");
    expect(sql).toContain("a.status = 'published'");
    expect(sql).toContain("a.rights_status IN ('safe', 'restricted')");
    expect(sql).toContain("bm25(assets_fts, 0.0, 10.0, 4.0, 6.0, 1.0)");
    expect(fallbackSql).toContain("asset_search_trigrams");
    expect(fallbackSql).toContain("a.rights_status IN ('safe', 'restricted')");
  });

  it("puts safe embeddable assets ahead of restricted ties", () => {
    const results = rankSearchCandidates(
      [
        candidate("restricted", "Solar photovoltaic panel prices", "restricted", { fts_rank: 1 }),
        candidate("safe", "Solar photovoltaic panel prices", "safe", { fts_rank: 1 }),
      ],
      "solar photovoltaic panel prices",
      now,
    );

    expect(results.map((result) => result.asset.slug)).toEqual(["safe", "restricted"]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("ranks typo fallback candidates deterministically", () => {
    const results = rankSearchCandidates(
      [
        candidate("restricted", "Solar photovoltaic panel prices", "restricted", {
          trigram_similarity: 0.5,
        }),
        candidate("safe", "Solar photovoltaic panel prices", "safe", {
          trigram_similarity: 0.5,
        }),
      ],
      "solr photvoltaic prices",
      now,
      "trigram",
    );

    expect(results.map((result) => result.asset.slug)).toEqual(["safe", "restricted"]);
    expect(buildTrigrams("solar photovoltaic panel prices")).toContain(" so");
  });

  it("returns a stable cursor and uses the trigram query when primary results are sparse", async () => {
    const calls: string[] = [];
    const primary = candidate("solar", "Solar photovoltaic panel prices", "safe", {
      fts_rank: 1,
    });
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        return {
          bind: (...values: unknown[]) => ({
            all: async () => ({
              results: sql.includes("assets_fts MATCH") ? [{ ...primary, bm25_rank: 1 }] : [],
              success: true,
              meta: {},
              values,
            }),
          }),
        };
      },
    } as unknown as D1Database;

    const result = await searchAssets(
      db,
      { query: "solar photovoltaic prices", limit: 1 },
      { now },
    );

    expect(result.results).toHaveLength(1);
    expect(result.next_cursor).not.toBeNull();
    expect(calls.some((sql) => sql.includes("asset_search_trigrams"))).toBe(true);
  });
});
