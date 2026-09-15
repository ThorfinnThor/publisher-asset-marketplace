import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { buildOwidImportSql, prepareOwidImport } from "../src/lib/ingest/import-runner";

const execFileAsync = promisify(execFile);
const supportedFormats = new Set(["csv", "json", "txt"] as const);

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
  if (stdout.trim() !== "") {
    process.stdout.write(stdout);
  }
  if (stderr.trim() !== "") {
    process.stderr.write(stderr);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const apply = args.includes("--apply");
  const remote = args.includes("--remote");
  const local = args.includes("--local");
  const jsonOutput = args.includes("--json");
  const rebuildSearchIndex = !args.includes("--skip-search-rebuild");
  const sqlOutput = optionValue(args, "--sql-out");

  if (!inputPath) {
    throw new Error(
      "Usage: npm run ingest:import -- <input.csv|input.json|input.txt> [--sql-out file.sql] [--apply --remote|--local]",
    );
  }
  if (apply && remote === local) {
    throw new Error("--apply requires exactly one target: --remote or --local");
  }

  const extension = extname(inputPath).slice(1).toLocaleLowerCase("en");
  if (!supportedFormats.has(extension as "csv" | "json" | "txt")) {
    throw new Error("Input must be CSV, JSON, or TXT");
  }

  const content = await readFile(resolve(inputPath), "utf8");
  const plan = await prepareOwidImport(content, extension as "csv" | "json" | "txt");
  const summary = {
    runId: plan.run_id,
    status: plan.status,
    accepted: plan.counts.accepted,
    duplicates: plan.counts.duplicates,
    invalid: plan.counts.invalid,
    errors: plan.counts.errors,
    assets: plan.assets.length,
    databaseWritten: false,
    rightsStatusCounts: plan.assets.reduce<Record<string, number>>((counts, asset) => {
      counts[asset.rights_status] = (counts[asset.rights_status] ?? 0) + 1;
      return counts;
    }, {}),
  };

  let sqlPath: string | undefined;
  let tempDirectory: string | undefined;
  try {
    if (sqlOutput) {
      sqlPath = resolve(sqlOutput);
      await writeFile(sqlPath, buildOwidImportSql(plan, { rebuildSearchIndex }), "utf8");
    }
    if (apply) {
      tempDirectory = await mkdtemp(join(tmpdir(), "publisher-asset-import-"));
      sqlPath ??= join(tempDirectory, "import.sql");
      await writeFile(sqlPath, buildOwidImportSql(plan, { rebuildSearchIndex }), "utf8");
      await applyWithWrangler(sqlPath, remote ? "remote" : "local");
      summary.databaseWritten = true;
    } else {
      summary.databaseWritten = false;
    }
  } finally {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
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

  if (plan.status === "failed") {
    process.exitCode = 1;
  }
}

await main();
