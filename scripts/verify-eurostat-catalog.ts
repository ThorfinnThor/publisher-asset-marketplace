import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultBaseUrl = "https://publisher-asset-marketplace.shuu9599.workers.dev";

type CatalogRow = {
  slug: string;
  embed_url: string | null;
  status: string;
  rights_json: string | null;
};

function rowsFromWrangler(value: unknown): CatalogRow[] {
  if (!Array.isArray(value)) throw new Error("Wrangler returned an unexpected D1 response");
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("results" in entry)) return [];
    return Array.isArray(entry.results) ? entry.results : [];
  }) as CatalogRow[];
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = Number(optionValue(args, "--min") ?? "1000");
  const sampleSize = Number(optionValue(args, "--sample") ?? "20");
  const baseUrl = (process.env.RELEASE_BASE_URL ?? defaultBaseUrl).replace(/\/$/u, "");
  if (!Number.isSafeInteger(target) || target < 1) throw new Error("--min must be positive");
  if (!Number.isSafeInteger(sampleSize) || sampleSize < 1) {
    throw new Error("--sample must be positive");
  }

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const query = `SELECT slug, embed_url, status, rights_json FROM assets WHERE source_id = 'source_eurostat' AND status = 'published' ORDER BY slug LIMIT ${Math.max(target, sampleSize)}`;
  const { stdout, stderr } = await execFileAsync(
    npx,
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--command",
      query,
      "--config",
      "wrangler.jsonc",
      "--json",
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  if (stderr.trim() !== "") process.stderr.write(stderr);
  const rows = rowsFromWrangler(JSON.parse(stdout));
  if (rows.length < target) {
    throw new Error(`Expected at least ${target} published Eurostat assets, found ${rows.length}`);
  }

  const stride = Math.max(1, Math.floor(rows.length / sampleSize));
  const sample = rows.filter((_, index) => index % stride === 0).slice(0, sampleSize);
  const failures: string[] = [];
  for (const row of sample) {
    if (!row.embed_url || !row.embed_url.startsWith(`${baseUrl}/embed/eurostat-`)) {
      failures.push(`${row.slug}: missing marketplace embed URL`);
      continue;
    }
    let rights: unknown;
    try {
      rights = row.rights_json ? JSON.parse(row.rights_json) : null;
    } catch {
      failures.push(`${row.slug}: malformed rights JSON`);
      continue;
    }
    if (
      typeof rights !== "object" ||
      rights === null ||
      (rights as { marketplace_rendered_embed_allowed?: unknown })
        .marketplace_rendered_embed_allowed !== true
    ) {
      failures.push(`${row.slug}: marketplace embed right is not enabled`);
      continue;
    }
    const response = await fetch(`${row.embed_url}?__catalog_verify=${Date.now()}`, {
      headers: { "cache-control": "no-cache" },
    });
    const body = await response.text();
    if (response.status !== 200) failures.push(`${row.slug}: expected 200, got ${response.status}`);
    if (!body.includes("Reviewed Eurostat observations") || !body.includes("Source: Eurostat")) {
      failures.push(`${row.slug}: rendered data/citation text is missing`);
    }
    if (response.headers.get("x-frame-options") !== null) {
      failures.push(`${row.slug}: x-frame-options must be absent for iframe use`);
    }
    const csp = response.headers.get("content-security-policy") ?? "";
    if (!csp.includes("frame-ancestors *") || !csp.includes("script-src 'none'")) {
      failures.push(`${row.slug}: embed CSP is incomplete`);
    }
  }
  if (failures.length > 0)
    throw new Error(`Eurostat catalogue verification failed:\n- ${failures.join("\n- ")}`);
  console.log(
    `Eurostat catalogue verification passed: ${rows.length} published assets; ${sample.length} live embeds sampled.`,
  );
}

await main();
