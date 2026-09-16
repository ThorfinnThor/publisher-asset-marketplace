import { describe, expect, it } from "vitest";

import {
  autonomousPublisherId,
  autonomousRightsReasonCode,
  planAutonomousPublication,
  validatedSubmissionFromStored,
} from "../src/lib/submissions/auto-publish";
import { buildDeclaredRightsJson } from "../src/lib/submissions/create";
import { runSubmissionPreScreen } from "../src/lib/submissions/pre-screen";
import type { ValidatedSubmission } from "../src/lib/submissions/validate";

const now = "2026-09-16T15:00:00.000Z";
const submission: ValidatedSubmission = {
  canonicalUrl: "https://example.com/tool",
  embedUrl: "https://example.com/embed/tool",
  previewUrl: "https://example.com/previews/tool.png",
  assetType: "calculator",
  title: "Example calculator",
  description: "A useful calculator for an autonomous publication test.",
  attributionName: "Example",
  attributionUrl: "https://example.com/rights",
  attributionTerms: "Credit Example — embedding and commercial use permitted",
  rights: {
    schema_version: 1,
    embed_allowed: true,
    commercial_use: true,
    modification_allowed: false,
    citation_required: true,
    sandbox_compatible: true,
    sandbox_profile: "v1:allow-scripts",
    attribution_required: true,
    attribution_terms: "Credit Example — embedding and commercial use permitted",
    source_identity_confirmed: true,
    attribution_confirmed: true,
    preview_display_authorized: true,
    submitter_authorized: true,
  },
  opportunityTopic: null,
};

describe("autonomous creator publication", () => {
  it("builds a restricted published asset after every deterministic check passes", () => {
    const declaredRightsJson = buildDeclaredRightsJson(submission, now);
    const result = planAutonomousPublication({
      id: "11111111-1111-4111-8111-111111111111",
      creatorId: "github:42",
      submission,
      declaredRightsJson,
      preScreen: runSubmissionPreScreen(submission),
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.asset.rights_status).toBe("restricted");
    expect(JSON.parse(result.value.asset.metadata_json)).toMatchObject({
      reviewed_by: autonomousPublisherId,
      rights_reason_code: autonomousRightsReasonCode,
    });
    expect(JSON.parse(result.value.asset.rights_json)).toMatchObject({
      evidence_url: submission.attributionUrl,
      embed_allowed: true,
      commercial_use: true,
    });
  });

  it("refuses publication when any deterministic check needs correction", () => {
    const preScreen = runSubmissionPreScreen({
      ...submission,
      embedUrl: "https://unrelated.example.net/embed/tool",
    });
    expect(
      planAutonomousPublication({
        id: "11111111-1111-4111-8111-111111111111",
        creatorId: "github:42",
        submission,
        declaredRightsJson: buildDeclaredRightsJson(submission, now),
        preScreen,
        now,
      }),
    ).toEqual({ ok: false, code: "auto_publish_checks_failed" });
  });

  it("revalidates stored submissions before a legacy queue item can auto-publish", () => {
    const declaredRightsJson = buildDeclaredRightsJson(submission, now);
    expect(
      validatedSubmissionFromStored({
        id: "11111111-1111-4111-8111-111111111111",
        creator_id: "github:42",
        canonical_url: submission.canonicalUrl,
        embed_url: submission.embedUrl,
        preview_url: submission.previewUrl,
        asset_type: submission.assetType,
        title: submission.title,
        description: submission.description,
        attribution_name: submission.attributionName,
        attribution_url: submission.attributionUrl,
        attribution_terms: submission.attributionTerms,
        opportunity_topic: null,
        declared_rights_json: declaredRightsJson,
        created_at: now,
        authorization_version: 2,
      }),
    ).toMatchObject({ canonicalUrl: submission.canonicalUrl });
  });
});
