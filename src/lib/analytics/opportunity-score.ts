import { demandQueryNormalizationVersion } from "../search/normalize-demand-query";

export const opportunityScoreVersion = "opportunity-v1" as const;

export type OpportunityScoreStatus = "scored" | "insufficient_data" | "unavailable";

export type OpportunityScoreInput = {
  normalization_version: typeof demandQueryNormalizationVersion;
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  unique_anonymous_sessions: number;
  result_count_distribution: Record<string, number>;
  no_result_searches: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
  safe_asset_count: number;
  embeddable_asset_count: number;
};

export type OpportunityScoreResult = {
  status: OpportunityScoreStatus;
  reason_code: string | null;
  median_result_count: number | null;
  demand_points: number | null;
  scarcity_points: number | null;
  engagement_intent: number | null;
  opportunity_score: number | null;
  explanation: Record<string, unknown>;
};

type ValidatedDistribution = {
  counts: Array<[number, number]>;
  zeroResults: number;
};

const demandBands = [
  { points: 5, searches: 100, sessions: 50 },
  { points: 4, searches: 50, sessions: 25 },
  { points: 3, searches: 25, sessions: 10 },
  { points: 2, searches: 10, sessions: 5 },
  { points: 1, searches: 5, sessions: 3 },
] as const;

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function roundFactor(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function validateDistribution(
  distribution: Record<string, number>,
  searches: number,
  noResultSearches: number,
): { value: ValidatedDistribution | null; reason: string | null } {
  if (!distribution || typeof distribution !== "object" || Array.isArray(distribution)) {
    return { value: null, reason: "invalid_result_distribution" };
  }
  const counts: Array<[number, number]> = [];
  let total = 0;
  for (const [rawCount, occurrences] of Object.entries(distribution)) {
    const count = Number(rawCount);
    if (
      !/^\d+$/u.test(rawCount) ||
      String(count) !== rawCount ||
      !isNonNegativeInteger(occurrences)
    ) {
      return { value: null, reason: "invalid_result_distribution" };
    }
    counts.push([count, occurrences]);
    total += occurrences;
  }
  const zeroResults = distribution["0"] ?? 0;
  if (
    !isNonNegativeInteger(searches) ||
    !isNonNegativeInteger(noResultSearches) ||
    total !== searches ||
    zeroResults !== noResultSearches
  ) {
    return { value: null, reason: "invalid_result_distribution" };
  }
  counts.sort(([left], [right]) => left - right);
  return { value: { counts, zeroResults }, reason: null };
}

function validateRequiredCounts(input: OpportunityScoreInput): string | null {
  if (input.normalization_version !== demandQueryNormalizationVersion) {
    return "unsupported_normalization_version";
  }
  if (!input.aggregation_key || !input.display_query) return "missing_required_input";
  const values = [
    input.searches,
    input.unique_anonymous_sessions,
    input.no_result_searches,
    input.asset_clicks,
    input.embed_copies,
    input.citation_copies,
    input.safe_asset_count,
    input.embeddable_asset_count,
  ];
  return values.every(isNonNegativeInteger) ? null : "invalid_count_input";
}

export function lowerWeightedMedian(
  distribution: Record<string, number>,
  searches: number,
): number {
  const validated = validateDistribution(distribution, searches, distribution["0"] ?? 0).value;
  if (!validated || searches === 0) return 0;
  const threshold = Math.ceil(searches / 2);
  let cumulative = 0;
  for (const [resultCount, occurrences] of validated.counts) {
    cumulative += occurrences;
    if (cumulative >= threshold) return resultCount;
  }
  return 0;
}

export function demandPoints(searches: number, sessions: number): number {
  return (
    demandBands.find((band) => searches >= band.searches && sessions >= band.sessions)?.points ?? 0
  );
}

export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScoreResult {
  const requiredReason = validateRequiredCounts(input);
  if (requiredReason) return unavailable(requiredReason);
  const distribution = validateDistribution(
    input.result_count_distribution,
    input.searches,
    input.no_result_searches,
  );
  if (!distribution.value) return unavailable(distribution.reason ?? "invalid_result_distribution");

  const median = lowerWeightedMedian(input.result_count_distribution, input.searches);
  const points = demandPoints(input.searches, input.unique_anonymous_sessions);
  const noResultRate = input.searches === 0 ? 0 : input.no_result_searches / input.searches;
  const scarcity = Math.min(
    5,
    1 +
      (input.safe_asset_count === 0 ? 2 : input.safe_asset_count <= 2 ? 1 : 0) +
      (input.embeddable_asset_count === 0 ? 1 : input.embeddable_asset_count === 1 ? 0.5 : 0) +
      (noResultRate >= 0.5 || median === 0 ? 1 : noResultRate >= 0.2 || median <= 3 ? 0.5 : 0),
  );
  const clickRate = input.searches === 0 ? 0 : input.asset_clicks / input.searches;
  const copyRate =
    input.searches === 0 ? 0 : (input.embed_copies + input.citation_copies) / input.searches;
  const engagement = roundFactor(1 + Math.min(0.5, clickRate) + Math.min(0.5, 2 * copyRate));
  const explanation = {
    version: opportunityScoreVersion,
    demand: {
      points,
      searches: input.searches,
      unique_anonymous_sessions: input.unique_anonymous_sessions,
    },
    scarcity: {
      points: scarcity,
      safe_asset_count: input.safe_asset_count,
      embeddable_asset_count: input.embeddable_asset_count,
      no_result_rate: roundFactor(noResultRate),
      median_result_count: median,
    },
    engagement: {
      multiplier: engagement,
      click_rate: roundFactor(clickRate),
      copy_rate: roundFactor(copyRate),
    },
  };

  if (input.searches < 5 || input.unique_anonymous_sessions < 3) {
    return {
      status: "insufficient_data",
      reason_code: "minimum_sample_not_met",
      median_result_count: median,
      demand_points: points,
      scarcity_points: scarcity,
      engagement_intent: engagement,
      opportunity_score: null,
      explanation,
    };
  }

  const opportunityScore = Math.round(Math.min(100, points * scarcity * engagement * 2));
  return {
    status: "scored",
    reason_code: null,
    median_result_count: median,
    demand_points: points,
    scarcity_points: scarcity,
    engagement_intent: engagement,
    opportunity_score: opportunityScore,
    explanation,
  };
}

export type OpportunityRankRow = {
  aggregation_key: string;
  searches: number;
  unique_anonymous_sessions: number;
  opportunity_score: number | null;
};

function binaryCompare(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function rankOpportunityScores<T extends OpportunityRankRow>(rows: T[]): T[] {
  return [...rows].sort(
    (left, right) =>
      (right.opportunity_score ?? -1) - (left.opportunity_score ?? -1) ||
      right.unique_anonymous_sessions - left.unique_anonymous_sessions ||
      right.searches - left.searches ||
      binaryCompare(left.aggregation_key, right.aggregation_key),
  );
}

function unavailable(reasonCode: string): OpportunityScoreResult {
  return {
    status: "unavailable",
    reason_code: reasonCode,
    median_result_count: null,
    demand_points: null,
    scarcity_points: null,
    engagement_intent: null,
    opportunity_score: null,
    explanation: { version: opportunityScoreVersion, reason_code: reasonCode },
  };
}
