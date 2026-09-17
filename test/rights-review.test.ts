import { describe, expect, it } from "vitest";

import manifestJson from "../data/rights/owid-seed-rights-review-v1.json";
import eurostatManifestJson from "../data/rights/eurostat-pilot-rights-review-v1.json";
import {
  buildRightsReviewQueries,
  buildRightsReviewSql,
  parseRightsReviewManifest,
  prepareRightsReview,
  type RightsReviewAssetRow,
} from "../src/lib/rights/rights-review";

function row(
  slug: string,
  expectedRawData: true | false | null,
  overrides: Partial<RightsReviewAssetRow> = {},
): RightsReviewAssetRow {
  const originLicense = expectedRawData === true ? "CC BY 4.0" : "Provider copyright";
  return {
    id: `asset_owid_${slug}`,
    slug,
    canonical_url: `https://ourworldindata.org/grapher/${slug}`,
    citation_text: "Provider (2026); with processing by Our World in Data",
    rights_status: "unknown",
    status: "draft",
    metadata_json: JSON.stringify({
      source: "owid",
      rights_evidence: {
        chart_owner: null,
        chart_license_code: null,
        chart_license_raw: null,
        chart_license_url: null,
        chart_license_explicit: false,
        manual_review_completed: false,
        embed_available: true,
        chart_reuse_prohibited: null,
        evidence_conflict: false,
        citation_available: true,
        indicator_evidence: [
          {
            indicator_url: "https://api.ourworldindata.org/v1/indicators/1.metadata.json",
            non_redistributable: false,
            origins: [
              {
                license_code: expectedRawData === true ? "CC_BY" : "CUSTOM_OR_UNKNOWN",
                license_raw: originLicense,
                license_url: null,
              },
            ],
          },
        ],
        evidence_url: `https://ourworldindata.org/grapher/${slug}`,
        evidence_checked_at: "2026-09-12T00:00:00.000Z",
      },
    }),
    ...overrides,
  };
}

describe("rights evidence review", () => {
  it("parses and classifies the reviewed Eurostat pilot scope", () => {
    const manifest = parseRightsReviewManifest(eurostatManifestJson);
    const rows = manifest.assets.map((asset) => ({
      id: `asset_${asset.slug}`,
      slug: asset.slug,
      canonical_url: asset.canonical_url,
      citation_text: "Source: Eurostat.",
      attribution_name: "Eurostat",
      attribution_url: asset.attribution_url,
      rights_status: "unknown" as const,
      status: "draft" as const,
      metadata_json: JSON.stringify({
        source: "eurostat",
        rights_evidence: {
          chart_owner: "third_party",
          chart_license_code: "CUSTOM_OR_UNKNOWN",
          chart_license_raw: "Eurostat general reuse policy; item-level exceptions apply",
          chart_license_url: "https://ec.europa.eu/eurostat/help/copyright-notice",
          chart_license_explicit: false,
          manual_review_completed: false,
          embed_available: null,
          citation_only_allowed: true,
          chart_reuse_prohibited: null,
          evidence_conflict: false,
          citation_available: true,
          indicator_evidence: [
            {
              indicator_url:
                "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tps00001",
              non_redistributable: null,
              origins: [{ license_code: null, license_raw: null, license_url: null }],
            },
          ],
          evidence_url: asset.canonical_url,
          evidence_checked_at: "2026-09-17T00:00:00.000Z",
        },
      }),
    }));
    const plan = prepareRightsReview(rows, manifest);

    expect(plan.counts).toEqual({
      reviewed: 3,
      safe: 3,
      restricted: 0,
      unknown: 0,
      blocked: 0,
      raw_data_enabled: 3,
      raw_data_unverified: 0,
    });
    expect(plan.updates.every((update) => update.license_code === "EU_COMMISSION_REUSE_2011")).toBe(
      true,
    );
  });

  it("parses ten unique, asset-specific OWID decisions", () => {
    const manifest = parseRightsReviewManifest(manifestJson);

    expect(manifest.assets).toHaveLength(10);
    expect(new Set(manifest.assets.map((asset) => asset.slug)).size).toBe(10);
    expect(
      manifest.assets.every(
        (asset) => asset.canonical_url === asset.evidence_url && asset.chart_owner === "owid",
      ),
    ).toBe(true);
  });

  it("classifies the reviewed chart layer while keeping raw-data rights separate", () => {
    const manifest = parseRightsReviewManifest(manifestJson);
    const rows = manifest.assets.map((asset) =>
      row(asset.slug, asset.expected_raw_data_redistribution),
    );

    const plan = prepareRightsReview(rows, manifest);

    expect(plan.counts).toEqual({
      reviewed: 10,
      safe: 10,
      restricted: 0,
      unknown: 0,
      blocked: 0,
      raw_data_enabled: 5,
      raw_data_unverified: 5,
    });
    expect(plan.updates.every((update) => update.status === "draft")).toBe(true);
    expect(plan.updates.every((update) => update.reason_code === "verified_permissive_chart")).toBe(
      true,
    );
  });

  it("publishes only after the explicit publish option and records an idempotent review", () => {
    const manifest = parseRightsReviewManifest(manifestJson);
    const rows = manifest.assets.map((asset) =>
      row(asset.slug, asset.expected_raw_data_redistribution),
    );
    const plan = prepareRightsReview(rows, manifest, { publish: true });
    const sql = buildRightsReviewSql(plan);

    expect(plan.updates.every((update) => update.status === "published")).toBe(true);
    expect(sql).not.toContain("BEGIN TRANSACTION;");
    expect(sql).toContain("INSERT OR IGNORE INTO rights_reviews");
    expect(sql).toContain("rights_review_owid-seed-v1_active-mobile-money-accounts");
    expect(sql).toContain("status = 'published'");
    expect(sql).not.toContain("COMMIT;");

    const queries = buildRightsReviewQueries(plan);
    expect(queries).toHaveLength(20);
    expect(queries[0]?.sql).toContain("UPDATE assets SET license_code = ?");
    expect(queries[0]?.params).toContain("asset_owid_active-mobile-money-accounts");
    expect(queries[1]?.sql).toContain("INSERT OR IGNORE INTO rights_reviews");
  });

  it("fails closed when a reviewed URL drifts or a decision no longer matches evidence", () => {
    const manifest = parseRightsReviewManifest(manifestJson);
    const rows = manifest.assets.map((asset) =>
      row(asset.slug, asset.expected_raw_data_redistribution),
    );
    rows[0] = { ...rows[0]!, canonical_url: "https://ourworldindata.org/grapher/replaced" };

    expect(() => prepareRightsReview(rows, manifest)).toThrow("Canonical URL changed");

    const changedManifest = {
      ...manifest,
      assets: manifest.assets.map((asset, index) =>
        index === 0 ? { ...asset, expected_raw_data_redistribution: false as const } : asset,
      ),
    };
    const unchangedRows = manifest.assets.map((asset) =>
      row(asset.slug, asset.expected_raw_data_redistribution),
    );
    expect(() => prepareRightsReview(unchangedRows, changedManifest)).toThrow(
      "Raw-data decision mismatch",
    );
  });
});
