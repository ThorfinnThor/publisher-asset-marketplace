import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  buildAssetRefreshSql,
  prepareAssetRefresh,
  type RefreshAssetRow,
} from "../src/lib/ingest/refresh-runner";

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

function rowsFromWrangler(value: unknown): RefreshAssetRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Wrangler returned an unexpected D1 response");
  }
  const rows = value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("results" in entry)) {
      return [];
    }
    return Array.isArray(entry.results) ? entry.results : [];
  });
  return rows as RefreshAssetRow[];
}

async function readAssets(target: "local" | "remote"): Promise<RefreshAssetRow[]> {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const query = `SELECT
    id, source_id, slug, title, rights_status, status, source_updated_at,
    last_checked_at, created_at, metadata_json, rights_json
  FROM assets
  WHERE source_id = 'source_owid' AND status != 'hidden'
  ORDER BY last_checked_at ASC, slug ASC`;
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

async function applyWithWrangler(sqlPath: string, target: "local" | "remote"): Promise<void> {
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
    { maxBuffer: 20 * 1024 * 1024 },
  );
  if (stdout.trim() !== "") {
    process.stdout.write(stdout);
  }
  if (stderr.trim() !== "") {
    process.stderr.write(stderr);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const remote = args.includes("--remote");
  const local = args.includes("--local");
  const jsonOutput = args.includes("--json");
  const sqlOutput = optionValue(args, "--sql-out");
  if (apply && remote === local) {
    throw new Error("--apply requires exactly one target: --remote or --local");
  }
  if (remote && local) {
    throw new Error("Choose only one target: --local or --remote");
  }
  const target = remote ? "remote" : "local";
  const now = optionValue(args, "--at") ?? new Date().toISOString();
  const maxAssets = positiveInteger(optionValue(args, "--max-assets"), 25, "--max-assets");
  const minCheckIntervalHours = positiveInteger(
    optionValue(args, "--min-check-interval-hours"),
    24,
    "--min-check-interval-hours",
  );
  const staleAfterDays = positiveInteger(
    optionValue(args, "--stale-after-days"),
    730,
    "--stale-after-days",
  );
  const assets = await readAssets(target);
  const plan = await prepareAssetRefresh(assets, {
    now,
    max_assets: maxAssets,
    min_check_interval_hours: minCheckIntervalHours,
    stale_after_days: staleAfterDays,
  });
  const summary = {
    runId: plan.run_id,
    status: plan.status,
    target,
    ...plan.counts,
    databaseWritten: false,
  };
  const sql = buildAssetRefreshSql(plan);
  if (sqlOutput) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(resolve(sqlOutput), sql, "utf8");
  }
  if (apply && plan.candidates.length > 0) {
    const tempPath = resolve(`.refresh-${plan.run_id}.sql`);
    const { writeFile, rm } = await import("node:fs/promises");
    await writeFile(tempPath, sql, "utf8");
    try {
      await applyWithWrangler(tempPath, target);
      summary.databaseWritten = true;
    } finally {
      await rm(tempPath, { force: true });
    }
  }
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (!apply) {
      process.stdout.write(
        "No database write requested. Use --apply --local or --apply --remote.\n",
      );
    }
  }
}

await main();
