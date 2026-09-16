import type { SubmissionPreScreenResult } from "./pre-screen";
import type { ValidatedSubmission } from "./validate";

export const submissionInsertSql = `
  INSERT INTO submissions (
    id, creator_id, canonical_url, canonical_url_normalized, embed_url, preview_url,
    asset_type, title, description, attribution_name, attribution_url, attribution_terms,
    opportunity_topic, declared_rights_json, pre_screen_status, pre_screen_json,
    authorization_attested_at, authorization_version, review_status, created_at, updated_at
  )
  SELECT
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    2, 'pending', ?, ?
  WHERE (
    SELECT COUNT(*) FROM submissions
    WHERE creator_id = ? AND created_at >= ?
  ) < ?
`;

type SubmissionInsertInput = {
  id: string;
  creatorId: string;
  submission: ValidatedSubmission;
  preScreen: SubmissionPreScreenResult;
  now: string;
  since: string;
  submissionLimit: number;
};

export function buildSubmissionInsertBindings(input: SubmissionInsertInput): unknown[] {
  const { submission, preScreen } = input;
  return [
    input.id,
    input.creatorId,
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
    JSON.stringify({ ...submission.rights, attested_at: input.now }),
    preScreen.status,
    JSON.stringify(preScreen),
    input.now,
    input.now,
    input.now,
    input.creatorId,
    input.since,
    input.submissionLimit,
  ];
}
