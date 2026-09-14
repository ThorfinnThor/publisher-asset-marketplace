import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format } from "prettier";

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
} from "./lib/search-benchmark-db";

type BenchmarkDocument = SearchBenchmark & {
  fixtureAssets: SearchBenchmarkAssetFixture[];
};

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function renderSearchQualityMarkdown(result: SearchQualityReviewResult): string {
  const percent = Math.round(result.summary.strong_answer_rate * 100);
  const rows = result.cases
    .map((entry) => {
      const actual = entry.observed_order.slice(0, 3).join(", ") || "—";
      const path = entry.observed_paths.join(" + ") || "none";
      return `| ${entry.id} | ${entry.grade} | ${entry.contract_passed ? "pass" : "fail"} | ${path} | ${actual} |`;
    })
    .join("\n");
  const rationales = result.cases
    .map((entry) => `- \`${entry.id}\` — ${entry.rationale}`)
    .join("\n");
  const failures = result.cases
    .filter((entry) => entry.failures.length > 0)
    .flatMap((entry) => entry.failures.map((failure) => `- \`${entry.id}\`: ${failure}`));

  return `# C8 search-quality review

- Review version: ${result.review_version}
- Ranking contract: ${result.ranking_contract_version}
- Review model: ${result.model}
- Review time: ${result.reviewed_at}
- Deterministic benchmark: **${result.passed ? "PASS" : "FAIL"}**

## Summary

- Contract cases passed: ${result.summary.contract_passed_count}/${result.summary.query_count}
- Strong answers among answerable queries: ${result.summary.strong_answer_count}/${result.summary.answerable_query_count} (${percent}%)
- The intentionally out-of-corpus query is graded 0 but passes the retrieval contract by returning no result.

## Results

| Query | Grade | Contract | Retrieval | Top results |
| ----- | ----: | -------- | --------- | ----------- |
${rows}

## Human review rationale

${rationales}

## Production corpus finding

The Cloudflare production D1 database contained zero assets at review time. This is consistent
with the closed Gate B rights audit: the ten fetched OWID seed assets are still \`unknown\` and
\`draft\`, so none may be exposed by public search. The ranking implementation passes against the
versioned fixture corpus, but Gate C remains closed until chart-specific rights evidence is
reviewed and at least a useful seed set is safely published.

## Failures

${failures.length > 0 ? failures.join("\n") : "None."}

## Reproduce

\`\`\`bash
npm run search:review
\`\`\`

The command runs the production search function and SQL against an isolated in-memory SQLite FTS5
database populated from \`data/benchmarks/search-ranking-v1.json\`. It does not write to Cloudflare.
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const output = optionValue(args, "--output");
  const json = args.includes("--json");
  const benchmark = benchmarkJson as BenchmarkDocument;
  const humanReview = humanReviewJson as SearchQualityHumanReview;
  const fixtureDatabase = await createSearchBenchmarkDatabase(benchmark.fixtureAssets);

  try {
    const result = await runSearchQualityReview(fixtureDatabase.db, benchmark, humanReview);
    const raw = json ? `${JSON.stringify(result, null, 2)}\n` : renderSearchQualityMarkdown(result);
    const rendered = json ? raw : await format(raw, { parser: "markdown" });
    if (output) {
      const previous = await readFile(resolve(output), "utf8").catch(() => null);
      if (previous !== rendered) await writeFile(resolve(output), rendered, "utf8");
    }
    process.stdout.write(rendered);
    if (!result.passed) process.exitCode = 2;
  } finally {
    fixtureDatabase.close();
  }
}

await main();
