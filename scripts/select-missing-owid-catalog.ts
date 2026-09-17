import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { selectMissingOwidAssets, owidAssetsToCsv } from "../src/lib/ingest/owid-catalog-selection";
import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";

const SOURCE_ID = "source_owid";
const MAX_D1_ATTEMPTS = 5;

type ExistingAssetRow = { slug: string };
type D1Payload = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{ success?: boolean; results?: ExistingAssetRow[] }>;
};

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function credentials(): { accountId: string; apiToken: string; databaseId: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Remote OWID selection requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID",
    );
  }
  return { accountId, apiToken, databaseId };
}

async function existingOwidSlugs(): Promise<Set<string>> {
  const { accountId, apiToken, databaseId } = credentials();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  for (let attempt = 1; attempt <= MAX_D1_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "SELECT slug FROM assets WHERE source_id = ? ORDER BY slug",
          params: [SOURCE_ID],
        }),
      });
      const payload = (await response.json()) as D1Payload;
      if (
        !response.ok ||
        payload.success !== true ||
        payload.result?.some((result) => result.success === false)
      ) {
        const detail = (payload.errors ?? [])
          .map((error) => `${error.code ?? "unknown"}: ${error.message ?? "unknown error"}`)
          .join("; ");
        const error = new Error(detail || response.statusText) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return new Set((payload.result?.[0]?.results ?? []).map((row) => row.slug));
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (attempt === MAX_D1_ATTEMPTS || (status !== undefined && status !== 429 && status < 500)) {
        throw error;
      }
      await sleep(attempt * 1_000);
    }
  }
  throw new Error("D1 retry budget exhausted");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const outputPath = optionValue(args, "--output");
  if (!inputPath || !outputPath || !args.includes("--remote")) {
    throw new Error(
      "Usage: npm run ingest:owid:missing -- <catalog.csv|json|txt> --remote --output <missing.csv>",
    );
  }
  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (extension !== "csv" && extension !== "json" && extension !== "txt") {
    throw new Error("OWID catalogue input must be CSV, JSON, or TXT");
  }
  const normalized = normalizeOwidInput(await readFile(resolve(inputPath), "utf8"), extension);
  if (normalized.invalid.length > 0 || normalized.duplicates.length > 0) {
    throw new Error("OWID catalogue input must not contain invalid or duplicate rows");
  }
  const existing = await existingOwidSlugs();
  const missing = selectMissingOwidAssets(normalized.accepted, existing);
  await writeFile(resolve(outputPath), owidAssetsToCsv(missing), "utf8");
  process.stdout.write(
    `${JSON.stringify({ catalogueAssets: normalized.accepted.length, existingAssets: existing.size, missingAssets: missing.length, output: resolve(outputPath) }, null, 2)}\n`,
  );
}

await main();
