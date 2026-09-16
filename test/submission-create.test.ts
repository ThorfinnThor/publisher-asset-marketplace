import { describe, expect, it } from "vitest";

import { buildSubmissionInsertBindings, submissionInsertSql } from "../src/lib/submissions/create";
import { runSubmissionPreScreen } from "../src/lib/submissions/pre-screen";
import type { ValidatedSubmission } from "../src/lib/submissions/validate";

const submission: ValidatedSubmission = {
  canonicalUrl: "https://example.com/chart",
  embedUrl: "https://example.com/embed/chart",
  previewUrl: "https://example.com/chart.png",
  assetType: "chart",
  title: "Example chart",
  description: "A useful example chart for publisher articles.",
  attributionName: "Example",
  attributionUrl: "https://example.com/about",
  attributionTerms: "Credit Example",
  rights: {
    schema_version: 1,
    embed_allowed: true,
    commercial_use: true,
    modification_allowed: false,
    citation_required: true,
    sandbox_compatible: true,
    sandbox_profile: "v1:allow-scripts",
    attribution_required: true,
    attribution_terms: "Credit Example",
    source_identity_confirmed: true,
    attribution_confirmed: true,
    preview_display_authorized: true,
    submitter_authorized: true,
    commercial_marketplace_acknowledged: true,
  },
  opportunityTopic: null,
};

describe("submission insert contract", () => {
  it("keeps SQL placeholders aligned with D1 bindings", () => {
    const bindings = buildSubmissionInsertBindings({
      id: "submission-1",
      creatorId: "github:1",
      submission,
      preScreen: runSubmissionPreScreen(submission),
      now: "2026-09-15T14:00:00.000Z",
      since: "2026-09-14T14:00:00.000Z",
      submissionLimit: 10,
    });
    expect(submissionInsertSql.match(/\?/gu)).toHaveLength(bindings.length);
    expect(bindings).toHaveLength(22);
    expect(bindings.slice(16, 19)).toEqual([
      "2026-09-15T14:00:00.000Z",
      "2026-09-15T14:00:00.000Z",
      "2026-09-15T14:00:00.000Z",
    ]);
  });
});
