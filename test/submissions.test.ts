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
  preview_url: null,
  attribution_name: "Example Source",
  attribution_url: "https://example.com/rights",
  attribution_terms: "Credit Example Source",
  commercial_use: true,
  embed_allowed: true,
  modification_allowed: false,
  citation_required: true,
  authorized_to_submit: true,
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

  it("keeps markup-like metadata as plain text data", () => {
    const result = validateSubmissionPayload({
      ...validSubmission,
      title: "<script>alert(1)</script>",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe("<script>alert(1)</script>");
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

  it("requires an explicit boolean for every rights answer", () => {
    expect(validateSubmissionPayload({ ...validSubmission, embed_allowed: "yes" })).toMatchObject({
      ok: false,
      code: "boolean_required",
      field: "embed_allowed",
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
