import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  parseWorldBankCatalogPage,
  reviewWorldBankIndicatorMetadata,
  selectWorldBankCatalogCandidates,
  type WorldBankCatalogEntry,
  type WorldBankMetadataReview,
} from "../src/lib/ingest/worldbank-catalog";
import { prepareWorldBankImport } from "../src/lib/ingest/worldbank-import-runner";
import {
  buildImportSql,
  type ImportAssetRecord,
  type ImportPlan,
} from "../src/lib/ingest/import-runner";
import { rebuildSelectedAssetSearchTrigramsSql } from "../src/lib/search/search-index";
import type {
  RightsReviewManifest,
  RightsReviewManifestAsset,
} from "../src/lib/rights/rights-review";

const execFileAsync = promisify(execFile);
const SOURCE_ID = "source_worldbank";
const CATALOG_URL = "https://api.worldbank.org/v2/indicator";
const DEFAULT_TARGET = 2_600;
const DEFAULT_MAX_CANDIDATES = 4_000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_APPLY_BATCH_SIZE = 25;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_CATALOGUE_RESPONSE_BYTES = 8 * 1024 * 1024;
const REVIEW_VERSION = "worldbank-indicator-metadata-cc-by-v1";
const USER_AGENT =
  "publisher-asset-marketplace/0.1 (World Bank indicator catalogue review; contact: maintainers)";
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

type SelectedAsset = {
  asset: ImportAssetRecord;
  review: RightsReviewManifestAsset;
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

async function fetchJson(
  url: URL,
  label: string,
  maxResponseBytes = MAX_RESPONSE_BYTES,
): Promise<unknown> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
          await sleep(500 * attempt);
          continue;
        }
        throw new Error(`${label} returned HTTP ${response.status}`);
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxResponseBytes) {
        throw new Error(`${label} exceeded the bounded response size`);
      }
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${label} retry budget exhausted`);
}

async function fetchCatalogue(): Promise<WorldBankCatalogEntry[]> {
  const all: WorldBankCatalogEntry[] = [];
  let page = 1;
  let pages = 1;
  do {
    const url = new URL(CATALOG_URL);
    url.searchParams.set("format", "json");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "10000");
    const parsed = parseWorldBankCatalogPage(
      await fetchJson(url, `World Bank catalogue page ${page}`, MAX_CATALOGUE_RESPONSE_BYTES),
    );
    all.push(...parsed.entries);
    pages = parsed.pages;
    page += 1;
  } while (page <= pages);
  return all;
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(values[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function reviewMetadata(
  entry: WorldBankCatalogEntry,
): Promise<{ entry: WorldBankCatalogEntry; review: WorldBankMetadataReview } | null> {
  const url = new URL(
    `https://api.worldbank.org/v2/sources/${encodeURIComponent(entry.sourceId)}/series/${encodeURIComponent(entry.indicator)}/metadata`,
  );
  url.searchParams.set("format", "json");
  try {
    const review = reviewWorldBankIndicatorMetadata(
      entry.indicator,
      await fetchJson(url, `World Bank metadata ${entry.indicator}`),
    );
    return review ? { entry, review } : null;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ event: "worldbank_metadata_failed", indicator: entry.indicator, message: error instanceof Error ? error.message : String(error) })}\n`,
    );
    return null;
  }
}

function manifestAsset(
  asset: ImportAssetRecord,
  entry: WorldBankCatalogEntry,
  review: WorldBankMetadataReview,
): RightsReviewManifestAsset {
  return {
    slug: asset.slug,
    canonical_url: asset.canonical_url,
    chart_owner: "third_party",
    chart_license_code: "CC_BY",
    chart_license_raw: review.licenseRaw,
    chart_license_url: review.licenseUrl,
    chart_license_explicit: true,
    manual_review_completed: false,
    automated_review_completed: true,
    automated_review_version: REVIEW_VERSION,
    embed_available: false,
    citation_only_allowed: true,
    chart_reuse_prohibited: false,
    evidence_conflict: false,
    evidence_url: asset.canonical_url,
    expected_rights_status: "safe",
    expected_raw_data_redistribution: null,
    citation_text: `World Bank Open Data: ${entry.title} (${entry.indicator}). Source database: ${entry.sourceName}. License: CC BY-4.0.`,
    attribution_name: "World Bank Open Data",
    attribution_url: asset.canonical_url,
    review_note:
      "The official indicator-specific World Bank metadata API explicitly reports CC BY-4.0 and an HTTPS license URL. Automated restriction-keyword screening passed. This approval enables listing, citation and source-link actions only; no official embed or raw-data redistribution is approved, and no World Bank endorsement is implied.",
  };
}

async function applySql(sql: string, label: string): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "publisher-worldbank-catalog-"));
  const sqlPath = join(directory, `${label}.sql`);
  try {
    await writeFile(sqlPath, sql, "utf8");
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const { stdout, stderr } = await execFileAsync(
      npx,
      [
        "wrangler",
        "d1",
        "execute",
        "DB",
        "--remote",
        "--file",
        sqlPath,
        "--config",
        "wrangler.jsonc",
        "--yes",
      ],
      { maxBuffer: 30 * 1024 * 1024 },
    );
    if (stdout.trim() !== "") process.stdout.write(stdout);
    if (stderr.trim() !== "") process.stderr.write(stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = integerOption(args, "--target", DEFAULT_TARGET, 1);
  const maxCandidates = integerOption(args, "--max-candidates", DEFAULT_MAX_CANDIDATES, target);
  const batchSize = integerOption(args, "--batch-size", DEFAULT_BATCH_SIZE, 1);
  const applyBatchSize = integerOption(args, "--apply-batch-size", DEFAULT_APPLY_BATCH_SIZE, 1);
  const metadataConcurrency = integerOption(args, "--metadata-concurrency", 8, 1);
  const manifestOutput = optionValue(args, "--manifest-out");
  const apply = args.includes("--apply");
  const remote = args.includes("--remote");
  if (apply !== remote) {
    throw new Error("Database writes require both --apply and --remote; omit both for a dry run");
  }
  if (apply && !manifestOutput) {
    throw new Error("--apply requires --manifest-out so every imported asset has review evidence");
  }

  const catalogue = await fetchCatalogue();
  const candidates = selectWorldBankCatalogCandidates(catalogue, maxCandidates);
  const selected: SelectedAsset[] = [];
  let explicitLicenseCount = 0;
  let dataFailures = 0;

  for (const [batchIndex, batch] of chunks(candidates, batchSize).entries()) {
    const reviewed = (
      await mapConcurrent(batch, metadataConcurrency, (entry) => reviewMetadata(entry))
    ).filter(
      (value): value is { entry: WorldBankCatalogEntry; review: WorldBankMetadataReview } =>
        value !== null,
    );
    explicitLicenseCount += reviewed.length;
    if (reviewed.length > 0) {
      const importPlan = await prepareWorldBankImport(reviewed.map(({ entry }) => entry.indicator));
      dataFailures += importPlan.counts.errors;
      const assetByIndicator = new Map(
        importPlan.assets.map(
          (asset) => [asset.external_id?.toLocaleUpperCase("en"), asset] as const,
        ),
      );
      for (const item of reviewed) {
        const asset = assetByIndicator.get(item.entry.indicator.toLocaleUpperCase("en"));
        if (!asset) continue;
        selected.push({ asset, review: manifestAsset(asset, item.entry, item.review) });
        if (selected.length >= target) break;
      }
    }
    process.stdout.write(
      `${JSON.stringify({ event: "worldbank_catalog_batch", batch: batchIndex + 1, batches: Math.ceil(candidates.length / batchSize), reviewedCandidates: Math.min((batchIndex + 1) * batchSize, candidates.length), explicitLicenseCount, selected: selected.length, dataFailures, target })}\n`,
    );
    if (selected.length >= target) break;
  }

  if (selected.length < target) {
    throw new Error(
      `World Bank catalogue produced only ${selected.length} data-backed CC BY-4.0 indicators; increase --max-candidates or inspect failures`,
    );
  }

  const reviewedAt = new Date().toISOString();
  const manifest: RightsReviewManifest = {
    review_version: `${REVIEW_VERSION}-${reviewedAt.slice(0, 10)}`,
    reviewed_at: reviewedAt,
    review_scope:
      "Automated indicator-level World Bank metadata review: exact CC BY-4.0 license, HTTPS license URL, no explicit restriction keywords, successful public data API response, citation/source-link publication only, no official embed or raw-data redistribution.",
    assets: selected.map((item) => item.review),
  };
  if (manifestOutput) {
    await writeFile(resolve(manifestOutput), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  if (apply) {
    const assetChunks = chunks(selected, applyBatchSize);
    for (const [index, assetChunk] of assetChunks.entries()) {
      const runId = `ingest_worldbank_catalog_${reviewedAt.replace(/[^0-9]/gu, "").slice(0, 17)}_${String(index + 1).padStart(4, "0")}`;
      const plan: ImportPlan = {
        run_id: runId,
        source_id: SOURCE_ID,
        started_at: reviewedAt,
        completed_at: reviewedAt,
        status: "succeeded",
        assets: assetChunk.map((item) => item.asset),
        results: assetChunk.map((item, resultIndex) => ({
          id: `ingest_result_${runId}_${resultIndex}`,
          external_id: item.asset.external_id,
          status: "upserted",
          reason_code: null,
          detail_json: JSON.stringify({
            indicator: item.asset.external_id,
            rights_status: item.asset.rights_status,
          }),
          created_at: reviewedAt,
        })),
        counts: {
          accepted: assetChunk.length,
          duplicates: 0,
          invalid: 0,
          errors: 0,
        },
      };
      await applySql(
        `${buildImportSql(plan, { rebuildSearchIndex: false })}\n${rebuildSelectedAssetSearchTrigramsSql(
          assetChunk.map((item) => item.asset.id),
        )}\n`,
        `batch-${index + 1}`,
      );
      process.stdout.write(
        `${JSON.stringify({ event: "worldbank_catalog_d1_batch", batch: index + 1, batches: assetChunks.length, assets: assetChunk.length })}\n`,
      );
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        event: "worldbank_catalog_complete",
        catalogueEntries: catalogue.length,
        candidates: candidates.length,
        explicitLicenseCount,
        selected: selected.length,
        dataFailures,
        databaseWritten: apply,
        manifest: manifestOutput ?? null,
      },
      null,
      2,
    )}\n`,
  );
}

await main();
