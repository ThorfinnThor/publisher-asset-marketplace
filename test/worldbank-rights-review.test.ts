import { describe, expect, it } from "vitest";

import manifestJson from "../data/rights/worldbank-population-total-v1.json";
import {
  buildRightsReviewSql,
  parseRightsReviewManifest,
  prepareRightsReview,
  type RightsReviewAssetRow,
} from "../src/lib/rights/rights-review";

const row: RightsReviewAssetRow = {
  id: "asset_worldbank_sp.pop.totl",
  slug: "worldbank-sp.pop.totl",
  canonical_url: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  citation_text: "World Bank Open Data: Population, total.",
  attribution_name: "World Bank Open Data",
  attribution_url: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  rights_status: "blocked",
  status: "draft",
  metadata_json: JSON.stringify({
    source: "worldbank",
    rights_evidence: {
      chart_owner: "third_party",
      chart_license_code: "CUSTOM_OR_UNKNOWN",
      chart_license_raw: null,
      chart_license_url: "https://data.worldbank.org/summary-terms-of-use",
      chart_license_explicit: false,
      manual_review_completed: false,
      embed_available: false,
      citation_only_allowed: false,
      chart_reuse_prohibited: null,
      evidence_conflict: false,
      citation_available: true,
      indicator_evidence: [
        {
          indicator_url:
            "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=400&mrnev=1",
          non_redistributable: null,
          origins: [
            {
              license_code: "CUSTOM_OR_UNKNOWN",
              license_raw: null,
              license_url: "https://data.worldbank.org/summary-terms-of-use",
            },
          ],
        },
      ],
      evidence_url: "https://data.worldbank.org/indicator/SP.POP.TOTL",
      evidence_checked_at: "2026-09-15T10:15:12.138Z",
    },
  }),
};

describe("World Bank rights review", () => {
  it("publishes only citation and source-link capabilities", () => {
    const manifest = parseRightsReviewManifest(manifestJson);
    const plan = prepareRightsReview([row], manifest, { publish: true });
    const update = plan.updates[0];

    expect(plan.counts).toMatchObject({ safe: 1, raw_data_enabled: 0 });
    expect(update).toMatchObject({
      rights_status: "safe",
      reason_code: "manually_verified_third_party",
      status: "published",
      attribution_name: "World Bank Open Data",
    });
    expect(JSON.parse(update!.rights_json)).toMatchObject({
      embed_allowed: false,
      commercial_use: true,
      raw_data_redistribution: null,
    });
    expect(buildRightsReviewSql(plan)).toContain("citation_text = 'World Bank Open Data");
  });

  it("rejects a citation-only review that also claims an embed", () => {
    const invalid = structuredClone(manifestJson);
    invalid.assets[0]!.embed_available = true;
    expect(() => parseRightsReviewManifest(invalid)).toThrow(
      "Citation-only review cannot declare an embed available",
    );
  });
});
