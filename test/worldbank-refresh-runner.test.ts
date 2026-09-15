import { describe, expect, it } from "vitest";

import {
  prepareWorldBankRefresh,
  selectWorldBankRefreshCandidates,
  type WorldBankRefreshAssetRow,
} from "../src/lib/ingest/worldbank-refresh-runner";
import type { WorldBankAssetFetch } from "../src/lib/ingest/worldbank-source-client";

const canonicalUrl = "https://data.worldbank.org/indicator/SP.POP.TOTL";
const apiUrl =
  "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=1";

function evidence(manual: boolean) {
  return {
    chart_owner: "third_party" as const,
    chart_license_code: manual ? ("CC_BY" as const) : ("CUSTOM_OR_UNKNOWN" as const),
    chart_license_raw: manual ? "CC BY-4.0" : null,
    chart_license_url: "https://data.worldbank.org/summary-terms-of-use",
    chart_license_explicit: manual,
    manual_review_completed: manual,
    embed_available: false as const,
    citation_only_allowed: manual,
    chart_reuse_prohibited: false as const,
    evidence_conflict: false,
    citation_available: true,
    indicator_evidence: [
      {
        indicator_url: apiUrl,
        non_redistributable: null,
        origins: [
          {
            license_code: "CUSTOM_OR_UNKNOWN" as const,
            license_raw: null,
            license_url: "https://data.worldbank.org/summary-terms-of-use",
          },
        ],
      },
    ],
    evidence_url: canonicalUrl,
    evidence_checked_at: "2026-09-15T10:17:50.000Z",
  };
}

function row(overrides: Partial<WorldBankRefreshAssetRow> = {}): WorldBankRefreshAssetRow {
  return {
    id: "asset_worldbank_sp.pop.totl",
    source_id: "source_worldbank",
    external_id: "SP.POP.TOTL",
    slug: "worldbank-sp.pop.totl",
    title: "Population, total",
    canonical_url: canonicalUrl,
    citation_text:
      "World Bank Open Data: Population, total (SP.POP.TOTL). Original sources retained.",
    attribution_name: "World Bank Open Data",
    attribution_url: canonicalUrl,
    rights_status: "safe",
    status: "published",
    source_updated_at: "2023",
    last_checked_at: "2024-01-01T00:00:00.000Z",
    created_at: "2026-09-15T10:29:21.674Z",
    metadata_json: JSON.stringify({ header: {}, rights_evidence: evidence(true) }),
    rights_json: JSON.stringify({ embed_allowed: false }),
    ...overrides,
  };
}

function fetched(header: Record<string, unknown> = {}): WorldBankAssetFetch {
  const rows = [
    {
      indicator: { id: "SP.POP.TOTL", value: "Population, total" },
      date: "2025",
      value: 1,
    },
  ];
  return {
    indicator: "SP.POP.TOTL",
    urls: { canonicalUrl, apiUrl, previewUrl: canonicalUrl },
    header,
    rows,
    normalized: {
      externalId: "SP.POP.TOTL",
      title: "Population, total",
      description: "World Bank indicator SP.POP.TOTL; latest fetched observation: 2025.",
      citationText: "World Bank Open Data: Population, total.",
      sourceUpdatedAt: "2025",
      canonicalUrl,
      embedUrl: null,
      previewUrl: null,
      assetType: "dataset",
      licenseCode: "CUSTOM_OR_UNKNOWN",
      attributionName: "World Bank Open Data",
      attributionUrl: canonicalUrl,
    },
    rightsEvidence: evidence(false),
    raw: { response: [header, rows] },
  };
}

describe("World Bank refresh runner", () => {
  it("does not refresh a current annual observation", () => {
    expect(
      selectWorldBankRefreshCandidates([row({ source_updated_at: "2025" })], {
        now: "2026-09-15T00:00:00.000Z",
      }),
    ).toHaveLength(0);
  });

  it("preserves a manual citation-only review during metadata refresh", async () => {
    const plan = await prepareWorldBankRefresh([row()], {
      now: "2026-09-15T12:00:00.000Z",
      run_id: "refresh_worldbank_test_1",
      source_client: {
        fetchAssets: async () => ({ successful: [fetched()], failed: [] }),
      },
    });
    const refreshed = plan.updates[0]?.refreshed;

    expect(plan.counts).toEqual({ candidates: 1, refreshed: 1, hidden: 0, errors: 0 });
    expect(refreshed).toMatchObject({
      status: "published",
      rights_status: "safe",
      embed_url: null,
      citation_text: expect.stringContaining("Original sources retained"),
    });
    expect(JSON.parse(refreshed!.rights_json)).toMatchObject({
      embed_allowed: false,
      raw_data_redistribution: null,
    });
  });

  it("moves a published asset back to review when source policy metadata changes", async () => {
    const changed = fetched({ license: "CC BY-NC 4.0" });
    const plan = await prepareWorldBankRefresh([row()], {
      now: "2026-09-15T12:00:00.000Z",
      source_client: {
        fetchAssets: async () => ({ successful: [changed], failed: [] }),
      },
    });

    expect(plan.updates[0]?.refreshed).toMatchObject({
      status: "review",
      rights_status: "blocked",
    });
    expect(plan.results[0]?.reason_code).toBe("source_policy_changed");
  });

  it("hides only an explicit 404 and leaves transient failures retryable", async () => {
    const missing = row({ external_id: "SP.MISSING", id: "missing", slug: "worldbank-missing" });
    const transient = row({
      external_id: "SP.TRANSIENT",
      id: "transient",
      slug: "worldbank-transient",
    });
    const plan = await prepareWorldBankRefresh([missing, transient], {
      now: "2026-09-15T12:00:00.000Z",
      source_client: {
        fetchAssets: async () => ({
          successful: [],
          failed: [
            {
              indicator: "SP.MISSING",
              error: {
                indicator: "SP.MISSING",
                endpoint: "indicator",
                code: "http_404",
                status: 404,
                message: "missing",
                attempts: 1,
              },
            },
            {
              indicator: "SP.TRANSIENT",
              error: {
                indicator: "SP.TRANSIENT",
                endpoint: "indicator",
                code: "http_503",
                status: 503,
                message: "busy",
                attempts: 3,
              },
            },
          ],
        }),
      },
    });

    expect(plan.hidden.map((asset) => asset.id)).toEqual(["missing"]);
    expect(plan.failed.map((asset) => asset.id)).toEqual(["transient"]);
  });
});
