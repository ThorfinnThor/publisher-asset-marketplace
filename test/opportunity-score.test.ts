import { describe, expect, it } from "vitest";

import fixture from "../data/benchmarks/opportunity-score-v1.json";
import {
  lowerWeightedMedian,
  rankOpportunityScores,
  scoreOpportunity,
} from "../src/lib/analytics/opportunity-score";

describe("D3 opportunity score", () => {
  it("matches every approved benchmark case", () => {
    for (const testCase of fixture.cases) {
      const result = scoreOpportunity({
        normalization_version: "demand-query-v1",
        aggregation_key: testCase.id,
        display_query: testCase.id,
        topic_key: null,
        searches: testCase.searches,
        unique_anonymous_sessions: testCase.unique_anonymous_sessions,
        result_count_distribution: testCase.result_count_distribution as unknown as Record<
          string,
          number
        >,
        no_result_searches: testCase.no_result_searches,
        asset_clicks: testCase.asset_clicks,
        embed_copies: testCase.embed_copies,
        citation_copies: testCase.citation_copies,
        safe_asset_count: testCase.safe_asset_count,
        embeddable_asset_count: testCase.embeddable_asset_count,
      });
      expect(result.status, testCase.id).toBe(testCase.expected.status);
      expect(result.opportunity_score, testCase.id).toBe(testCase.expected.opportunity_score);
      if (testCase.expected.status === "scored") {
        expect(result.median_result_count, testCase.id).toBe(testCase.expected.median_result_count);
        expect(result.demand_points, testCase.id).toBe(testCase.expected.demand_points);
        expect(result.scarcity_points, testCase.id).toBe(testCase.expected.scarcity_points);
        expect(result.engagement_intent, testCase.id).toBe(testCase.expected.engagement_intent);
      } else if (testCase.expected.reason_code) {
        expect(result.reason_code, testCase.id).toBe(testCase.expected.reason_code);
      }
    }
  });

  it("uses a lower weighted median and rejects mismatched distributions", () => {
    expect(lowerWeightedMedian({ "0": 2, "1": 3, "8": 5 }, 10)).toBe(1);
    expect(
      scoreOpportunity({
        normalization_version: "demand-query-v1",
        aggregation_key: "invalid",
        display_query: "invalid",
        topic_key: null,
        searches: 10,
        unique_anonymous_sessions: 5,
        result_count_distribution: { "0": 9 },
        no_result_searches: 9,
        asset_clicks: 0,
        embed_copies: 0,
        citation_copies: 0,
        safe_asset_count: 0,
        embeddable_asset_count: 0,
      }),
    ).toMatchObject({ status: "unavailable", reason_code: "invalid_result_distribution" });
  });

  it("keeps no-result demand eligible and ranks ties deterministically", () => {
    const noResult = scoreOpportunity({
      normalization_version: "demand-query-v1",
      aggregation_key: "a",
      display_query: "a",
      topic_key: null,
      searches: 100,
      unique_anonymous_sessions: 50,
      result_count_distribution: { "0": 100 },
      no_result_searches: 100,
      asset_clicks: 0,
      embed_copies: 0,
      citation_copies: 0,
      safe_asset_count: 0,
      embeddable_asset_count: 0,
    });
    expect(noResult.engagement_intent).toBe(1);
    expect(noResult.opportunity_score).toBe(50);

    expect(
      rankOpportunityScores([
        { aggregation_key: "z", searches: 10, unique_anonymous_sessions: 5, opportunity_score: 10 },
        { aggregation_key: "a", searches: 10, unique_anonymous_sessions: 5, opportunity_score: 10 },
        {
          aggregation_key: "null",
          searches: 100,
          unique_anonymous_sessions: 50,
          opportunity_score: null,
        },
      ]).map((row) => row.aggregation_key),
    ).toEqual(["a", "z", "null"]);
  });
});
