import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";

const supportedFormats = new Set(["csv", "json", "txt"] as const);

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run ingest:dry-run -- <input.csv|input.json|input.txt>");
  }

  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (!supportedFormats.has(extension as "csv" | "json" | "txt")) {
    throw new Error("Input must be CSV, JSON, or TXT");
  }

  const content = await readFile(resolve(inputPath), "utf8");
  const report = normalizeOwidInput(content, extension as "csv" | "json" | "txt");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.invalid.length > 0) {
    process.exitCode = 1;
  }
}

await main();
