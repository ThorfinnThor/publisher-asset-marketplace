import { describe, expect, it } from "vitest";

import {
  buildFallbackSearchSql,
  buildBrowseSearchSql,
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

  it("builds a filtered catalogue browse query without requiring a search term", () => {
    const sql = buildBrowseSearchSql({
      asset_types: ["dataset"],
      source_ids: ["source_eurostat"],
      rights_statuses: ["safe"],
      commercial_use: true,
      updated_since: "2025-09-14T00:00:00.000Z",
    });
    expect(sql).toContain("FROM assets a");
    expect(sql).toContain("a.asset_type IN (?)");
    expect(sql).toContain("a.source_id IN (?)");
    expect(sql).toContain("a.rights_status IN (?)");
    expect(sql).toContain("json_extract(a.rights_json, '$.commercial_use') = 1");
    expect(sql).toContain("a.source_updated_at >= ?");
    expect(sql).toContain("ORDER BY COALESCE(a.source_updated_at, '') DESC");
    expect(sql).toContain("a.embed_origin");
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
    const secondary = candidate("solar-two", "Solar panel installation prices", "safe", {
      fts_rank: 2,
    });
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        return {
          bind: (...values: unknown[]) => ({
            all: async () => ({
              results: sql.includes("assets_fts MATCH")
                ? [
                    { ...primary, bm25_rank: 1 },
                    { ...secondary, bm25_rank: 2 },
                  ]
                : [],
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

  it("browses assets using filters alone when the query is blank", async () => {
    const calls: string[] = [];
    const eurostat = candidate("eurostat-demo", "Population by age", "safe", {
      source_id: "source_eurostat",
      source_name: "Eurostat",
    });
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        return {
          bind: (...values: unknown[]) => ({
            all: async () => ({ results: [eurostat], success: true, meta: {}, values }),
          }),
        };
      },
    } as unknown as D1Database;

    const result = await searchAssets(db, {
      query: "",
      filters: { source_ids: ["source_eurostat"] },
      limit: 10,
    });

    expect(calls[0]).toContain("FROM assets a");
    expect(result.results[0]).toMatchObject({
      asset: { source_id: "source_eurostat", source_name: "Eurostat" },
      retrieval_path: "browse",
    });
    expect(result.next_cursor).toBeNull();
  });

  it("continues browse results without repeating the first page", async () => {
    const first = candidate("alpha", "Alpha population", "safe", {
      source_updated_at: "2026-09-01",
    });
    const second = candidate("beta", "Beta population", "safe", {
      source_updated_at: "2026-08-01",
    });
    const third = candidate("gamma", "Gamma population", "safe", {
      source_updated_at: "2026-07-01",
    });
    let call = 0;
    const db = {
      prepare() {
        return {
          bind: () => ({
            all: async () => ({
              results: call++ === 0 ? [first, second, third] : [third],
              success: true,
              meta: {},
            }),
          }),
        };
      },
    } as unknown as D1Database;

    const firstPage = await searchAssets(db, { query: "", limit: 2 });
    expect(firstPage.results.map((result) => result.asset.slug)).toEqual(["alpha", "beta"]);
    expect(firstPage.next_cursor).not.toBeNull();

    const secondPage = await searchAssets(db, {
      query: "",
      limit: 2,
      cursor: firstPage.next_cursor ?? undefined,
    });
    expect(secondPage.results.map((result) => result.asset.slug)).toEqual(["gamma"]);
    expect(secondPage.next_cursor).toBeNull();
  });
});
