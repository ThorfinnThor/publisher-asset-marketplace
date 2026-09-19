import { searchAssets, type SearchAsset } from "./search-assets";

export type SearchQualityGrade = 0 | 1 | 2;

export type SearchBenchmarkQuery = {
  id: string;
  query: string;
  expectedPath: "fts" | "trigram" | "none";
  expectedOrderPrefix: string[];
  mustExclude: string[];
  minimumTopGrade: SearchQualityGrade;
};

export type SearchBenchmark = {
  contractVersion: string;
  queries: SearchBenchmarkQuery[];
};

export type SearchQualityHumanReview = {
  reviewVersion: string;
  rankingContractVersion: string;
  reviewedAt: string;
  model: string;
  acceptance: {
    minimumStrongAnswerRate: number;
  };
  queryGrades: Array<{
    queryId: string;
    answerable: boolean;
    grade: SearchQualityGrade;
    rationale: string;
  }>;
};

export type SearchQualityCaseResult = {
  id: string;
  query: string;
  answerable: boolean;
  grade: SearchQualityGrade;
  rationale: string;
  expected_path: SearchBenchmarkQuery["expectedPath"];
  observed_paths: Array<"fts" | "trigram" | "browse">;
  expected_order_prefix: string[];
  observed_order: string[];
  contract_passed: boolean;
  failures: string[];
};

export type SearchQualityReviewResult = {
  review_version: string;
  ranking_contract_version: string;
  reviewed_at: string;
  model: string;
  passed: boolean;
  summary: {
    query_count: number;
    contract_passed_count: number;
    answerable_query_count: number;
    strong_answer_count: number;
    strong_answer_rate: number;
  };
  cases: SearchQualityCaseResult[];
};

export async function runSearchQualityReview(
  db: D1Database,
  benchmark: SearchBenchmark,
  humanReview: SearchQualityHumanReview,
  options: { now?: string; resultLimit?: number } = {},
): Promise<SearchQualityReviewResult> {
  validateReviewInputs(benchmark, humanReview);
  const grades = new Map(humanReview.queryGrades.map((entry) => [entry.queryId, entry]));
  const cases: SearchQualityCaseResult[] = [];

  for (const query of benchmark.queries) {
    const review = grades.get(query.id);
    if (!review) {
      throw new Error(`Search-quality review is missing query ${query.id}`);
    }

    const response = await searchAssets(
      db,
      { query: query.query, limit: options.resultLimit ?? 10 },
      { now: options.now ?? humanReview.reviewedAt },
    );
    const observedOrder = response.results.map((result) => result.asset.slug);
    const failures = evaluateContract(query, response.results);
    if (review.grade < query.minimumTopGrade) {
      failures.push(`human grade ${review.grade} is below required grade ${query.minimumTopGrade}`);
    }

    cases.push({
      id: query.id,
      query: query.query,
      answerable: review.answerable,
      grade: review.grade,
      rationale: review.rationale,
      expected_path: query.expectedPath,
      observed_paths: [...new Set(response.results.map((result) => result.retrieval_path))],
      expected_order_prefix: query.expectedOrderPrefix,
      observed_order: observedOrder,
      contract_passed: failures.length === 0,
      failures,
    });
  }

  const answerable = cases.filter((result) => result.answerable);
  const strongAnswers = answerable.filter((result) => result.grade === 2);
  const strongAnswerRate = answerable.length === 0 ? 0 : strongAnswers.length / answerable.length;
  const contractPassedCount = cases.filter((result) => result.contract_passed).length;

  return {
    review_version: humanReview.reviewVersion,
    ranking_contract_version: benchmark.contractVersion,
    reviewed_at: humanReview.reviewedAt,
    model: humanReview.model,
    passed:
      contractPassedCount === cases.length &&
      strongAnswerRate >= humanReview.acceptance.minimumStrongAnswerRate,
    summary: {
      query_count: cases.length,
      contract_passed_count: contractPassedCount,
      answerable_query_count: answerable.length,
      strong_answer_count: strongAnswers.length,
      strong_answer_rate: strongAnswerRate,
    },
    cases,
  };
}

function evaluateContract(
  query: SearchBenchmarkQuery,
  results: Array<{ asset: SearchAsset; retrieval_path: "fts" | "trigram" | "browse" }>,
): string[] {
  const failures: string[] = [];
  const observedOrder = results.map((result) => result.asset.slug);
  const observedPrefix = observedOrder.slice(0, query.expectedOrderPrefix.length);

  if (!arraysEqual(observedPrefix, query.expectedOrderPrefix)) {
    failures.push(
      `expected order prefix ${formatList(query.expectedOrderPrefix)}, observed ${formatList(observedPrefix)}`,
    );
  }

  const excluded = query.mustExclude.filter((slug) => observedOrder.includes(slug));
  if (excluded.length > 0) {
    failures.push(`ineligible results returned: ${excluded.join(", ")}`);
  }

  if (query.expectedPath === "none") {
    if (results.length > 0) failures.push("expected no result");
  } else if (results[0]?.retrieval_path !== query.expectedPath) {
    failures.push(
      `expected top retrieval path ${query.expectedPath}, observed ${results[0]?.retrieval_path ?? "none"}`,
    );
  }

  return failures;
}

function validateReviewInputs(
  benchmark: SearchBenchmark,
  humanReview: SearchQualityHumanReview,
): void {
  if (humanReview.rankingContractVersion !== benchmark.contractVersion) {
    throw new Error(
      `Review targets ranking ${humanReview.rankingContractVersion}, benchmark is ${benchmark.contractVersion}`,
    );
  }
  if (
    humanReview.acceptance.minimumStrongAnswerRate < 0 ||
    humanReview.acceptance.minimumStrongAnswerRate > 1
  ) {
    throw new Error("minimumStrongAnswerRate must be between 0 and 1");
  }
  const benchmarkIds = benchmark.queries.map((query) => query.id);
  const reviewIds = humanReview.queryGrades.map((entry) => entry.queryId);
  if (new Set(reviewIds).size !== reviewIds.length) {
    throw new Error("Search-quality review contains duplicate query ids");
  }
  const missing = benchmarkIds.filter((id) => !reviewIds.includes(id));
  const unknown = reviewIds.filter((id) => !benchmarkIds.includes(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `Review query ids do not match benchmark (missing: ${formatList(missing)}; unknown: ${formatList(unknown)})`,
    );
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatList(values: string[]): string {
  return values.length === 0 ? "[]" : `[${values.join(", ")}]`;
}
