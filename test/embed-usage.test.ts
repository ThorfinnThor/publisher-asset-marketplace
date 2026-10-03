import { describe, expect, it } from "vitest";

import {
  isIframeEmbedRequest,
  marketplaceEmbedSlug,
  publisherOriginFromRequest,
  recordEmbedUsage,
  resolveTrackedEmbedTarget,
  trackedSourceEmbedSlug,
} from "../src/lib/analytics/embed-usage";

describe("embed usage analytics", () => {
  it("recognizes tracked and marketplace embed paths without accepting extra segments", () => {
    expect(trackedSourceEmbedSlug("/e/solar-pv-prices")).toBe("solar-pv-prices");
    expect(trackedSourceEmbedSlug("/e/solar-pv-prices/")).toBe("solar-pv-prices");
    expect(trackedSourceEmbedSlug("/e/solar-pv-prices/extra")).toBeNull();

    expect(marketplaceEmbedSlug("/embed/worldbank-fb.bnk.capa.zs")).toBe(
      "worldbank-fb.bnk.capa.zs",
    );
    expect(marketplaceEmbedSlug("/embed/eurostat-tps00001")).toBe("eurostat-tps00001");
    expect(marketplaceEmbedSlug("/embed/creator-unreviewed")).toBeNull();
  });

  it("counts only explicit iframe GET requests", () => {
    expect(
      isIframeEmbedRequest(
        new Request("https://citesupply.com/e/solar", {
          headers: { "sec-fetch-dest": "iframe" },
        }),
      ),
    ).toBe(true);
    expect(isIframeEmbedRequest(new Request("https://citesupply.com/e/solar"))).toBe(false);
    expect(
      isIframeEmbedRequest(
        new Request("https://citesupply.com/e/solar", {
          method: "HEAD",
          headers: { "sec-fetch-dest": "iframe" },
        }),
      ),
    ).toBe(false);
  });

  it("resolves a derived OWID Grapher embed through the tracked delivery path", async () => {
    const row = {
      slug: "solar-pv-prices",
      source_id: "source_owid",
      canonical_url: "https://ourworldindata.org/grapher/solar-pv-prices",
      embed_url: null,
      embed_origin: null,
      rights_json: JSON.stringify({ embed_allowed: true, attribution_required: true }),
      rights_status: "safe",
      title: "Solar PV prices",
      attribution_name: "Our World in Data",
      attribution_url: "https://ourworldindata.org/",
      source_base_url: "https://ourworldindata.org",
    };
    const db = {
      prepare() {
        return {
          bind() {
            return {
              first: async () => row,
            };
          },
        };
      },
    } as unknown as D1Database;

    await expect(resolveTrackedEmbedTarget(db, row.slug)).resolves.toEqual({
      target: "https://ourworldindata.org/grapher/solar-pv-prices?embed=1",
      provenance: "source_hosted",
    });
  });

  it("reduces external referrers to an origin and suppresses Cite Supply self-referrers", () => {
    const external = new Request("https://citesupply.com/e/solar", {
      headers: {
        referer: "https://publisher.example/article/energy?utm_source=test",
        "sec-fetch-dest": "iframe",
      },
    });
    expect(publisherOriginFromRequest(external)).toBe("https://publisher.example");

    const internal = new Request("https://citesupply.com/e/solar", {
      headers: { referer: "https://citesupply.com/asset/solar" },
    });
    expect(publisherOriginFromRequest(internal)).toBeNull();

    const missing = new Request("https://citesupply.com/e/solar");
    expect(publisherOriginFromRequest(missing)).toBeNull();
  });

  it("writes hashed publisher usage to Analytics Engine without D1 writes by default", async () => {
    const { db, prepared, batches } = recordingDatabase();
    const points: AnalyticsEngineDataPoint[] = [];
    const analytics: AnalyticsEngineDataset = {
      writeDataPoint(point) {
        points.push(point ?? {});
      },
    };
    const request = new Request("https://citesupply.com/e/solar-pv-prices", {
      headers: {
        referer: "https://publisher.example/article/private-path?campaign=one",
        "sec-fetch-dest": "iframe",
      },
    });

    await recordEmbedUsage(db, analytics, "solar-pv-prices", request, "source_hosted", {
      now: new Date("2026-09-19T12:34:56.000Z"),
    });

    expect(points).toHaveLength(1);
    expect(points[0]?.blobs?.[0]).toBe("solar-pv-prices");
    expect(points[0]?.blobs?.[1]).toMatch(/^[a-f0-9]{64}$/u);
    expect(points[0]?.blobs?.[1]).not.toContain("publisher.example");
    expect(points[0]?.blobs?.[2]).toBe("source_hosted");
    expect(points[0]?.doubles).toEqual([1]);
    expect(points[0]?.indexes?.[0]).toMatch(/^[a-f0-9]{64}$/u);
    expect(prepared).toHaveLength(0);
    expect(batches).toHaveLength(0);
  });

  it("writes compact daily D1 aggregates only after an explicit opt-in", async () => {
    const { db, prepared, batches } = recordingDatabase();
    const points: AnalyticsEngineDataPoint[] = [];
    const analytics: AnalyticsEngineDataset = {
      writeDataPoint(point) {
        points.push(point ?? {});
      },
    };
    const request = new Request("https://citesupply.com/e/solar-pv-prices", {
      headers: {
        referer: "https://publisher.example/article/private-path?campaign=one",
        "sec-fetch-dest": "iframe",
      },
    });

    await recordEmbedUsage(db, analytics, "solar-pv-prices", request, "source_hosted", {
      now: new Date("2026-09-19T12:34:56.000Z"),
      writeD1Aggregates: true,
    });

    expect(points).toHaveLength(1);
    expect(points[0]?.blobs?.[1]).toMatch(/^[a-f0-9]{64}$/u);
    expect(prepared).toHaveLength(2);
    expect(prepared[0]?.values).toEqual([
      "solar-pv-prices",
      "2026-09-19",
      0,
      "2026-09-19T12:34:56.000Z",
      "2026-09-19T12:34:56.000Z",
    ]);
    expect(prepared[1]?.values).toEqual([
      "solar-pv-prices",
      points[0]?.blobs?.[1],
      "2026-09-19",
      "2026-09-19T12:34:56.000Z",
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it("counts missing referrers as loads without creating publisher-site rows", async () => {
    const { db, prepared, batches } = recordingDatabase();
    const points: AnalyticsEngineDataPoint[] = [];
    const analytics: AnalyticsEngineDataset = {
      writeDataPoint(point) {
        points.push(point ?? {});
      },
    };

    await recordEmbedUsage(
      db,
      analytics,
      "worldbank-fb.bnk.capa.zs",
      new Request("https://citesupply.com/embed/worldbank-fb.bnk.capa.zs", {
        headers: { "sec-fetch-dest": "iframe" },
      }),
      "marketplace_rendered",
      {
        now: new Date("2026-09-19T23:00:00.000Z"),
        writeD1Aggregates: true,
      },
    );

    expect(points[0]?.blobs).toEqual([
      "worldbank-fb.bnk.capa.zs",
      "unknown",
      "marketplace_rendered",
    ]);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.values?.[2]).toBe(1);
    expect(batches[0]).toHaveLength(1);
  });

  it("does not write analytics or D1 rows for non-iframe requests", async () => {
    const { db, prepared, batches } = recordingDatabase();
    let pointCount = 0;
    const analytics: AnalyticsEngineDataset = {
      writeDataPoint() {
        pointCount += 1;
      },
    };

    await recordEmbedUsage(
      db,
      analytics,
      "solar-pv-prices",
      new Request("https://citesupply.com/e/solar-pv-prices"),
      "source_hosted",
    );

    expect(pointCount).toBe(0);
    expect(prepared).toHaveLength(0);
    expect(batches).toHaveLength(0);
  });
});

function recordingDatabase(): {
  db: D1Database;
  prepared: Array<{ sql: string; values: unknown[] }>;
  batches: unknown[][];
} {
  const prepared: Array<{ sql: string; values: unknown[] }> = [];
  const batches: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const statement = { sql, values };
          prepared.push(statement);
          return statement;
        },
      };
    },
    async batch(statements: unknown[]) {
      batches.push(statements);
      return [];
    },
  } as unknown as D1Database;
  return { db, prepared, batches };
}
