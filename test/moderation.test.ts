import { describe, expect, it } from "vitest";

import { isReviewableStatus, validateReviewPayload } from "../src/lib/admin/moderation";

const approvedReview = {
  decision: "approved",
  review_notes: "Checked the source terms and confirmed the embed boundary.",
  rights_status: "safe",
  rights_reason_code: "source_terms",
  rights_evidence_url: "https://example.com/terms#embedding",
};

describe("submission moderation contract", () => {
  it("accepts an approved review with rights evidence", () => {
    expect(validateReviewPayload(approvedReview)).toMatchObject({
      ok: true,
      value: {
        decision: "approved",
        rightsStatus: "safe",
        rightsEvidenceUrl: "https://example.com/terms",
      },
    });
  });

  it("requires evidence and an allowed rights status before approval", () => {
    expect(validateReviewPayload({ ...approvedReview, rights_evidence_url: null })).toMatchObject({
      ok: false,
      code: "approved_rights_evidence_required",
    });
    expect(validateReviewPayload({ ...approvedReview, rights_status: "blocked" })).toMatchObject({
      ok: false,
      code: "blocked_asset_cannot_approve",
    });
  });

  it("requires a meaningful audit note and rejects unknown fields", () => {
    expect(validateReviewPayload({ ...approvedReview, review_notes: "short" })).toMatchObject({
      ok: false,
      code: "text_too_short",
    });
    expect(validateReviewPayload({ ...approvedReview, creator_id: "creator:other" })).toMatchObject(
      {
        ok: false,
        code: "unknown_field",
      },
    );
  });

  it("accepts normalized metadata edits as plain text", () => {
    expect(
      validateReviewPayload({
        ...approvedReview,
        title: "Reviewed title",
        description: "A normalized description long enough for the review contract.",
        attribution_name: "Reviewed source",
        attribution_terms: "Credit Reviewed source",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        title: "Reviewed title",
        attributionName: "Reviewed source",
      },
    });
  });

  it("allows pending and needs-changes items only", () => {
    expect(isReviewableStatus("pending")).toBe(true);
    expect(isReviewableStatus("needs_changes")).toBe(true);
    expect(isReviewableStatus("approved")).toBe(false);
    expect(isReviewableStatus("rejected")).toBe(false);
  });
});
