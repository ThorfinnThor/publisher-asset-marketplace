import { describe, expect, it } from "vitest";

import {
  normalizePublicHttpsUrl,
  validateSubmissionPayload,
} from "../src/lib/submissions/validate";

const validSubmission = {
  canonical_url: "https://Example.com/chart#overview",
  asset_type: "chart",
  title: "A useful chart",
  description: "A chart that helps publishers understand a trend.",
  embed_url: "https://Example.com/embed/chart",
  preview_url: "https://Example.com/preview/chart.png",
  attribution_name: "Example Source",
  attribution_url: "https://example.com/rights",
  attribution_terms: "Credit Example Source",
  commercial_use: true,
  embed_allowed: true,
  modification_allowed: false,
  citation_required: true,
  sandbox_compatible: true,
  source_identity_confirmed: true,
  attribution_confirmed: true,
  preview_display_authorized: true,
  authorized_to_submit: true,
  commercial_marketplace_acknowledged: true,
  opportunity_topic: null,
};

describe("submission security validation", () => {
  it("normalizes accepted HTTPS URLs and removes fragments", () => {
    expect(normalizePublicHttpsUrl("https://Example.COM:443/chart#section")).toEqual({
      ok: true,
      value: "https://example.com/chart",
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://localhost/chart",
    "https://192.168.1.10/chart",
    "https://127.0.0.1/chart",
    "https://2130706433/chart",
    "https://[::1]/chart",
    "https://charts.service.internal/embed",
  ])("rejects unsafe URL %s", (value) => {
    expect(normalizePublicHttpsUrl(value).ok).toBe(false);
  });

  it("rejects raw HTML in metadata", () => {
    const result = validateSubmissionPayload({
      ...validSubmission,
      title: "<script>alert(1)</script>",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "raw_html_not_allowed",
      field: "title",
    });
  });

  it("requires a public HTTPS preview image URL", () => {
    expect(validateSubmissionPayload({ ...validSubmission, preview_url: null })).toMatchObject({
      ok: false,
      code: "preview_required",
      field: "preview_url",
    });
    expect(
      validateSubmissionPayload({
        ...validSubmission,
        preview_url: "http://example.com/chart.png",
      }),
    ).toMatchObject({ ok: false, code: "scheme_not_https", field: "preview_url" });
  });

  it("rejects unknown fields and missing authorization", () => {
    expect(validateSubmissionPayload({ ...validSubmission, creator_id: "creator:b" }).ok).toBe(
      false,
    );
    expect(
      validateSubmissionPayload({ ...validSubmission, authorized_to_submit: false }),
    ).toMatchObject({
      ok: false,
      code: "authorization_required",
    });
  });

  it("requires explicit source, attribution, and preview-display confirmations", () => {
    expect(
      validateSubmissionPayload({ ...validSubmission, source_identity_confirmed: false }),
    ).toMatchObject({ ok: false, code: "source_identity_confirmation_required" });
    expect(
      validateSubmissionPayload({ ...validSubmission, attribution_confirmed: false }),
    ).toMatchObject({ ok: false, code: "attribution_confirmation_required" });
    expect(
      validateSubmissionPayload({ ...validSubmission, preview_display_authorized: false }),
    ).toMatchObject({ ok: false, code: "preview_display_authorization_required" });
  });

  it("requires acknowledgement of the marketplace's commercial operation", () => {
    expect(
      validateSubmissionPayload({
        ...validSubmission,
        commercial_marketplace_acknowledged: false,
      }),
    ).toMatchObject({
      ok: false,
      code: "commercial_marketplace_acknowledgement_required",
      field: "commercial_marketplace_acknowledged",
    });
  });

  it("requires an explicit boolean for every rights answer", () => {
    expect(validateSubmissionPayload({ ...validSubmission, embed_allowed: "yes" })).toMatchObject({
      ok: false,
      code: "boolean_required",
      field: "embed_allowed",
    });
  });

  it("requires confirmation of the fixed sandbox compatibility test", () => {
    expect(
      validateSubmissionPayload({ ...validSubmission, sandbox_compatible: false }),
    ).toMatchObject({
      ok: false,
      code: "sandbox_compatibility_required",
      field: "sandbox_compatible",
    });
    const missingSandboxConfirmation = { ...validSubmission };
    Reflect.deleteProperty(missingSandboxConfirmation, "sandbox_compatible");
    expect(validateSubmissionPayload(missingSandboxConfirmation)).toMatchObject({
      ok: false,
      code: "sandbox_compatibility_required",
      field: "sandbox_compatible",
    });
  });

  it("normalizes an opportunity topic and rejects sensitive topics", () => {
    const result = validateSubmissionPayload({
      ...validSubmission,
      opportunity_topic: "SaaS churn rate",
    });
    expect(result).toMatchObject({ ok: true, value: { opportunityTopic: "saas churn" } });
    expect(
      validateSubmissionPayload({ ...validSubmission, opportunity_topic: "alice@example.test" }),
    ).toMatchObject({ ok: false, code: "invalid_opportunity_topic", field: "opportunity_topic" });
  });
});
