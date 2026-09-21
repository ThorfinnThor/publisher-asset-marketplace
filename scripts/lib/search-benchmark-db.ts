import { readFile } from "node:fs/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { resolve } from "node:path";

import { rebuildAssetSearchTrigramsSql } from "../../src/lib/search/search-index";

export type SearchBenchmarkAssetFixture = {
  slug: string;
  title: string;
  description: string;
  assetType: string;
  source: string;
  status: "draft" | "review" | "published" | "hidden";
  rightsStatus: "safe" | "restricted" | "unknown" | "blocked";
  embedAllowed: boolean | null;
  sourceUpdatedAt: string | null;
};

export async function createSearchBenchmarkDatabase(
  fixtures: SearchBenchmarkAssetFixture[],
): Promise<{ db: D1Database; close: () => void }> {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = await Promise.all(
    ["0001_initial.sql", "0002_refresh_runs.sql", "0003_search_index.sql"].map((name) =>
      readFile(resolve("migrations", name), "utf8"),
    ),
  );
  migrations.forEach((migration) => sqlite.exec(migration));
  sqlite.exec("ALTER TABLE assets ADD COLUMN embed_origin TEXT;");

  insertSources(sqlite, fixtures);
  insertAssets(sqlite, fixtures);
  sqlite.exec("DELETE FROM asset_search_trigrams;");
  sqlite.exec(rebuildAssetSearchTrigramsSql);

  return {
    db: createD1ReadAdapter(sqlite),
    close: () => sqlite.close(),
  };
}

function insertSources(sqlite: DatabaseSync, fixtures: SearchBenchmarkAssetFixture[]): void {
  const sources = [...new Set(fixtures.map((fixture) => fixture.source))];
  const statement = sqlite.prepare(`
    INSERT OR IGNORE INTO sources (
      id, key, name, base_url, policy_url, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const [index, source] of sources.entries()) {
    const id = source === "Our World in Data" ? "source_owid" : `source_benchmark_${index}`;
    if (id === "source_owid") continue;
    const key = `benchmark-${index}`;
    const url = `https://benchmark.invalid/source/${index}`;
    statement.run(
      id,
      key,
      source,
      url,
      url,
      "2026-09-14T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    );
  }
}

function insertAssets(sqlite: DatabaseSync, fixtures: SearchBenchmarkAssetFixture[]): void {
  const sourceIds = new Map(
    (
      sqlite.prepare("SELECT id, name FROM sources").all() as Array<{ id: string; name: string }>
    ).map((source) => [source.name, source.id]),
  );
  const statement = sqlite.prepare(`
    INSERT INTO assets (
      id, source_id, creator_id, external_id, slug, asset_type, title, description,
      canonical_url, canonical_url_normalized, embed_url, preview_url, citation_text,
      attribution_name, attribution_url, published_at, source_updated_at, license_code,
      rights_status, rights_json, metadata_json, search_document, status, created_at,
      updated_at, last_checked_at
    ) VALUES (
      ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  for (const fixture of fixtures) {
    const id = `asset_${fixture.slug}`;
    const canonicalUrl = `https://benchmark.invalid/assets/${fixture.slug}`;
    const sourceId = sourceIds.get(fixture.source);
    if (!sourceId) throw new Error(`Missing source fixture for ${fixture.source}`);
    statement.run(
      id,
      sourceId,
      fixture.slug,
      fixture.slug,
      fixture.assetType,
      fixture.title,
      fixture.description,
      canonicalUrl,
      canonicalUrl,
      fixture.embedAllowed ? `${canonicalUrl}/embed` : null,
      `${canonicalUrl}/preview.png`,
      `${fixture.title}. ${fixture.source}.`,
      fixture.source,
      canonicalUrl,
      fixture.sourceUpdatedAt,
      fixture.sourceUpdatedAt,
      fixture.rightsStatus === "safe" ? "CC_BY" : null,
      fixture.rightsStatus,
      JSON.stringify({ embed_allowed: fixture.embedAllowed }),
      JSON.stringify({ benchmark_fixture: true }),
      [fixture.title, fixture.description, fixture.assetType, fixture.source].join(" "),
      fixture.status,
      "2026-09-14T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    );
  }
}

function createD1ReadAdapter(sqlite: DatabaseSync): D1Database {
  return {
    prepare(query: string) {
      const statement = sqlite.prepare(query);
      let bindings: SQLInputValue[] = [];
      const prepared = {
        bind(...values: unknown[]) {
          bindings = values.map(toSqlInputValue);
          return prepared;
        },
        async all<T>() {
          const results = statement.all(...bindings) as T[];
          return { results, success: true, meta: {} } as D1Result<T>;
        },
      };
      return prepared as unknown as D1PreparedStatement;
    },
  } as D1Database;
}

function toSqlInputValue(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  throw new TypeError(`Unsupported SQLite benchmark binding: ${typeof value}`);
}
