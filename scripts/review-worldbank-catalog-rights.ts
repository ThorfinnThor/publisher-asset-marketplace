import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildRightsReviewQueries,
  parseRightsReviewManifest,
  prepareRightsReview,
  type RightsReviewAssetRow,
  type RightsReviewManifest,
  type RightsReviewQuery,
} from "../src/lib/rights/rights-review";

const SOURCE_ID = "source_worldbank";
const MAX_D1_ATTEMPTS = 5;

type RemoteD1Result<T> = {
  success?: boolean;
  results?: T[];
  meta?: { rows_written?: number };
};

type RemoteD1Payload<T> = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<RemoteD1Result<T>>;
};

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

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
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
      "World Bank rights review requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID",
    );
  }
  return { accountId, apiToken, databaseId };
}

async function requestD1<T>(body: unknown, label: string): Promise<RemoteD1Payload<T>> {
  const { accountId, apiToken, databaseId } = credentials();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  for (let attempt = 1; attempt <= MAX_D1_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as RemoteD1Payload<T>;
      const failedResult = payload.result?.some((result) => result.success === false);
      if (!response.ok || payload.success !== true || failedResult) {
        const detail = (payload.errors ?? [])
          .map((error) => `${error.code ?? "unknown"}: ${error.message ?? "unknown error"}`)
          .join("; ");
        const error = new Error(`${label}: ${detail || response.statusText}`) as Error & {
          status?: number;
        };
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (attempt === MAX_D1_ATTEMPTS || (status !== undefined && status !== 429 && status < 500)) {
        throw error;
      }
      await sleep(attempt * 1_000);
    }
  }
  throw new Error(`${label}: retry budget exhausted`);
}

async function readRows(slugs: string[]): Promise<RightsReviewAssetRow[]> {
  const placeholders = slugs.map(() => "?").join(", ");
  const sql = `SELECT id, slug, canonical_url, citation_text, attribution_name, attribution_url, embed_url, embed_origin, rights_status, status, metadata_json
    FROM assets WHERE source_id = ? AND slug IN (${placeholders}) ORDER BY slug`;
  const payload = await requestD1<RightsReviewAssetRow>(
    { sql, params: [SOURCE_ID, ...slugs] },
    `read ${slugs.length} World Bank assets`,
  );
  return payload.result?.[0]?.results ?? [];
}

async function applyQueries(queries: RightsReviewQuery[], label: string): Promise<number> {
  const payload = await requestD1<never>({ batch: queries }, label);
  return (payload.result ?? []).reduce(
    (total, result) => total + (result.meta?.rows_written ?? 0),
    0,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const manifestPath = optionValue(args, "--manifest");
  if (!manifestPath || !args.includes("--remote")) {
    throw new Error(
      "Usage: npm run rights:worldbank-catalog -- --manifest <manifest.json> --remote [--batch-size 25] [--apply --publish]",
    );
  }
  const apply = args.includes("--apply");
  const publish = args.includes("--publish");
  if (publish && !apply) throw new Error("--publish requires --apply");
  credentials();

  const manifest = parseRightsReviewManifest(
    JSON.parse(await readFile(resolve(manifestPath), "utf8")),
  );
  const batchSize = integerOption(args, "--batch-size", 25, 1);
  let rowsWritten = 0;
  let reviewed = 0;
  let safe = 0;

  for (const [index, assets] of chunks(manifest.assets, batchSize).entries()) {
    const rows = await readRows(assets.map((asset) => asset.slug));
    if (rows.length !== assets.length) {
      throw new Error(
        `World Bank review batch ${index + 1} expected ${assets.length} database rows but found ${rows.length}`,
      );
    }
    const batchManifest: RightsReviewManifest = { ...manifest, assets };
    const plan = prepareRightsReview(rows, batchManifest, { publish });
    if (apply) {
      rowsWritten += await applyQueries(
        buildRightsReviewQueries(plan),
        `apply World Bank rights batch ${index + 1}`,
      );
    }
    reviewed += plan.counts.reviewed;
    safe += plan.counts.safe;
    process.stdout.write(
      `${JSON.stringify({ event: "worldbank_rights_batch", batch: index + 1, batches: Math.ceil(manifest.assets.length / batchSize), reviewed, safe, rowsWritten })}\n`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        reviewVersion: manifest.review_version,
        reviewed,
        safe,
        publishRequested: publish,
        databaseWritten: apply,
        rowsWritten,
      },
      null,
      2,
    )}\n`,
  );
}

await main();
