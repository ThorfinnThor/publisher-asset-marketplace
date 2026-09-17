import { prepareCreatorAssetUpsert } from "./persist-creator-asset";
import type { CreatorAssetRecord } from "./publish-submission";
import {
  autonomousPublisherId,
  autonomousReviewNotes,
  autonomousRightsReasonCode,
  type AutonomousPublicationPlan,
} from "../submissions/auto-publish";
import type { SubmissionPreScreenResult } from "../submissions/pre-screen";
import type { ValidatedSubmission } from "../submissions/validate";

export type CreatorAssetUpdateLookupRow = {
  asset_id: string;
  slug: string;
  asset_created_at: string;
  preview_url: string | null;
  submission_id: string;
};

export const creatorAssetUpdateLookupSql = `
  SELECT a.id AS asset_id, a.slug, a.created_at AS asset_created_at,
         a.preview_url, s.id AS submission_id
  FROM assets a
  INNER JOIN submissions s
    ON s.asset_id = a.id
    AND s.creator_id = a.creator_id
  WHERE a.slug = ? AND a.creator_id = ? AND a.status = 'published'
  ORDER BY s.updated_at DESC
  LIMIT 1
`;

export const creatorAssetUpdateDuplicateSql = `
  SELECT 1 AS duplicate
  FROM assets
  WHERE canonical_url_normalized = ? AND id <> ?
  UNION ALL
  SELECT 1 AS duplicate
  FROM submissions
  WHERE canonical_url_normalized = ? AND id <> ?
  LIMIT 1
`;

export const creatorSubmissionUpdateSql = `
  UPDATE submissions
  SET canonical_url = ?, canonical_url_normalized = ?, embed_url = ?, preview_url = ?,
      asset_type = ?, title = ?, description = ?, attribution_name = ?, attribution_url = ?,
      attribution_terms = ?, opportunity_topic = ?, declared_rights_json = ?,
      pre_screen_status = ?, pre_screen_json = ?, authorization_attested_at = ?,
      authorization_version = ?, review_status = 'approved', review_notes = ?,
      reviewed_at = ?, reviewed_by = ?, rights_status = ?, rights_reason_code = ?,
      rights_evidence_url = ?, rights_reviewed_at = ?, sandbox_tested_at = ?, updated_at = ?
  WHERE id = ? AND creator_id = ? AND asset_id = ?
`;

type CreatorAssetUpdateInput = {
  lookup: CreatorAssetUpdateLookupRow;
  submission: ValidatedSubmission;
  declaredRightsJson: string;
  preScreen: SubmissionPreScreenResult;
  publication: AutonomousPublicationPlan;
  authorizationVersion: number;
  now: string;
};

export function prepareCreatorAssetUpdateStatements(
  db: D1Database,
  input: CreatorAssetUpdateInput,
): [D1PreparedStatement, D1PreparedStatement, D1PreparedStatement] {
  const { lookup, publication, submission } = input;
  const asset = preserveCreatorAssetIdentity(publication.asset, lookup);
  return [
    db
      .prepare(creatorSubmissionUpdateSql)
      .bind(
        submission.canonicalUrl,
        submission.canonicalUrl,
        submission.embedUrl,
        submission.previewUrl,
        submission.assetType,
        submission.title,
        submission.description,
        submission.attributionName,
        submission.attributionUrl,
        submission.attributionTerms,
        submission.opportunityTopic,
        input.declaredRightsJson,
        input.preScreen.status,
        JSON.stringify(input.preScreen),
        input.now,
        input.authorizationVersion,
        autonomousReviewNotes,
        input.now,
        autonomousPublisherId,
        publication.rightsStatus,
        autonomousRightsReasonCode,
        publication.rightsEvidenceUrl,
        input.now,
        input.now,
        input.now,
        lookup.submission_id,
        publication.creatorId,
        lookup.asset_id,
      ),
    prepareCreatorAssetUpsert(db, asset, lookup.submission_id, "CREATOR_ATTESTED"),
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
            WHERE id = ? AND creator_id = ? AND asset_id = ? AND review_status = 'approved'
          )
        `,
      )
      .bind(
        publication.reviewId,
        lookup.submission_id,
        autonomousReviewNotes,
        publication.rightsStatus,
        autonomousRightsReasonCode,
        publication.rightsEvidenceUrl,
        autonomousPublisherId,
        input.now,
        lookup.submission_id,
        publication.creatorId,
        lookup.asset_id,
      ),
  ];
}

export function preserveCreatorAssetIdentity(
  asset: CreatorAssetRecord,
  lookup: CreatorAssetUpdateLookupRow,
): CreatorAssetRecord {
  return {
    ...asset,
    id: lookup.asset_id,
    slug: lookup.slug,
    created_at: lookup.asset_created_at,
  };
}
