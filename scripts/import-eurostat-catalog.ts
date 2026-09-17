import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

import {
  buildEurostatImportPlan,
  buildEurostatImportSql,
} from "../src/lib/ingest/eurostat-import-runner";
import {
  EUROSTAT_POLICY_URL,
  EUROSTAT_METABASE_URL,
  EurostatSourceClient,
  fetchEurostatCatalogue,
  selectEurostatCatalogueCandidates,
  type EurostatAssetFetch,
  type EurostatBatchFailure,
} from "../src/lib/ingest/eurostat-source-client";

const execFileAsync = promisify(execFile);
const DEFAULT_MARKETPLACE_ORIGIN = "https://publisher-asset-marketplace.shuu9599.workers.dev";
const DEFAULT_TARGET = 1_000;
const DEFAULT_MAX_CANDIDATES = 1_500;
const DEFAULT_BATCH_SIZE = 50;
const AUTOMATED_REVIEW_VERSION = "eurostat-automated-policy-v1";
const EMBED_REVIEW_VERSION = "eurostat-marketplace-embed-v2";
const MAX_METABASE_DECOMPRESSED_BYTES = 64 * 1024 * 1024;

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function integerOption(args: string[], name: string, fallback: number): number {
  const value = optionValue(args, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

async function applyWithWrangler(sqlPath: string, target: "remote" | "local"): Promise<void> {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
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
  if (stdout.trim() !== "") process.stdout.write(stdout);
  if (stderr.trim() !== "") process.stderr.write(stderr);
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchMetabaseEligibleCodes(): Promise<Set<string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(EUROSTAT_METABASE_URL, {
      headers: {
        accept: "application/octet-stream",
        "accept-encoding": "identity",
        "user-agent": "publisher-asset-marketplace/0.1",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Eurostat metabase request returned HTTP ${response.status}`);
    const compressed = Buffer.from(await response.arrayBuffer());
    if (compressed.byteLength > MAX_METABASE_DECOMPRESSED_BYTES) {
      throw new Error("Eurostat metabase response exceeded the bounded size");
    }
    const isGzip = compressed.byteLength >= 2 && compressed[0] === 0x1f && compressed[1] === 0x8b;
    const decompressed = isGzip ? gunzipSync(compressed) : compressed;
    if (decompressed.byteLength > MAX_METABASE_DECOMPRESSED_BYTES) {
      throw new Error("Eurostat metabase decompressed response exceeded the bounded size");
    }
    const dimensions = new Map<string, { geo: boolean; time: boolean }>();
    for (const line of decompressed.toString("utf8").split(/\r?\n/u)) {
      const [code, dimension, position] = line.split("\t");
      if (!code || !dimension) continue;
      const state = dimensions.get(code) ?? { geo: false, time: false };
      if (dimension === "geo" && position === "EU27_2020") state.geo = true;
      if (dimension === "time") state.time = true;
      dimensions.set(code, state);
    }
    return new Set(
      [...dimensions.entries()]
        .filter(([, state]) => state.geo && state.time)
        .map(([code]) => code),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function buildAutomatedManifest(
  assets: EurostatAssetFetch[],
  reviewedAt: string,
  marketplaceOrigin: string,
) {
  return {
    review_version: `eurostat-catalog-${reviewedAt.slice(0, 10)}`,
    reviewed_at: reviewedAt,
    review_scope:
      "Automated Eurostat catalogue policy gate: English EU27_2020 observations from 2020 onward, statistical table and dataset products, source and attribution retained, excluded catalogue categories filtered, and marketplace-rendered presentation used instead of an official iframe. This is an automated reuse screen, not a legal opinion; item-level notices remain authoritative.",
    assets: assets.map((asset) => ({
      slug: `eurostat-${asset.datasetCode}`,
      canonical_url: asset.normalized.canonicalUrl,
      chart_owner: "third_party" as const,
      chart_license_code: "EU_COMMISSION_REUSE_2011" as const,
      chart_license_raw: "Eurostat general reuse policy; item-level exceptions apply",
      chart_license_url: EUROSTAT_POLICY_URL,
      chart_license_explicit: true as const,
      manual_review_completed: false,
      automated_review_completed: true,
      automated_review_version: AUTOMATED_REVIEW_VERSION,
      embed_available: false,
      citation_only_allowed: true,
      marketplace_rendered_embed_allowed: true,
      marketplace_embed_url: `${marketplaceOrigin}/embed/eurostat-${asset.datasetCode}`,
      marketplace_embed_origin: marketplaceOrigin,
      embed_review_version: EMBED_REVIEW_VERSION,
      chart_reuse_prohibited: false,
      evidence_conflict: false,
      evidence_url: asset.normalized.canonicalUrl,
      expected_rights_status: "safe" as const,
      expected_raw_data_redistribution: true as const,
      review_note:
        "Automated policy gate passed: Eurostat statistical data, English EU27_2020 selection, observations from 2020 onward, commercial reuse with attribution, and no excluded catalogue category detected. The marketplace renders a customised table and disclaims Eurostat endorsement and responsibility.",
      citation_text: asset.normalized.citationText,
      attribution_name: "Eurostat",
      attribution_url: asset.normalized.attributionUrl,
    })),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const reviewedRights = args.includes("--reviewed-rights");
  const remote = args.includes("--remote");
  const local = args.includes("--local");
  const target = integerOption(args, "--target", DEFAULT_TARGET);
  const start = integerOption(args, "--start", 0);
  const maxCandidates = integerOption(args, "--max-candidates", DEFAULT_MAX_CANDIDATES);
  const batchSize = Math.max(1, integerOption(args, "--batch-size", DEFAULT_BATCH_SIZE));
  const manifestOutput = optionValue(args, "--manifest-out");
  const sqlOutput = optionValue(args, "--sql-out");
  const marketplaceOrigin = (process.env.MARKETPLACE_ORIGIN ?? DEFAULT_MARKETPLACE_ORIGIN).replace(
    /\/$/u,
    "",
  );

  if (target === 0) throw new Error("--target must be greater than zero");
  if (apply && !reviewedRights) {
    throw new Error("--apply requires --reviewed-rights");
  }
  if (apply && remote === local) {
    throw new Error("--apply requires exactly one target: --remote or --local");
  }
  const marketplaceUrl = new URL(marketplaceOrigin);
  if (marketplaceUrl.protocol !== "https:" || marketplaceUrl.pathname !== "/") {
    throw new Error("MARKETPLACE_ORIGIN must be an HTTPS origin without a path");
  }

  const catalogue = await fetchEurostatCatalogue();
  const metabaseEligibleCodes = await fetchMetabaseEligibleCodes();
  const candidates = selectEurostatCatalogueCandidates(catalogue, {
    start,
    limit: maxCandidates,
  }).filter((entry) => metabaseEligibleCodes.has(entry.code));
  if (candidates.length === 0)
    throw new Error("Eurostat catalogue produced no eligible candidates");

  const sourceClient = new EurostatSourceClient({
    concurrency: 3,
    timeoutMs: 10_000,
    maxAttempts: 2,
  });
  const successful: EurostatAssetFetch[] = [];
  const failed: EurostatBatchFailure[] = [];
  for (const [index, batch] of chunks(candidates, batchSize).entries()) {
    const result = await sourceClient.fetchAssets(batch.map((entry) => entry.code));
    successful.push(...result.successful);
    failed.push(...result.failed);
    process.stdout.write(
      `${JSON.stringify({
        event: "eurostat_catalog_batch",
        batch: index + 1,
        batches: Math.ceil(candidates.length / batchSize),
        candidates: candidates.length,
        successful: successful.length,
        failed: failed.length,
        target,
      })}\n`,
    );
    if (successful.length >= target) break;
  }

  const selected = successful
    .sort((left, right) => left.datasetCode.localeCompare(right.datasetCode))
    .slice(0, target);
  if (selected.length < target) {
    throw new Error(
      `Eurostat catalogue produced only ${selected.length} reviewed samples after ${candidates.length} candidates; increase --max-candidates or inspect the failure report`,
    );
  }
  const selectedCodes = selected.map((asset) => asset.datasetCode);
  const reviewedAt = new Date().toISOString();
  const plan = buildEurostatImportPlan(selectedCodes, {
    successful: selected,
    failed: [],
  });
  const manifest = buildAutomatedManifest(selected, reviewedAt, marketplaceOrigin);
  const summary = {
    event: "eurostat_catalog_plan",
    runId: plan.run_id,
    catalogueEntries: catalogue.length,
    metabaseEligibleCodes: metabaseEligibleCodes.size,
    candidates: candidates.length,
    requested: target,
    accepted: plan.assets.length,
    fetchFailures: failed.length,
    databaseWritten: false,
    manifest: manifestOutput ?? null,
  };

  if (manifestOutput)
    await writeFile(resolve(manifestOutput), `${JSON.stringify(manifest, null, 2)}\n`);
  let tempDirectory: string | undefined;
  try {
    let sqlPath = sqlOutput ? resolve(sqlOutput) : undefined;
    if (sqlPath) await writeFile(sqlPath, buildEurostatImportSql(plan), "utf8");
    if (apply) {
      tempDirectory = await mkdtemp(join(tmpdir(), "publisher-eurostat-catalog-"));
      sqlPath ??= join(tempDirectory, "import.sql");
      await writeFile(sqlPath, buildEurostatImportSql(plan), "utf8");
      await applyWithWrangler(sqlPath, remote ? "remote" : "local");
      summary.databaseWritten = true;
    }
  } finally {
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!apply) {
    process.stdout.write(
      "Dry run only. Use --apply --reviewed-rights --remote and pass --manifest-out to write and review the batch.\n",
    );
  }
}

await main();
