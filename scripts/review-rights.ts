import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  buildRightsReviewSql,
  parseRightsReviewManifest,
  prepareRightsReview,
  type RightsReviewAssetRow,
} from "../src/lib/rights/rights-review";

const execFileAsync = promisify(execFile);
const defaultManifest = "data/rights/owid-seed-rights-review-v1.json";

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function rowsFromWrangler(value: unknown): RightsReviewAssetRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Wrangler returned an unexpected D1 response");
  }
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("results" in entry)) {
      return [];
    }
    return Array.isArray(entry.results) ? entry.results : [];
  }) as RightsReviewAssetRow[];
}

async function runWrangler(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  return execFileAsync(npx, ["wrangler", ...args], { maxBuffer: 20 * 1024 * 1024 });
}

async function readAssets(
  target: "local" | "remote",
  sourceId: string,
): Promise<RightsReviewAssetRow[]> {
  if (!/^source_[a-z0-9_]+$/.test(sourceId)) {
    throw new Error("Source id contains unsupported characters");
  }
  const query = `SELECT id, slug, canonical_url, citation_text, attribution_name, attribution_url, rights_status, status, metadata_json
    FROM assets
    WHERE source_id = '${sourceId}'
    ORDER BY slug`;
  const { stdout, stderr } = await runWrangler([
    "d1",
    "execute",
    "DB",
    `--${target}`,
    "--command",
    query,
    "--config",
    "wrangler.jsonc",
    "--json",
  ]);
  if (stderr.trim() !== "") {
    process.stderr.write(stderr);
  }
  return rowsFromWrangler(JSON.parse(stdout));
}

async function applySql(sqlPath: string, target: "local" | "remote"): Promise<void> {
  const { stdout, stderr } = await runWrangler([
    "d1",
    "execute",
    "DB",
    `--${target}`,
    "--file",
    sqlPath,
    "--config",
    "wrangler.jsonc",
    "--yes",
  ]);
  if (stdout.trim() !== "") {
    process.stdout.write(stdout);
  }
  if (stderr.trim() !== "") {
    process.stderr.write(stderr);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  const apply = args.includes("--apply");
  const publish = args.includes("--publish");
  if (local && remote) {
    throw new Error("Choose only one target: --local or --remote");
  }
  if (apply && local === remote) {
    throw new Error("--apply requires exactly one target: --local or --remote");
  }
  const target = remote ? "remote" : "local";
  const sourceId = optionValue(args, "--source") ?? "source_owid";
  const manifestPath = resolve(optionValue(args, "--manifest") ?? defaultManifest);
  const sqlOutput = optionValue(args, "--sql-out");
  const manifest = parseRightsReviewManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const plan = prepareRightsReview(await readAssets(target, sourceId), manifest, { publish });
  const sql = buildRightsReviewSql(plan);

  let tempDirectory: string | undefined;
  try {
    let sqlPath: string | undefined;
    if (sqlOutput) {
      sqlPath = resolve(sqlOutput);
      await writeFile(sqlPath, sql, "utf8");
    }
    if (apply) {
      tempDirectory = await mkdtemp(join(tmpdir(), "publisher-rights-review-"));
      sqlPath ??= join(tempDirectory, "rights-review.sql");
      await writeFile(sqlPath, sql, "utf8");
      await applySql(sqlPath, target);
    }
  } finally {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        target,
        sourceId,
        reviewVersion: plan.review_version,
        reviewedAt: plan.reviewed_at,
        publishRequested: publish,
        databaseWritten: apply,
        counts: plan.counts,
        assets: plan.updates.map((update) => ({
          slug: update.slug,
          rightsStatus: update.rights_status,
          reasonCode: update.reason_code,
          publicationStatus: update.status,
          rawDataRedistribution: JSON.parse(update.rights_json).raw_data_redistribution,
        })),
      },
      null,
      2,
    )}\n`,
  );
  if (!apply) {
    process.stdout.write(
      "Dry run only. Use --apply with exactly one target; add --publish to publish only safe/restricted decisions.\n",
    );
  }
}

await main();
