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
