import { describe, expect, it } from "vitest";

import fixture from "../data/benchmarks/query-normalization-v1.json";
import {
  normalizeDemandQuery,
  type DemandQueryNormalization,
} from "../src/lib/search/normalize-demand-query";

type FixtureCase = {
  id: string;
  input: string;
  search_normalized: string;
  aggregation_key: string | null;
  aggregation_eligible: boolean;
  suppression_reason: DemandQueryNormalization["suppression_reason"];
};

describe("demand query normalization", () => {
  it("matches every approved V1 fixture", () => {
    for (const testCase of fixture.cases as FixtureCase[]) {
      const result = normalizeDemandQuery(testCase.input);
      expect(result.search_normalized, testCase.id).toBe(testCase.search_normalized);
      expect(result.aggregation_key, testCase.id).toBe(testCase.aggregation_key);
      expect(result.aggregation_eligible, testCase.id).toBe(testCase.aggregation_eligible);
      expect(result.suppression_reason, testCase.id).toBe(testCase.suppression_reason);
    }
  });

  it("converges and keeps distinct pairs exactly as reviewed", () => {
    const byId = new Map(
      (fixture.cases as FixtureCase[]).map((testCase) => [
        testCase.id,
        normalizeDemandQuery(testCase.input),
      ]),
    );
    for (const [left, right] of fixture.must_match) {
      expect(byId.get(left)?.aggregation_key).toBe(byId.get(right)?.aggregation_key);
    }
    for (const [left, right] of fixture.must_not_match) {
      expect(byId.get(left)?.aggregation_key).not.toBe(byId.get(right)?.aggregation_key);
    }
    for (const [left, right] of fixture.required_distinct_pairs) {
      expect(normalizeDemandQuery(left).aggregation_key).not.toBe(
        normalizeDemandQuery(right).aggregation_key,
      );
    }
  });

  it("is idempotent for eligible queries and never exposes suppressed values", () => {
    for (const testCase of fixture.cases as FixtureCase[]) {
      const result = normalizeDemandQuery(testCase.input);
      if (result.aggregation_eligible) {
        const repeated = normalizeDemandQuery(result.aggregation_key as string);
        expect(repeated.aggregation_key).toBe(result.aggregation_key);
        expect(repeated.display_query).toBe(result.display_query);
        expect(repeated.tokens).toEqual(result.tokens);
      } else {
        expect(result.aggregation_key).toBeNull();
        expect(result.display_query).toBeNull();
        expect(result.tokens).toEqual([]);
      }
    }
  });
});
