import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  buildAssetDetailSql,
  buildRelatedAssetsSql,
  getPublishedAssetBySlug,
} from "../src/lib/assets/get-asset";

describe("C4 published asset detail", () => {
  it("keeps detail and related queries restricted to published, reviewed assets", () => {
    const relatedSql = buildRelatedAssetsSql();

    expect(buildAssetDetailSql()).toContain("a.status = 'published'");
    expect(buildAssetDetailSql()).toContain("a.rights_status IN ('safe', 'restricted')");
    expect(buildAssetDetailSql()).toContain("a.search_indexable");
    expect(buildAssetDetailSql()).not.toContain("asset_editorial");
    expect(relatedSql.sameSource).toContain("a.source_id = ?");
    expect(relatedSql.sameSource).toContain("LIMIT 3");
    expect(relatedSql.sameType).toContain("a.asset_type = ?");
    expect(relatedSql.sameType).toContain("LIMIT 3");
    expect(`${relatedSql.sameSource}${relatedSql.sameType}`).not.toContain("WITH target");
  });

  it("loads direct indexed related queries after resolving the asset", async () => {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
        prepared.push(...statements);
        return [
          {
            results: [
              {
                id: "asset_internet",
                slug: "internet",
                title: "Internet access",
                asset_type: "chart",
                source_name: "Example Source",
                source_updated_at: "2026-07-01",
              },
            ],
          },
          { results: [] },
        ];
      },
      prepare: (sql: string) => {
        const statement = {
          sql,
          values: [] as unknown[],
          bind: (...values: unknown[]) => {
            statement.values = values;
            return statement;
          },
          all: async () => ({
            results: [
              {
                id: "asset_solar",
                source_id: "source_owid",
                slug: "solar",
                asset_type: "chart",
                title: "Solar prices",
                description: "A reviewed chart.",
                canonical_url: "https://example.com/solar",
                embed_url: "https://example.com/embed/solar",
                preview_url: null,
                citation_text: "Source: Example.",
                attribution_name: "Example",
                attribution_url: "https://example.com",
                source_updated_at: "2026-08-01",
                last_checked_at: "2026-09-01",
                license_code: "CC_BY",
                rights_status: "safe",
                rights_json: JSON.stringify({ embed_allowed: true }),
                source_name: "Example Source",
                source_policy_url: "https://example.com/policy",
                search_indexable: 1,
              },
            ],
          }),
        };
        return statement;
      },
    } as unknown as D1Database;

    const result = await getPublishedAssetBySlug(db, "solar");

    expect(result?.asset.slug).toBe("solar");
    expect(result?.related[0]?.slug).toBe("internet");
    expect(prepared).toHaveLength(2);
    expect(prepared[0]?.values).toEqual(["source_owid", "source_owid", "solar"]);
    expect(prepared[1]?.values).toEqual(["chart", "solar", "source_owid", "source_owid"]);
  });

  it("keeps both related lookups on their bounded partial indexes", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE sources (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
        title TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        attribution_name TEXT,
        source_updated_at TEXT,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        rights_status TEXT NOT NULL
      );
    `);
    sqlite.exec(
      readFileSync(
        new URL("../migrations/0029_optimize_related_assets.sql", import.meta.url),
        "utf8",
      ),
    );

    const relatedSql = buildRelatedAssetsSql();
    const sourcePlan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${relatedSql.sameSource}`)
      .all("source_owid", "source_owid", "solar") as Array<{ detail: string }>;
    const typePlan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${relatedSql.sameType}`)
      .all("chart", "solar", "source_owid", "source_owid") as Array<{ detail: string }>;

    expect(sourcePlan.map(({ detail }) => detail).join("\n")).toContain(
      "SEARCH a USING INDEX assets_related_source_idx",
    );
    expect(typePlan.map(({ detail }) => detail).join("\n")).toContain(
      "SEARCH a USING INDEX assets_related_type_idx",
    );
    sqlite.close();
  });

  it("returns null when the slug is not published", async () => {
    const db = {
      batch: async () => {
        throw new Error("related queries must not run for a missing asset");
      },
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [] }),
        }),
      }),
    } as unknown as D1Database;

    await expect(getPublishedAssetBySlug(db, "missing")).resolves.toBeNull();
  });
});
