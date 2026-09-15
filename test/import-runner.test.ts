import { describe, expect, it } from "vitest";

import {
  buildImportAssetRecord,
  buildOwidImportSql,
  prepareOwidImport,
  writeOwidImport,
} from "../src/lib/ingest/import-runner";
import type { OwidAssetFetch } from "../src/lib/ingest/owid-source-client";

const sampleAsset: OwidAssetFetch = {
  slug: "sample-chart",
  urls: {
    canonicalUrl: "https://ourworldindata.org/grapher/sample-chart",
    metadataUrl: "https://ourworldindata.org/grapher/sample-chart.metadata.json",
    configUrl: "https://ourworldindata.org/grapher/sample-chart.config.json",
    embedUrl: "https://ourworldindata.org/grapher/sample-chart?embed=1",
    previewUrl: "https://ourworldindata.org/grapher/sample-chart.png?imType=thumbnail&imWidth=640",
  },
  metadata: {
    chart: { title: "Sample chart", subtitle: "A chart about samples" },
    columns: {},
  },
  config: { id: 123, slug: "sample-chart", title: "Sample chart" },
  indicators: [
    {
      url: "https://api.ourworldindata.org/v1/indicators/456.metadata.json",
      metadata: {
        id: 456,
        nonRedistributable: false,
        origins: [
          {
            producer: "Sample provider",
            attributionShort: "Sample provider",
            urlMain: "https://example.test/provider",
            datePublished: "2025-01-15",
            license: {
              name: "CC BY 4.0",
              url: "https://example.test/provider/license",
            },
          },
        ],
      },
    },
  ],
  normalized: {
    externalId: "123",
    title: "Sample chart",
    description: "A chart about samples",
    citationText: "Sample provider (2025)",
    sourceUpdatedAt: "2025-01-15",
    canonicalUrl: "https://ourworldindata.org/grapher/sample-chart",
    embedUrl: "https://ourworldindata.org/grapher/sample-chart?embed=1",
    previewUrl: "https://ourworldindata.org/grapher/sample-chart.png?imType=thumbnail&imWidth=640",
    assetType: "chart",
    licenseCode: null,
    sourcePolicyUrl: "https://ourworldindata.org/faqs",
  },
  raw: {
    metadata: {
      chart: { title: "Sample chart", subtitle: "A chart about samples" },
      columns: {},
    },
    config: { id: 123, slug: "sample-chart", title: "Sample chart" },
    indicators: [
      {
        url: "https://api.ourworldindata.org/v1/indicators/456.metadata.json",
        metadata: {
          id: 456,
          nonRedistributable: false,
          origins: [
            {
              producer: "Sample provider",
              attributionShort: "Sample provider",
              urlMain: "https://example.test/provider",
              datePublished: "2025-01-15",
              license: {
                name: "CC BY 4.0",
                url: "https://example.test/provider/license",
              },
            },
          ],
        },
      },
    ],
  },
};

const fakeSourceClient = {
  fetchAssets: async () => ({ successful: [sampleAsset], failed: [] }),
};

describe("import runner", () => {
  it("builds a conservative draft asset from a fetched source", () => {
    const record = buildImportAssetRecord(sampleAsset, "2026-09-14T00:00:00.000Z");

    expect(record).toMatchObject({
      id: "asset_owid_sample-chart",
      source_id: "source_owid",
      external_id: "123",
      rights_status: "unknown",
      license_code: null,
      status: "draft",
      attribution_name: "Sample provider",
    });
    expect(JSON.parse(record.rights_json)).toMatchObject({
      embed_allowed: true,
      raw_data_redistribution: true,
    });
    expect(JSON.parse(record.metadata_json)).toHaveProperty("rights_evidence.chart_owner", null);
  });

  it("stores only bounded source fields needed for audit and refresh", () => {
    const asset: OwidAssetFetch = {
      ...sampleAsset,
      raw: {
        ...sampleAsset.raw,
        metadata: {
          ...sampleAsset.raw.metadata,
          unusedLargePayload: "x".repeat(200_000),
        },
        config: {
          ...sampleAsset.raw.config,
          dimensions: { unused: "x".repeat(200_000) },
        },
      },
    };

    const metadata = JSON.parse(
      buildImportAssetRecord(asset, "2026-09-14T00:00:00.000Z").metadata_json,
    );

    expect(metadata.metadata).not.toHaveProperty("unusedLargePayload");
    expect(metadata.config).not.toHaveProperty("dimensions");
    expect(metadata).toHaveProperty("indicators.0.metadata.origins.0.license.name", "CC BY 4.0");
    expect(metadata).toHaveProperty("rights_evidence.indicator_evidence.0.origins.0.license_code");
  });

  it("prepares an idempotent plan with duplicate, invalid, and upsert results", async () => {
    const plan = await prepareOwidImport(
      [
        "asset_url,title",
        "https://ourworldindata.org/grapher/sample-chart,First title",
        "https://ourworldindata.org/grapher/sample-chart,Duplicate title",
        "bad/slash,Bad input",
      ].join("\n"),
      "csv",
      {
        now: "2026-09-14T00:00:00.000Z",
        run_id: "ingest_test_1",
        source_client: fakeSourceClient,
      },
    );

    expect(plan.status).toBe("partial");
    expect(plan.counts).toEqual({ accepted: 1, duplicates: 1, invalid: 1, errors: 0 });
    expect(plan.results.map((result) => result.status)).toEqual([
      "duplicate",
      "invalid",
      "upserted",
    ]);
    expect(buildOwidImportSql(plan)).toContain("INSERT OR IGNORE INTO assets");
    expect(buildOwidImportSql(plan)).toContain("UPDATE assets SET source_id");
    expect(buildOwidImportSql(plan)).toContain(
      "WHERE length(substr(value, position, 3)) = 3;\n\nUPDATE ingest_runs",
    );
    expect(buildOwidImportSql(plan)).toContain("asset_owid_sample-chart");
    expect(buildOwidImportSql(plan, { rebuildSearchIndex: false })).not.toContain(
      "DELETE FROM asset_search_trigrams",
    );
  });

  it("writes a plan in bounded D1 batches and finalizes the run", async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql.trim().split("\n")[0] ?? sql);
        return {
          bind: (...values: unknown[]) => {
            calls.push(`bind:${values.length}`);
            return { run: async () => ({ success: true }) };
          },
        };
      },
      batch: async (statements: unknown[]) => {
        calls.push(`batch:${statements.length}`);
        return statements;
      },
    } as unknown as D1Database;
    const plan = await prepareOwidImport("https://ourworldindata.org/grapher/sample-chart", "txt", {
      now: "2026-09-14T00:00:00.000Z",
      run_id: "ingest_test_2",
      source_client: fakeSourceClient,
    });

    const result = await writeOwidImport(db, plan, 1);

    expect(result.database_written).toBe(true);
    expect(calls.filter((call) => call.startsWith("batch:")).length).toBe(3);
    expect(calls.some((call) => call.startsWith("UPDATE ingest_runs"))).toBe(true);
  });
});
