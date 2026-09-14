import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";
import { OwidSourceClient } from "../src/lib/ingest/owid-source-client";

const supportedFormats = new Set(["csv", "json", "txt"] as const);

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const jsonOutput = process.argv.includes("--json");
  if (!inputPath) {
    throw new Error("Usage: npm run ingest:fetch -- <input.csv|input.json|input.txt> [--json]");
  }

  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (!supportedFormats.has(extension as "csv" | "json" | "txt")) {
    throw new Error("Input must be CSV, JSON, or TXT");
  }

  const content = await readFile(resolve(inputPath), "utf8");
  const normalized = normalizeOwidInput(content, extension as "csv" | "json" | "txt");
  const client = new OwidSourceClient({ concurrency: 4 });
  const fetched = await client.fetchAssets(normalized.accepted.map((asset) => asset.slug));
  const result = {
    input: inputPath,
    accepted: normalized.accepted.length,
    duplicates: normalized.duplicates.length,
    invalid: normalized.invalid,
    fetched: fetched.successful.map((asset) => ({
      slug: asset.slug,
      normalized: asset.normalized,
      raw: asset.raw,
    })),
    failed: fetched.failed,
  };

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${JSON.stringify(
        {
          input: result.input,
          accepted: result.accepted,
          duplicates: result.duplicates,
          invalid: result.invalid.length,
          fetched: result.fetched.length,
          failed: result.failed.length,
          failedSlugs: result.failed.map((failure) => failure.slug),
        },
        null,
        2,
      )}\n`,
    );
  }

  if (normalized.invalid.length > 0 || fetched.failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
