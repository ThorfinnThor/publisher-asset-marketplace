import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { planCorpusBatches } from "../src/lib/ingest/corpus-plan";
import { buildOwidImportSql, prepareOwidImport } from "../src/lib/ingest/import-runner";
import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";
import { rebuildAssetSearchTrigramsSql } from "../src/lib/search/search-index";

const execFileAsync = promisify(execFile);
const supportedFormats = new Set(["csv", "json", "txt"] as const);
const remoteBatchPauseMs = 2_000;
const maxD1Attempts = 5;

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function integerOption(args: string[], name: string, fallback: number, minimum: number): number {
  const raw = optionValue(args, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function commandOutput(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return String(error);
  }
  const candidate = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [candidate.message, candidate.stdout, candidate.stderr]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function retryableD1Import(error: unknown): boolean {
  const output = commandOutput(error);
  return (
    output.includes("D1_RESET_DO") ||
    output.includes("429") ||
    /temporar(?:y|ily) unavailable/i.test(output)
  );
}

async function applySql(sql: string, target: "remote" | "local", label: string): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "publisher-corpus-import-"));
  const sqlPath = join(directory, `${label}.sql`);
  try {
    await writeFile(sqlPath, sql, "utf8");
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    for (let attempt = 1; attempt <= maxD1Attempts; attempt += 1) {
      try {
        const { stdout, stderr } = await execFileAsync(
          npx,
          [
            "wrangler",
            "d1",
            "execute",
            "DB",
            `--${target}`,
            "--file",
            sqlPath,
            "--config",
            "wrangler.jsonc",
            "--yes",
          ],
          { maxBuffer: 30 * 1024 * 1024 },
        );
        if (stdout.trim() !== "") {
          process.stdout.write(stdout);
        }
        if (stderr.trim() !== "") {
          process.stderr.write(stderr);
        }
        return;
      } catch (error) {
        if (!retryableD1Import(error) || attempt === maxD1Attempts) {
          throw error;
        }
        const delayMs = remoteBatchPauseMs * attempt;
        process.stderr.write(
          `${JSON.stringify({ event: "d1_import_retry", label, attempt, delayMs })}\n`,
        );
        await sleep(delayMs);
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const apply = args.includes("--apply");
  const remote = args.includes("--remote");
  const local = args.includes("--local");

  if (!inputPath) {
    throw new Error(
      "Usage: npm run ingest:corpus -- <input.csv|input.json|input.txt> [--expected-count 3000] [--batch-size 25] [--start 0] [--limit 3000] [--apply --remote|--local]",
    );
  }
  if (apply && remote === local) {
    throw new Error("--apply requires exactly one target: --remote or --local");
  }
  if (!apply && (remote || local)) {
    throw new Error("--remote and --local are only valid with --apply");
  }

  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (!supportedFormats.has(extension as "csv" | "json" | "txt")) {
    throw new Error("Input must be CSV, JSON, or TXT");
  }

  const content = await readFile(resolve(inputPath), "utf8");
  const format = extension as "csv" | "json" | "txt";
  const report = normalizeOwidInput(content, format);
  const expectedCount = integerOption(args, "--expected-count", report.accepted.length, 1);
  if (report.invalid.length > 0 || report.duplicates.length > 0) {
    throw new Error(
      `Corpus input must be clean before import: ${report.invalid.length} invalid, ${report.duplicates.length} duplicate`,
    );
  }
  if (report.accepted.length !== expectedCount) {
    throw new Error(
      `Corpus count mismatch: expected ${expectedCount}, normalized ${report.accepted.length}`,
    );
  }

  const start = integerOption(args, "--start", 0, 0);
  const limit = integerOption(args, "--limit", report.accepted.length - start, 0);
  const batchSize = integerOption(args, "--batch-size", 25, 1);
  const batchPlan = planCorpusBatches(report, {
    start,
    limit,
    batch_size: batchSize,
  });

  if (!apply) {
    process.stdout.write(
      `${JSON.stringify(
        {
          databaseWritten: false,
          accepted: report.accepted.length,
          duplicates: report.duplicates.length,
          invalid: report.invalid.length,
          selectedStart: batchPlan.selected_start,
          selectedCount: batchPlan.selected_count,
          batches: batchPlan.batches.length,
          batchSize,
        },
        null,
        2,
      )}\n`,
    );
    process.stdout.write(
      "Validated only. Add --apply with exactly one target to fetch and import.\n",
    );
    return;
  }

  const target = remote ? "remote" : "local";
  let accepted = 0;
  let errors = 0;
  let importedBatches = 0;

  for (const [index, batch] of batchPlan.batches.entries()) {
    const batchInput = JSON.stringify(
      batch.map((asset) => ({ asset_url: asset.canonicalUrl, title: asset.title })),
    );
    const plan = await prepareOwidImport(batchInput, "json");
    await applySql(
      buildOwidImportSql(plan, { rebuildSearchIndex: false }),
      target,
      `batch-${index + 1}`,
    );
    accepted += plan.counts.accepted;
    errors += plan.counts.errors;
    importedBatches += 1;
    process.stdout.write(
      `${JSON.stringify({
        event: "batch_complete",
        batch: index + 1,
        batches: batchPlan.batches.length,
        selected: batch.length,
        accepted: plan.counts.accepted,
        errors: plan.counts.errors,
      })}\n`,
    );
    if (target === "remote" && index + 1 < batchPlan.batches.length) {
      await sleep(remoteBatchPauseMs);
    }
  }

  await applySql(
    `DELETE FROM asset_search_trigrams;\n${rebuildAssetSearchTrigramsSql.trim()};\n`,
    target,
    "rebuild-search-index",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        databaseWritten: true,
        target,
        corpusAccepted: report.accepted.length,
        selectedStart: batchPlan.selected_start,
        selectedCount: batchPlan.selected_count,
        importedBatches,
        importedAssets: accepted,
        errors,
        searchIndexRebuilt: true,
      },
      null,
      2,
    )}\n`,
  );
  if (errors > 0) {
    process.exitCode = 1;
  }
}

await main();
