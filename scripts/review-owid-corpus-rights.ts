import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";
import { classifyRights, type RightsEvidence } from "../src/lib/rights/classify-rights";
import {
  isOwidChartCanonicalUrl,
  parseOwidChartRightsPage,
} from "../src/lib/rights/owid-chart-rights";
import {
  buildRightsReviewQueries,
  prepareRightsReview,
  type RightsReviewAssetRow,
  type RightsReviewManifest,
  type RightsReviewManifestAsset,
  type RightsReviewPlan,
  type RightsReviewQuery,
} from "../src/lib/rights/rights-review";

const SOURCE_ID = "source_owid";
const REVIEW_VERSION = "owid-jsonld-v1";
const DEFAULT_USER_AGENT =
  "publisher-asset-marketplace/0.1 (OWID chart rights audit; contact: maintainers)";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_HTML_PREFIX_BYTES = 512 * 1024;
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

type FailedReview = {
  slug: string;
  reason: string;
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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function d1Credentials(): { accountId: string; apiToken: string; databaseId: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Remote review requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID",
    );
  }
  return { accountId, apiToken, databaseId };
}

function d1Endpoint(): string {
  const { accountId, databaseId } = d1Credentials();
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
}

async function requestD1<T>(body: unknown, label: string): Promise<RemoteD1Payload<T>> {
  const { apiToken } = d1Credentials();
  for (let attempt = 1; attempt <= MAX_D1_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(d1Endpoint(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
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
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt === MAX_D1_ATTEMPTS) {
        throw error;
      }
      await sleep(1_000 * attempt);
    }
  }
  throw new Error(`${label}: retry budget exhausted`);
}

async function readRows(slugs: string[]): Promise<RightsReviewAssetRow[]> {
  const placeholders = slugs.map(() => "?").join(", ");
  const sql = `SELECT id, slug, canonical_url, citation_text, attribution_name, attribution_url, rights_status, status, metadata_json
    FROM assets
    WHERE source_id = ? AND slug IN (${placeholders})
    ORDER BY slug`;
  const payload = await requestD1<RightsReviewAssetRow>(
    { sql, params: [SOURCE_ID, ...slugs] },
    `read ${slugs.length} OWID assets`,
  );
  return payload.result?.[0]?.results ?? [];
}

async function applyQueries(queries: RightsReviewQuery[], label: string): Promise<number> {
  if (queries.length === 0) {
    return 0;
  }
  const payload = await requestD1<never>({ batch: queries }, label);
  return (payload.result ?? []).reduce(
    (total, result) => total + (result.meta?.rows_written ?? 0),
    0,
  );
}

function metadataEvidence(row: RightsReviewAssetRow): RightsEvidence {
  if (!row.metadata_json) {
    throw new Error("missing_metadata_json");
  }
  let metadata: unknown;
  try {
    metadata = JSON.parse(row.metadata_json);
  } catch {
    throw new Error("invalid_metadata_json");
  }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new Error("invalid_metadata_json");
  }
  const evidence = (metadata as { rights_evidence?: unknown }).rights_evidence;
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    throw new Error("missing_rights_evidence");
  }
  const typed = evidence as RightsEvidence;
  if (!Array.isArray(typed.indicator_evidence)) {
    throw new Error("missing_indicator_rights_evidence");
  }
  return typed;
}

async function readResponsePrefix(response: Response): Promise<string> {
  if (!response.body) {
    return response.text();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (bytes < MAX_HTML_PREFIX_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      const jsonLdStart = html.indexOf("application/ld+json");
      if (jsonLdStart >= 0 && html.indexOf("</script>", jsonLdStart) >= 0) {
        break;
      }
    }
    html += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const jsonLdStart = html.indexOf("application/ld+json");
  if (
    bytes >= MAX_HTML_PREFIX_BYTES &&
    (jsonLdStart < 0 || html.indexOf("</script>", jsonLdStart) < 0)
  ) {
    throw new Error("rights_evidence_prefix_too_large");
  }
  return html;
}

async function fetchRightsPage(canonicalUrl: string): Promise<string> {
  if (!isOwidChartCanonicalUrl(canonicalUrl)) {
    throw new Error("invalid_canonical_url");
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(canonicalUrl, {
        headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "text/html" },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        if (RETRYABLE_STATUSES.has(response.status) && attempt < 3) {
          await sleep(500 * attempt);
          continue;
        }
        throw new Error(`rights_page_http_${response.status}`);
      }
      return await readResponsePrefix(response);
    } catch (error) {
      if (
        attempt === 3 ||
        (error instanceof Error && error.message.startsWith("rights_page_http_"))
      ) {
        throw error;
      }
      await sleep(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("rights_page_retry_exhausted");
}

function manifestAsset(
  row: RightsReviewAssetRow,
  html: string,
  reviewedAt: string,
): RightsReviewManifestAsset {
  const parsed = parseOwidChartRightsPage(html, row.canonical_url);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  const previous = metadataEvidence(row);
  const evidence: RightsEvidence = {
    ...previous,
    chart_owner: parsed.proof.chart_owner,
    chart_license_code: parsed.proof.chart_license_code,
    chart_license_raw: parsed.proof.chart_license_raw,
    chart_license_url: parsed.proof.chart_license_url,
    chart_license_explicit: true,
    manual_review_completed: false,
    embed_available: true,
    chart_reuse_prohibited: false,
    evidence_conflict: false,
    evidence_url: row.canonical_url,
    evidence_checked_at: reviewedAt,
  };
  const classification = classifyRights(evidence);
  return {
    slug: row.slug,
    canonical_url: row.canonical_url,
    chart_owner: "owid",
    chart_license_code: parsed.proof.chart_license_code,
    chart_license_raw: parsed.proof.chart_license_raw,
    chart_license_url: parsed.proof.chart_license_url,
    chart_license_explicit: true,
    manual_review_completed: false,
    embed_available: true,
    citation_only_allowed: false,
    chart_reuse_prohibited: false,
    evidence_conflict: false,
    evidence_url: row.canonical_url,
    expected_rights_status: classification.rights_status,
    expected_raw_data_redistribution: classification.raw_data_redistribution,
    review_note:
      "The asset-specific OWID JSON-LD names Our World in Data as chart creator and copyright holder and links the explicit chart license. Underlying raw-data rights remain independently classified.",
  };
}

async function mapConcurrent<T, R>(
  values: T[],
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  if (!inputPath || !args.includes("--remote")) {
    throw new Error(
      "Usage: npm run rights:owid-corpus -- <input.csv|json|txt> --remote [--start 0] [--limit 3000] [--batch-size 25] [--concurrency 8] [--allow-empty] [--apply --publish]",
    );
  }
  if (args.includes("--publish") && !args.includes("--apply")) {
    throw new Error("--publish requires --apply");
  }
  d1Credentials();

  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (extension !== "csv" && extension !== "json" && extension !== "txt") {
    throw new Error("Input must be CSV, JSON, or TXT");
  }
  const input = await readFile(resolve(inputPath), "utf8");
  const normalized = normalizeOwidInput(input, extension);
  if (normalized.invalid.length > 0 || normalized.duplicates.length > 0) {
    throw new Error("Rights review input must not contain invalid or duplicate rows");
  }

  const start = integerOption(args, "--start", 0, 0);
  const limit = integerOption(args, "--limit", normalized.accepted.length - start, 0);
  const batchSize = integerOption(args, "--batch-size", 25, 1);
  const concurrency = integerOption(args, "--concurrency", 8, 1);
  const selected = normalized.accepted.slice(start, start + limit);
  const reviewedAt = new Date().toISOString();
  const plans: RightsReviewPlan[] = [];
  const failures: FailedReview[] = [];

  for (let offset = 0; offset < selected.length; offset += batchSize) {
    const batch = selected.slice(offset, offset + batchSize);
    const rows = await readRows(batch.map((asset) => asset.slug));
    const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
    const outcomes = await mapConcurrent(batch, concurrency, async (asset) => {
      const row = rowBySlug.get(asset.slug);
      if (!row) {
        return { slug: asset.slug, error: "asset_missing_from_d1" } as const;
      }
      try {
        const html = await fetchRightsPage(row.canonical_url);
        return { row, review: manifestAsset(row, html, reviewedAt) } as const;
      } catch (error) {
        return {
          slug: asset.slug,
          error: error instanceof Error ? error.message : "rights_review_failed",
        } as const;
      }
    });
    const reviewed = outcomes.filter(
      (outcome): outcome is Extract<(typeof outcomes)[number], { row: RightsReviewAssetRow }> =>
        "row" in outcome,
    );
    failures.push(
      ...outcomes
        .filter(
          (outcome): outcome is Extract<(typeof outcomes)[number], { error: string }> =>
            "error" in outcome,
        )
        .map((outcome) => ({ slug: outcome.slug, reason: outcome.error })),
    );
    if (reviewed.length > 0) {
      const manifest: RightsReviewManifest = {
        review_version: REVIEW_VERSION,
        reviewed_at: reviewedAt,
        review_scope:
          "Asset-specific OWID chart JSON-LD ownership/license evidence; underlying data rights evaluated separately.",
        assets: reviewed.map((outcome) => outcome.review),
      };
      plans.push(
        prepareRightsReview(
          reviewed.map((outcome) => outcome.row),
          manifest,
          { publish: args.includes("--publish") },
        ),
      );
    }
    process.stdout.write(
      `${JSON.stringify({
        event: "rights_evidence_batch_complete",
        processed: Math.min(offset + batch.length, selected.length),
        selected: selected.length,
        verified: plans.reduce((total, plan) => total + plan.counts.reviewed, 0),
        failed: failures.length,
      })}\n`,
    );
  }

  const verified = plans.reduce((total, plan) => total + plan.counts.reviewed, 0);
  if (selected.length > 0 && verified === 0 && !args.includes("--allow-empty")) {
    throw new Error(
      "No asset-specific OWID rights evidence could be verified; nothing was written",
    );
  }

  let rowsWritten = 0;
  if (args.includes("--apply")) {
    for (const [index, plan] of plans.entries()) {
      rowsWritten += await applyQueries(
        buildRightsReviewQueries(plan),
        `apply rights batch ${index + 1}/${plans.length}`,
      );
      if (index + 1 < plans.length) {
        await sleep(500);
      }
    }
  }

  const totals = plans.reduce(
    (counts, plan) => ({
      safe: counts.safe + plan.counts.safe,
      restricted: counts.restricted + plan.counts.restricted,
      unknown: counts.unknown + plan.counts.unknown,
      blocked: counts.blocked + plan.counts.blocked,
      rawDataEnabled: counts.rawDataEnabled + plan.counts.raw_data_enabled,
      rawDataUnverified: counts.rawDataUnverified + plan.counts.raw_data_unverified,
    }),
    { safe: 0, restricted: 0, unknown: 0, blocked: 0, rawDataEnabled: 0, rawDataUnverified: 0 },
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        reviewVersion: REVIEW_VERSION,
        reviewedAt,
        selected: selected.length,
        verified,
        failed: failures.length,
        failures,
        ...totals,
        publishRequested: args.includes("--publish"),
        databaseWritten: args.includes("--apply"),
        rowsWritten,
      },
      null,
      2,
    )}\n`,
  );
}

await main();
