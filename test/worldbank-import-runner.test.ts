import { describe, expect, it } from "vitest";

import {
  buildWorldBankImportSql,
  buildWorldBankImportAssetRecord,
  prepareWorldBankImport,
} from "../src/lib/ingest/worldbank-import-runner";
import type { WorldBankAssetFetch } from "../src/lib/ingest/worldbank-source-client";

const sampleAsset: WorldBankAssetFetch = {
  indicator: "SP.SAMPLE",
  urls: {
    canonicalUrl: "https://data.worldbank.org/indicator/SP.SAMPLE",
    apiUrl: "https://api.worldbank.org/v2/country/all/indicator/SP.SAMPLE?format=json&per_page=1",
    previewUrl: "https://data.worldbank.org/indicator/SP.SAMPLE",
  },
  header: { license: "CC BY 4.0" },
  rows: [{ indicator: { id: "SP.SAMPLE", value: "Sample indicator" }, date: "2024", value: 42 }],
  normalized: {
    externalId: "SP.SAMPLE",
    title: "Sample indicator",
    description: "World Bank indicator SP.SAMPLE; latest fetched observation: 2024.",
    citationText: "World Bank: Sample indicator.",
    sourceUpdatedAt: "2024",
    canonicalUrl: "https://data.worldbank.org/indicator/SP.SAMPLE",
    embedUrl: null,
    previewUrl: null,
    assetType: "dataset",
    licenseCode: "CC_BY",
    attributionName: "World Bank Open Data",
    attributionUrl: "https://data.worldbank.org/indicator/SP.SAMPLE",
  },
  rightsEvidence: {
    chart_owner: "third_party",
    chart_license_code: "CC_BY",
    chart_license_raw: "CC BY 4.0",
    chart_license_url: "https://creativecommons.org/licenses/by/4.0/",
    chart_license_explicit: true,
    manual_review_completed: false,
    embed_available: false,
    citation_only_allowed: false,
    chart_reuse_prohibited: null,
    evidence_conflict: false,
    citation_available: true,
    indicator_evidence: [
      {
        indicator_url:
          "https://api.worldbank.org/v2/country/all/indicator/SP.SAMPLE?format=json&per_page=1",
        non_redistributable: null,
        origins: [
          {
            license_code: "CC_BY",
            license_raw: "CC BY 4.0",
            license_url: "https://creativecommons.org/licenses/by/4.0/",
          },
        ],
      },
    ],
    evidence_url: "https://data.worldbank.org/indicator/SP.SAMPLE",
    evidence_checked_at: null,
  },
  raw: {
    response: [
      { license: "CC BY 4.0" },
      [{ indicator: { id: "SP.SAMPLE", value: "Sample indicator" }, date: "2024", value: 42 }],
    ],
  },
};

describe("World Bank import runner", () => {
  it("maps non-embeddable records into the common draft pipeline", () => {
    const record = buildWorldBankImportAssetRecord(sampleAsset, "2026-09-15T00:00:00.000Z");

    expect(record).toMatchObject({
      id: "asset_worldbank_sp.sample",
      source_id: "source_worldbank",
      slug: "worldbank-sp.sample",
      asset_type: "dataset",
      embed_url: null,
      status: "draft",
      rights_status: "blocked",
      license_code: "CC_BY",
    });
    expect(JSON.parse(record.rights_json)).toMatchObject({
      embed_allowed: false,
      commercial_use: true,
    });
  });

  it("creates an idempotent common import plan and SQL", async () => {
    const plan = await prepareWorldBankImport(["SP.SAMPLE"], {
      now: "2026-09-15T00:00:00.000Z",
      run_id: "ingest_worldbank_test_1",
      source_client: { fetchAssets: async () => ({ successful: [sampleAsset], failed: [] }) },
    });

    expect(plan.status).toBe("succeeded");
    expect(plan.source_id).toBe("source_worldbank");
    expect(buildWorldBankImportSql(plan)).toContain("asset_worldbank_sp.sample");
    expect(buildWorldBankImportSql(plan)).toContain("embed_url");
  });
});
