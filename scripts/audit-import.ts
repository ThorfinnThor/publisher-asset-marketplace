import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  auditImportAssets,
  renderImportAuditMarkdown,
  type AuditAssetRow,
} from "../src/lib/audit/import-audit";

const execFileAsync = promisify(execFile);

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function rowsFromWrangler(value: unknown): AuditAssetRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Wrangler returned an unexpected D1 response");
  }
  const rows = value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("results" in entry)) {
      return [];
    }
    return Array.isArray(entry.results) ? entry.results : [];
  });
  return rows as AuditAssetRow[];
}

async function readAssets(target: "local" | "remote"): Promise<AuditAssetRow[]> {
  if (target === "remote") {
    return readRemoteAssets();
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const query = `SELECT
    id, slug, title, rights_status, status, source_updated_at, last_checked_at,
    metadata_json, rights_json, canonical_url, embed_url, citation_text
  FROM assets
  ORDER BY slug`;
  const { stdout, stderr } = await execFileAsync(
    npx,
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      `--${target}`,
      "--command",
      query,
      "--config",
      "wrangler.jsonc",
      "--json",
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  if (stderr.trim() !== "") {
    process.stderr.write(stderr);
  }
  return rowsFromWrangler(JSON.parse(stdout));
}

async function readRemoteAssets(): Promise<AuditAssetRow[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Remote paginated audit requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID",
    );
  }
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const pageSize = 50;
  const rows: AuditAssetRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: `SELECT
          id, slug, title, rights_status, status, source_updated_at, last_checked_at,
          metadata_json, rights_json, canonical_url, embed_url, citation_text
        FROM assets
        ORDER BY slug
        LIMIT ? OFFSET ?`,
        params: [pageSize, offset],
      }),
    });
    const payload = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: Array<{ success?: boolean; results?: AuditAssetRow[] }>;
    };
    const result = payload.result?.[0];
    if (!response.ok || payload.success !== true || result?.success === false) {
      throw new Error(
        `Remote D1 audit query failed: ${(payload.errors ?? []).map((error) => error.message).join("; ") || response.statusText}`,
      );
    }
    const page = result?.results ?? [];
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (local && remote) {
    throw new Error("Choose only one target: --local or --remote");
  }
  const target = remote ? "remote" : "local";
  const auditedAt = optionValue(args, "--at") ?? new Date().toISOString();
  const samplePerStratum = positiveInteger(optionValue(args, "--sample-size"), 3, "--sample-size");
  const staleAfterDays = positiveInteger(
    optionValue(args, "--stale-after-days"),
    730,
    "--stale-after-days",
  );
  const output = optionValue(args, "--output");

  const assets = await readAssets(target);
  const report = auditImportAssets(assets, {
    audited_at: auditedAt,
    sample_per_stratum: samplePerStratum,
    stale_after_days: staleAfterDays,
  });
  const sourceLabel = `${target} Cloudflare D1 binding DB`;

  if (output) {
    await writeFile(resolve(output), renderImportAuditMarkdown(report, sourceLabel), "utf8");
  }
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderImportAuditMarkdown(report, sourceLabel));
  }
  if (args.includes("--enforce-gate") && !report.gate_b.passed) {
    process.exitCode = 2;
  }
}

await main();
