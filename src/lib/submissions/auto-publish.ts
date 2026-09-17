import { prepareCreatorAssetUpsert } from "../assets/persist-creator-asset";
import {
  buildCreatorAssetRecord,
  type CreatorAssetRecord,
  type PublishableSubmission,
} from "../assets/publish-submission";
import type { SubmissionPreScreenResult } from "./pre-screen";
import { validateSubmissionPayload, type ValidatedSubmission } from "./validate";

export const autonomousPublisherId = "system:auto-publisher";
export const autonomousRightsReasonCode = "creator_attested_auto_publish";

export const autonomousReviewNotes =
  "Automatically published after all deterministic URL, host, preview, reuse, sandbox, attribution and creator-attestation checks passed.";

type AutonomousPublicationInput = {
  id: string;
  creatorId: string;
  submission: ValidatedSubmission;
  declaredRightsJson: string;
  preScreen: SubmissionPreScreenResult;
  authorizationVersion: number;
  now: string;
};

export type AutonomousPublicationPlan = {
  submissionId: string;
  creatorId: string;
  asset: CreatorAssetRecord;
  reviewedAt: string;
  reviewId: string;
  rightsStatus: "restricted";
  rightsEvidenceUrl: string;
  reviewNotes: string;
};

export type AutonomousPublicationResult =
  | { ok: true; value: AutonomousPublicationPlan }
  | { ok: false; code: "auto_publish_checks_failed" | string };

export function planAutonomousPublication(
  input: AutonomousPublicationInput,
): AutonomousPublicationResult {
  if (input.preScreen.status !== "pass") {
    return { ok: false, code: "auto_publish_checks_failed" };
  }

  const storedSubmission: PublishableSubmission = {
    id: input.id,
    creator_id: input.creatorId,
    canonical_url: input.submission.canonicalUrl,
    embed_url: input.submission.embedUrl,
    preview_url: input.submission.previewUrl,
    asset_type: input.submission.assetType,
    title: input.submission.title,
    description: input.submission.description,
    attribution_name: input.submission.attributionName,
    attribution_url: input.submission.attributionUrl,
    attribution_terms: input.submission.attributionTerms,
    opportunity_topic: input.submission.opportunityTopic,
    declared_rights_json: input.declaredRightsJson,
    created_at: input.now,
    authorization_version: input.authorizationVersion,
  };
  const rightsStatus = "restricted" as const;
  const asset = buildCreatorAssetRecord(storedSubmission, {
    reviewed_by: autonomousPublisherId,
    rights_status: rightsStatus,
    rights_reason_code: autonomousRightsReasonCode,
    rights_evidence_url: input.submission.attributionUrl,
    title: null,
    description: null,
    attribution_name: null,
    attribution_terms: null,
    reviewed_at: input.now,
    sandbox_tested: true,
  });
  if (!asset.ok) return asset;

  return {
    ok: true,
    value: {
      submissionId: input.id,
      creatorId: input.creatorId,
      asset: asset.value,
      reviewedAt: input.now,
      reviewId: crypto.randomUUID(),
      rightsStatus,
      rightsEvidenceUrl: input.submission.attributionUrl,
      reviewNotes: autonomousReviewNotes,
    },
  };
}

export function prepareAutonomousPublicationStatements(
  db: D1Database,
  plan: AutonomousPublicationPlan,
): [D1PreparedStatement, D1PreparedStatement, D1PreparedStatement] {
  return [
    prepareCreatorAssetUpsert(db, plan.asset, plan.submissionId, "CREATOR_ATTESTED"),
    db
      .prepare(
        `
          UPDATE submissions
          SET review_status = 'approved', review_notes = ?, reviewed_at = ?, reviewed_by = ?,
              rights_status = ?, rights_reason_code = ?, rights_evidence_url = ?,
              rights_reviewed_at = ?, sandbox_tested_at = ?, asset_id = ?, updated_at = ?
          WHERE id = ? AND review_status IN ('pending', 'needs_changes')
            AND pre_screen_status = 'pass'
            AND EXISTS (
              SELECT 1 FROM assets WHERE id = ? AND creator_id = ? AND status = 'published'
            )
        `,
      )
      .bind(
        plan.reviewNotes,
        plan.reviewedAt,
        autonomousPublisherId,
        plan.rightsStatus,
        autonomousRightsReasonCode,
        plan.rightsEvidenceUrl,
        plan.reviewedAt,
        plan.reviewedAt,
        plan.asset.id,
        plan.reviewedAt,
        plan.submissionId,
        plan.asset.id,
        plan.creatorId,
      ),
    db
      .prepare(
        `
          INSERT INTO submission_reviews (
            id, submission_id, decision, review_notes, rights_status,
            rights_reason_code, rights_evidence_url, sandbox_tested, reviewed_by, created_at
          )
          SELECT ?, ?, 'approved', ?, ?, ?, ?, 1, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM submissions
            WHERE id = ? AND review_status = 'approved' AND asset_id = ? AND reviewed_by = ?
          )
        `,
      )
      .bind(
        plan.reviewId,
        plan.submissionId,
        plan.reviewNotes,
        plan.rightsStatus,
        autonomousRightsReasonCode,
        plan.rightsEvidenceUrl,
        autonomousPublisherId,
        plan.reviewedAt,
        plan.submissionId,
        plan.asset.id,
        autonomousPublisherId,
      ),
  ];
}

export function validatedSubmissionFromStored(
  submission: PublishableSubmission,
): ValidatedSubmission | null {
  let rights: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(submission.declared_rights_json);
    if (!isRecord(parsed)) return null;
    rights = parsed;
  } catch {
    return null;
  }

  const validation = validateSubmissionPayload({
    canonical_url: submission.canonical_url,
    embed_url: submission.embed_url,
    preview_url: submission.preview_url,
    asset_type: submission.asset_type,
    title: submission.title,
    description: submission.description,
    attribution_name: submission.attribution_name,
    attribution_url: submission.attribution_url,
    attribution_terms: submission.attribution_terms,
    commercial_use: rights.commercial_use,
    embed_allowed: rights.embed_allowed,
    modification_allowed: rights.modification_allowed,
    citation_required: rights.citation_required,
    sandbox_compatible: rights.sandbox_compatible,
    source_identity_confirmed: rights.source_identity_confirmed,
    attribution_confirmed: rights.attribution_confirmed,
    preview_display_authorized: rights.preview_display_authorized,
    authorized_to_submit: rights.submitter_authorized,
    commercial_marketplace_acknowledged:
      submission.authorization_version >= 3 ? rights.commercial_marketplace_acknowledged : true,
    creator_terms_accepted:
      submission.authorization_version >= 4 ? rights.creator_terms_accepted : true,
    opportunity_topic: submission.opportunity_topic ?? null,
  });
  return validation.ok ? validation.value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
