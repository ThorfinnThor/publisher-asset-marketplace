import { afterAll, beforeAll, describe, expect, it } from "vitest";

import benchmarkJson from "../data/benchmarks/search-ranking-v1.json";
import humanReviewJson from "../data/benchmarks/search-quality-review-v1.json";
import {
  runSearchQualityReview,
  type SearchBenchmark,
  type SearchQualityHumanReview,
  type SearchQualityReviewResult,
} from "../src/lib/search/search-quality";
import {
  createSearchBenchmarkDatabase,
  type SearchBenchmarkAssetFixture,
} from "../scripts/lib/search-benchmark-db";

type BenchmarkDocument = SearchBenchmark & {
  fixtureAssets: SearchBenchmarkAssetFixture[];
};

describe("C8 search-quality review", () => {
  let closeDatabase: () => void;
  let result: SearchQualityReviewResult;

  beforeAll(async () => {
    const benchmark = benchmarkJson as BenchmarkDocument;
    const fixtureDatabase = await createSearchBenchmarkDatabase(benchmark.fixtureAssets);
    closeDatabase = fixtureDatabase.close;
    result = await runSearchQualityReview(
      fixtureDatabase.db,
      benchmark,
      humanReviewJson as SearchQualityHumanReview,
    );
  });

  afterAll(() => closeDatabase());

  it("passes every fixed contract case through the production search function", () => {
    expect(result.passed).toBe(true);
    expect(result.summary.contract_passed_count).toBe(result.summary.query_count);
  });

  it("keeps every answerable publisher query at grade 2", () => {
    expect(result.summary.answerable_query_count).toBeGreaterThan(0);
    expect(result.summary.strong_answer_count).toBe(result.summary.answerable_query_count);
    expect(result.summary.strong_answer_rate).toBe(1);
  });

  it("returns no unsafe guess for the deliberately unanswerable query", () => {
    const zeroResult = result.cases.find((entry) => entry.id === "zero-result");
    expect(zeroResult).toMatchObject({
      answerable: false,
      grade: 0,
      observed_order: [],
      contract_passed: true,
    });
  });

  it("recovers the typo with trigram search and keeps blocked assets out", () => {
    const typo = result.cases.find((entry) => entry.id === "typo-fallback");
    expect(typo?.observed_paths).toContain("trigram");
    expect(typo?.observed_order.slice(0, 2)).toEqual([
      "solar-pv-prices-safe",
      "solar-pv-prices-restricted",
    ]);
    expect(typo?.observed_order).not.toContain("solar-pv-prices-blocked");
  });
});
