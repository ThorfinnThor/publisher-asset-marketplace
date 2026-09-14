import { describe, expect, it } from "vitest";

import benchmark from "../data/benchmarks/search-ranking-v1.json";
import { searchRankingV1 } from "../src/lib/search/ranking-contract";

describe("C1 search ranking contract", () => {
  it("keeps the code and benchmark contract versions aligned", () => {
    expect(benchmark.contractVersion).toBe(searchRankingV1.version);
  });

  it("contains unique fixtures and all required benchmark cases", () => {
    const slugs = benchmark.fixtureAssets.map((asset) => asset.slug);
    const queryIds = benchmark.queries.map((query) => query.id);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(queryIds).size).toBe(queryIds.length);
    expect(queryIds).toEqual(
      expect.arrayContaining([
        "exact-title",
        "partial-phrase",
        "typo-fallback",
        "zero-result",
        "safe-restricted-tie",
      ]),
    );
  });

  it("references known assets and never expects an ineligible result", () => {
    const fixtures = new Map(benchmark.fixtureAssets.map((asset) => [asset.slug, asset]));

    for (const query of benchmark.queries) {
      for (const slug of [...query.expectedOrderPrefix, ...query.mustExclude]) {
        expect(fixtures.has(slug), `${query.id} references ${slug}`).toBe(true);
      }
      for (const slug of query.expectedOrderPrefix) {
        const fixture = fixtures.get(slug);
        expect(fixture?.status).toBe("published");
        expect(["safe", "restricted"]).toContain(fixture?.rightsStatus);
      }
    }
  });

  it("makes primary matches outrank every trigram-only result", () => {
    const minimumPrimaryScore = searchRankingV1.fts5.primary_score_base + 1;
    const maximumFallbackScore =
      searchRankingV1.trigram.score_multiplier +
      searchRankingV1.boosts.safe_and_embeddable +
      searchRankingV1.boosts.fresh_90_days;

    expect(minimumPrimaryScore).toBeGreaterThan(maximumFallbackScore);
    expect(searchRankingV1.hard_eligibility.excluded_rights_statuses).toContain("blocked");
  });
});
