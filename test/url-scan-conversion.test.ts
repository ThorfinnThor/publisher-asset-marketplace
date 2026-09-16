import { describe, expect, it } from "vitest";

import { runSubmissionPreScreen } from "../src/lib/submissions/pre-screen";
import {
  buildConversionSubmissionInsertBindings,
  conversionScanUpdateSql,
  conversionSubmissionInsertSql,
  scanAllowsCanonical,
} from "../src/lib/submissions/url-scan-conversion";
import type { ValidatedSubmission } from "../src/lib/submissions/validate";

const submission: ValidatedSubmission = {
  canonicalUrl: "https://example.com/tool",
  embedUrl: "https://example.com/embed/tool",
  previewUrl: "https://example.com/previews/tool.png",
  assetType: "calculator",
  title: "Example calculator",
  description: "A useful calculator for an end-to-end publisher workflow.",
  attributionName: "Example",
  attributionUrl: "https://example.com/rights",
  attributionTerms: "Credit Example — CC BY 4.0",
  rights: {
    schema_version: 1,
    embed_allowed: true,
    commercial_use: true,
    modification_allowed: false,
    citation_required: true,
    sandbox_compatible: true,
    sandbox_profile: "v1:allow-scripts",
    attribution_required: true,
    attribution_terms: "Credit Example — CC BY 4.0",
    source_identity_confirmed: true,
    attribution_confirmed: true,
    preview_display_authorized: true,
    submitter_authorized: true,
    commercial_marketplace_acknowledged: true,
    creator_terms_accepted: true,
  },
  opportunityTopic: null,
};

describe("URL scan conversion gate", () => {
  it("accepts only the requested, final, or canonical URL from the scan packet", () => {
    const scan = {
      requested_url_normalized: "https://example.com/tool",
      result_json: JSON.stringify({
        final_url: "https://example.com/tool/",
        canonical_url_candidate: "https://www.example.com/tool",
      }),
    };
    expect(scanAllowsCanonical(scan, "https://example.com/tool")).toBe(true);
    expect(scanAllowsCanonical(scan, "https://example.com/tool/")).toBe(true);
    expect(scanAllowsCanonical(scan, "https://www.example.com/tool")).toBe(true);
    expect(scanAllowsCanonical(scan, "https://attacker.example.net/tool")).toBe(false);
  });

  it("fails closed when stored scanner JSON is malformed", () => {
    expect(
      scanAllowsCanonical(
        { requested_url_normalized: "https://example.com/tool", result_json: "not-json" },
        "https://attacker.example.net/tool",
      ),
    ).toBe(false);
  });

  it("keeps the conditional insert and bindings aligned", () => {
    const bindings = buildConversionSubmissionInsertBindings({
      id: "submission-1",
      creatorId: "github:1",
      scanId: "123e4567-e89b-42d3-a456-426614174000",
      submission,
      preScreen: runSubmissionPreScreen(submission),
      now: "2026-09-16T12:00:00.000Z",
      since: "2026-09-15T12:00:00.000Z",
      submissionLimit: 10,
    });
    expect(conversionSubmissionInsertSql.match(/\?/gu)).toHaveLength(bindings.length);
    expect(conversionSubmissionInsertSql).toContain("4, 'pending'");
    expect(bindings).toHaveLength(25);
    expect(conversionScanUpdateSql.match(/\?/gu)).toHaveLength(8);
    expect(String(bindings[13])).toContain('"source_scan_id"');
  });

  it("requires the scan to remain owner-bound, unexpired, and needs_confirmation in SQL", () => {
    expect(conversionSubmissionInsertSql).toContain("creator_id = ?");
    expect(conversionSubmissionInsertSql).toContain("status = 'needs_confirmation'");
    expect(conversionSubmissionInsertSql).toContain("submission_id IS NULL");
    expect(conversionSubmissionInsertSql).toContain("expires_at > ?");
    expect(conversionScanUpdateSql).toContain("status = 'converted'");
  });
});
