import { describe, expect, it } from "vitest";

import {
  parseStoredSubmissionPreScreen,
  runSubmissionPreScreen,
} from "../src/lib/submissions/pre-screen";
import type { ValidatedSubmission } from "../src/lib/submissions/validate";

const submission: ValidatedSubmission = {
  canonicalUrl: "https://example.com/charts/churn",
  embedUrl: "https://charts.example.com/embed/churn",
  previewUrl: "https://cdn.example.com/images/churn.png",
  assetType: "chart",
  title: "Monthly customer churn",
  description: "A chart showing monthly customer churn over time.",
  attributionName: "Example Analytics",
  attributionUrl: "https://example.com/about",
  attributionTerms: "Credit Example Analytics",
  rights: {
    schema_version: 1,
    embed_allowed: true,
    commercial_use: true,
    modification_allowed: false,
    citation_required: true,
    attribution_required: true,
    attribution_terms: "Credit Example Analytics",
    submitter_authorized: true,
  },
  opportunityTopic: null,
};

describe("submission automated pre-screen", () => {
  it("passes a source-hosted submission with a direct preview image", () => {
    const result = runSubmissionPreScreen(submission);
    expect(result.status).toBe("pass");
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("flags external hosts, promotional attribution, and restricted reuse", () => {
    const result = runSubmissionPreScreen({
      ...submission,
      embedUrl: "https://widgets.example-provider.net/churn",
      previewUrl: "https://images.example-provider.net/render?id=1",
      attributionName: "Click here for backlinks",
      rights: { ...submission.rights, embed_allowed: false, commercial_use: false },
    });
    expect(result.status).toBe("review");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "embed_host", status: "review" }),
        expect.objectContaining({ code: "preview_format", status: "review" }),
        expect.objectContaining({ code: "attribution_language", status: "review" }),
        expect.objectContaining({ code: "declared_reuse", status: "review" }),
      ]),
    );
  });

  it("fails closed when a stored checklist is malformed", () => {
    expect(
      parseStoredSubmissionPreScreen('{"schema_version":1,"status":"pass","checks":[1]}'),
    ).toEqual({ schema_version: 1, status: "review", checks: [] });
    expect(parseStoredSubmissionPreScreen("not-json")).toEqual({
      schema_version: 1,
      status: "review",
      checks: [],
    });
  });
});
