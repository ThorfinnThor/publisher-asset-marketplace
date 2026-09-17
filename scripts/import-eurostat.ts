import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import {
  buildEurostatImportSql,
  prepareEurostatImport,
} from "../src/lib/ingest/eurostat-import-runner";
import { EUROSTAT_PILOT_DATASETS } from "../src/lib/ingest/eurostat-source-client";

const execFileAsync = promisify(execFile);

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
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
    { maxBuffer: 20 * 1024 * 1024 },
  );
  if (stdout.trim() !== "") process.stdout.write(stdout);
  if (stderr.trim() !== "") process.stderr.write(stderr);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const reviewedRights = args.includes("--reviewed-rights");
  const remote = args.includes("--remote");
  const local = args.includes("--local");
  const sqlOutput = optionValue(args, "--sql-out");
  const datasetCodes = args.filter((arg, index) => {
    if (arg.startsWith("--")) return false;
    return args[index - 1] !== "--sql-out";
  });
  const selectedCodes =
    datasetCodes.length > 0 ? datasetCodes : EUROSTAT_PILOT_DATASETS.map((item) => item.code);

  if (apply && !reviewedRights) {
    throw new Error("--apply requires --reviewed-rights after the item-level Eurostat review");
  }
  if (apply && remote === local) {
    throw new Error("--apply requires exactly one target: --remote or --local");
  }

  const plan = await prepareEurostatImport(selectedCodes);
  const summary = {
    runId: plan.run_id,
    status: plan.status,
    sourceId: plan.source_id,
    requested: selectedCodes,
    accepted: plan.counts.accepted,
    errors: plan.counts.errors,
    assets: plan.assets.length,
    databaseWritten: false,
    rightsStatusCounts: plan.assets.reduce<Record<string, number>>((counts, asset) => {
      counts[asset.rights_status] = (counts[asset.rights_status] ?? 0) + 1;
      return counts;
    }, {}),
  };

  let tempDirectory: string | undefined;
  try {
    let sqlPath = sqlOutput ? resolve(sqlOutput) : undefined;
    if (sqlPath) await writeFile(sqlPath, buildEurostatImportSql(plan), "utf8");
    if (apply) {
      tempDirectory = await mkdtemp(join(tmpdir(), "publisher-eurostat-import-"));
      sqlPath ??= join(tempDirectory, "import.sql");
      await writeFile(sqlPath, buildEurostatImportSql(plan), "utf8");
      await applyWithWrangler(sqlPath, remote ? "remote" : "local");
      summary.databaseWritten = true;
    }
  } finally {
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!apply)
    process.stdout.write(
      "No database write requested. Use --apply --reviewed-rights --local or --remote after review.\n",
    );
  if (plan.status === "failed") process.exitCode = 1;
}

await main();
