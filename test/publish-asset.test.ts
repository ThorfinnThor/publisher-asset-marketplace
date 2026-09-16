import { describe, expect, it } from "vitest";

import { buildCreatorAssetRecord, creatorAssetSlug } from "../src/lib/assets/publish-submission";

const submission = {
  id: "11111111-1111-4111-8111-111111111111",
  creator_id: "github:42",
  canonical_url: "https://creator.example/tools/churn",
  embed_url: "https://creator.example/embed/churn",
  preview_url: "https://creator.example/preview/churn",
  asset_type: "calculator" as const,
  title: "SaaS churn calculator",
  description: "Estimate monthly churn from your customer and revenue inputs.",
  attribution_name: "Example Tools",
  attribution_url: "https://creator.example",
  attribution_terms: "Credit Example Tools",
  declared_rights_json: JSON.stringify({
    embed_allowed: true,
    commercial_use: true,
    modification_allowed: false,
    citation_required: true,
  }),
  created_at: "2026-09-14T12:00:00.000Z",
  authorization_version: 1,
};

describe("E5 creator asset publishing", () => {
  it("generates a stable readable slug with an id suffix", () => {
    expect(creatorAssetSlug("SaaS churn calculator", submission.id)).toBe(
      "creator-saas-churn-calculator-111111111111",
    );
  });

  it("builds a published asset with reviewed rights and embed origin", () => {
    const result = buildCreatorAssetRecord(submission, {
      reviewed_by: "github:admin",
      rights_status: "safe",
      rights_reason_code: "manually_verified_third_party",
      rights_evidence_url: "https://creator.example/terms",
      title: null,
      description: null,
      attribution_name: null,
      attribution_terms: null,
      reviewed_at: "2026-09-14T13:00:00.000Z",
      sandbox_tested: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.creator_id).toBe("github:42");
    expect(result.value.embed_origin).toBe("https://creator.example");
    expect(result.value.rights_status).toBe("safe");
    expect(JSON.parse(result.value.rights_json)).toMatchObject({
      embed_allowed: true,
      commercial_use: true,
      evidence_url: "https://creator.example/terms",
    });
    expect(result.value.citation_text).toContain("SaaS churn calculator");
  });

  it("fails closed when the reviewed evidence is not a public HTTPS URL", () => {
    const result = buildCreatorAssetRecord(submission, {
      reviewed_by: "github:admin",
      rights_status: "safe",
      rights_reason_code: "manual_review",
      rights_evidence_url: "http://creator.example/terms",
      title: null,
      description: null,
      attribution_name: null,
      attribution_terms: null,
      reviewed_at: "2026-09-14T13:00:00.000Z",
      sandbox_tested: true,
    });
    expect(result).toEqual({ ok: false, code: "promotion_url_invalid" });
  });

  it("fails closed when a legacy submission has no preview image", () => {
    const result = buildCreatorAssetRecord(
      { ...submission, preview_url: null },
      {
        reviewed_by: "github:admin",
        rights_status: "safe",
        rights_reason_code: "manual_review",
        rights_evidence_url: "https://creator.example/terms",
        title: null,
        description: null,
        attribution_name: null,
        attribution_terms: null,
        reviewed_at: "2026-09-14T13:00:00.000Z",
        sandbox_tested: true,
      },
    );
    expect(result).toEqual({ ok: false, code: "promotion_preview_required" });
  });

  it("fails closed when the admin did not verify the fixed sandbox", () => {
    const result = buildCreatorAssetRecord(submission, {
      reviewed_by: "github:admin",
      rights_status: "safe",
      rights_reason_code: "manual_review",
      rights_evidence_url: "https://creator.example/terms",
      title: null,
      description: null,
      attribution_name: null,
      attribution_terms: null,
      reviewed_at: "2026-09-14T13:00:00.000Z",
      sandbox_tested: false as unknown as true,
    });
    expect(result).toEqual({ ok: false, code: "promotion_sandbox_test_required" });
  });
});
