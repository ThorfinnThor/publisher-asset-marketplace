import { describe, expect, it } from "vitest";

import {
  buildAssetDetailSql,
  buildRelatedAssetsSql,
  getPublishedAssetBySlug,
} from "../src/lib/assets/get-asset";

describe("C4 published asset detail", () => {
  it("keeps detail and related queries restricted to published, reviewed assets", () => {
    expect(buildAssetDetailSql()).toContain("a.status = 'published'");
    expect(buildAssetDetailSql()).toContain("a.rights_status IN ('safe', 'restricted')");
    expect(buildAssetDetailSql()).toContain("a.search_indexable");
    expect(buildRelatedAssetsSql()).toContain("LIMIT 3");
    expect(buildRelatedAssetsSql()).toContain("a.slug <> ?");
  });

  it("loads the detail and related cards in one D1 batch", async () => {
    const calls: unknown[][] = [];
    const db = {
      batch: async (statements: Array<{ bind: (...values: unknown[]) => unknown }>) => {
        calls.push(statements.map((statement) => statement));
        return [
          {
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
          },
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
        ];
      },
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({ sql, values }),
      }),
    } as unknown as D1Database;

    const result = await getPublishedAssetBySlug(db, "solar");

    expect(result?.asset.slug).toBe("solar");
    expect(result?.related[0]?.slug).toBe("internet");
    expect(calls).toHaveLength(1);
  });

  it("returns null when the slug is not published", async () => {
    const db = {
      batch: async () => [{ results: [] }, { results: [] }],
      prepare: () => ({ bind: () => ({}) }),
    } as unknown as D1Database;

    await expect(getPublishedAssetBySlug(db, "missing")).resolves.toBeNull();
  });
});
