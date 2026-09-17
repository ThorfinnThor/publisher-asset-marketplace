import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import {
  classifyOwidPendingAsset,
  type OwidPendingAsset,
  type OwidSourceProbe,
} from "../src/lib/ingest/owid-catalog-reconcile";
import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";

const SOURCE_ID = "source_owid";
const RECONCILE_VERSION = "owid-catalog-reconcile-v1";
const MAX_D1_ATTEMPTS = 5;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

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

type D1Query = { sql: string; params: unknown[] };

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function credentials(): { accountId: string; apiToken: string; databaseId: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "OWID reconciliation requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID",
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

async function pendingAssets(): Promise<OwidPendingAsset[]> {
  const payload = await requestD1<OwidPendingAsset>(
    {
      sql: `SELECT id, slug, canonical_url FROM assets
        WHERE source_id = ? AND status IN ('draft', 'review') ORDER BY slug`,
      params: [SOURCE_ID],
    },
    "read pending OWID assets",
  );
  return payload.result?.[0]?.results ?? [];
}

async function probeSource(canonicalUrl: string): Promise<OwidSourceProbe> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(canonicalUrl, {
        headers: { Accept: "text/html", "User-Agent": "publisher-asset-marketplace/0.1" },
        redirect: "manual",
        signal: controller.signal,
      });
      await response.body?.cancel().catch(() => undefined);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          return { kind: "failed", detail: `HTTP ${response.status} without location` };
        return {
          kind: "redirected",
          status: response.status,
          location: new URL(location, canonicalUrl).toString(),
        };
      }
      if (response.status === 404 || response.status === 410) {
        return { kind: "removed", status: response.status };
      }
      if (response.ok) return { kind: "available", status: response.status };
      if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
        await sleep(attempt * 500);
        continue;
      }
      return { kind: "failed", detail: `HTTP ${response.status}` };
    } catch (error) {
      if (attempt === 3) {
        return {
          kind: "failed",
          detail: error instanceof Error ? error.message : "request failed",
        };
      }
      await sleep(attempt * 500);
    } finally {
      clearTimeout(timeout);
    }
  }
  return { kind: "failed", detail: "retry budget exhausted" };
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await operation(values[index]!);
      }
    }),
  );
  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  if (!inputPath || !args.includes("--remote")) {
    throw new Error(
      "Usage: npm run reconcile:owid-pending -- <catalog.csv|json|txt> --remote [--apply]",
    );
  }
  credentials();
  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (extension !== "csv" && extension !== "json" && extension !== "txt") {
    throw new Error("OWID catalogue input must be CSV, JSON, or TXT");
  }
  const normalized = normalizeOwidInput(await readFile(resolve(inputPath), "utf8"), extension);
  if (normalized.invalid.length > 0 || normalized.duplicates.length > 0) {
    throw new Error("OWID catalogue input must not contain invalid or duplicate rows");
  }
  const catalogueSlugs = new Set(normalized.accepted.map((asset) => asset.slug));
  const pending = await pendingAssets();
  const outcomes = await mapConcurrent(pending, 8, async (asset) => {
    const probe = catalogueSlugs.has(asset.slug) ? await probeSource(asset.canonical_url) : null;
    return { asset, disposition: classifyOwidPendingAsset(asset, catalogueSlugs, probe) };
  });
  const hidden = outcomes.filter((outcome) => outcome.disposition.action === "hide");
  const retained = outcomes.filter((outcome) => outcome.disposition.action === "retain");
  const now = new Date().toISOString();
  let rowsWritten = 0;

  if (args.includes("--apply") && hidden.length > 0) {
    const queries: D1Query[] = hidden.flatMap(({ asset, disposition }) => [
      {
        sql: `UPDATE assets SET status = 'hidden', updated_at = ?, last_checked_at = ?
          WHERE id = ? AND source_id = ? AND status IN ('draft', 'review')`,
        params: [now, now, asset.id, SOURCE_ID],
      },
      {
        sql: `INSERT OR IGNORE INTO rights_reviews
          (id, asset_id, decision, reason_code, notes, evidence_url, reviewed_by, created_at)
          VALUES (?, ?, 'unknown', ?, ?, ?, NULL, ?)`,
        params: [
          `rights_review_${RECONCILE_VERSION}_${asset.slug}`,
          asset.id,
          disposition.reason,
          `${disposition.note} Reconciliation version: ${RECONCILE_VERSION}.`,
          asset.canonical_url,
          now,
        ],
      },
    ]);
    const payload = await requestD1<never>({ batch: queries }, "hide stale OWID pending assets");
    rowsWritten = (payload.result ?? []).reduce(
      (total, result) => total + (result.meta?.rows_written ?? 0),
      0,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        catalogueAssets: normalized.accepted.length,
        pendingBefore: pending.length,
        hidden: hidden.length,
        retained: retained.length,
        hiddenByReason: Object.fromEntries(
          ["catalog_removed", "canonical_redirected", "source_removed"].map((reason) => [
            reason,
            hidden.filter((outcome) => outcome.disposition.reason === reason).length,
          ]),
        ),
        retainedAssets: retained.map(({ asset, disposition }) => ({
          slug: asset.slug,
          reason: disposition.reason,
        })),
        databaseWritten: args.includes("--apply"),
        rowsWritten,
      },
      null,
      2,
    )}\n`,
  );
}

await main();
