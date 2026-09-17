import { writeFile } from "node:fs/promises";

const DATASetteOrigin = "https://datasette-public.owid.io";
const DEFAULT_PAGE_SIZE = 1_000;
const DEFAULT_MAX_ROWS = 10_000;
const USER_AGENT =
  "publisher-asset-marketplace/0.1 (OWID catalogue discovery; contact: maintainers)";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

type DatasetteResponse = {
  rows?: unknown[][];
  columns?: unknown[];
  filtered_table_rows_count?: unknown;
  next?: unknown;
};

type CatalogRow = {
  slug: string;
  title: string;
  published: boolean;
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

function csvField(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseCatalogRows(payload: DatasetteResponse): CatalogRow[] {
  if (!Array.isArray(payload.columns) || !Array.isArray(payload.rows)) {
    throw new Error("OWID Datasette response is missing columns or rows");
  }
  const columns = payload.columns.map((column) => String(column));
  const slugIndex = columns.indexOf("slug");
  const titleIndex = columns.indexOf("title");
  const publishedIndex = columns.indexOf("isPublished");
  if (slugIndex < 0 || titleIndex < 0 || publishedIndex < 0) {
    throw new Error(`OWID Datasette response has unexpected columns: ${columns.join(", ")}`);
  }

  return payload.rows.flatMap((row) => {
    const slug =
      typeof row[slugIndex] === "string" ? row[slugIndex].trim().toLocaleLowerCase("en") : "";
    const title = typeof row[titleIndex] === "string" ? row[titleIndex].trim() : "";
    const published = row[publishedIndex] === true;
    if (!published || !SLUG_PATTERN.test(slug) || title === "") {
      return [];
    }
    return [{ slug, title, published }];
  });
}

async function fetchPage(cursor: string | undefined, pageSize: number): Promise<DatasetteResponse> {
  const url = new URL("/owid/charts.json", DATASetteOrigin);
  url.searchParams.set("_size", String(pageSize));
  url.searchParams.set("_sort", "slug");
  if (cursor) {
    url.searchParams.set("_next", cursor);
  }
  for (const column of ["slug", "title", "isPublished"]) {
    url.searchParams.append("_col", column);
  }
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`OWID Datasette returned HTTP ${response.status}`);
  }
  return (await response.json()) as DatasetteResponse;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const output = optionValue(args, "--output");
  if (!output) {
    throw new Error(
      "Usage: npm run ingest:owid:catalog -- --output <catalog.csv> [--page-size 1000] [--max-rows 10000]",
    );
  }
  const pageSize = integerOption(args, "--page-size", DEFAULT_PAGE_SIZE, 1);
  if (pageSize > DEFAULT_PAGE_SIZE) {
    throw new Error(`--page-size must be less than or equal to ${DEFAULT_PAGE_SIZE}`);
  }
  const maxRows = integerOption(args, "--max-rows", DEFAULT_MAX_ROWS, 1);
  const unique = new Map<string, CatalogRow>();
  let page = 0;
  let cursor: string | undefined;
  let catalogueCount: number | undefined;

  while (unique.size < maxRows) {
    const payload = await fetchPage(cursor, pageSize);
    if (catalogueCount === undefined && typeof payload.filtered_table_rows_count === "number") {
      catalogueCount = payload.filtered_table_rows_count;
    }
    const rows = parseCatalogRows(payload);
    for (const row of rows) {
      if (!unique.has(row.slug)) {
        unique.set(row.slug, row);
      }
    }
    process.stdout.write(
      `${JSON.stringify({ event: "owid_catalog_page", page, fetched: rows.length, accepted: unique.size })}\n`,
    );
    const next = typeof payload.next === "string" && payload.next !== "" ? payload.next : undefined;
    if (rows.length === 0 || !next || next === cursor) {
      break;
    }
    cursor = next;
    page += 1;
  }

  const rows = [...unique.values()].sort((left, right) => left.slug.localeCompare(right.slug));
  const csv =
    [
      "asset_url,title",
      ...rows.map(
        (row) =>
          `${csvField(`https://ourworldindata.org/grapher/${row.slug}`)},${csvField(row.title)}`,
      ),
    ].join("\n") + "\n";
  await writeFile(output, csv, "utf8");
  process.stdout.write(
    `${JSON.stringify({ event: "owid_catalog_complete", output, count: rows.length, catalogueCount })}\n`,
  );
}

await main();
