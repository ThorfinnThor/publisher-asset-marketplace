import type { SubmissionPreScreenResult } from "./pre-screen";
import type { ValidatedSubmission } from "./validate";
import { normalizePublicHttpsUrl } from "./validate";

export type ConvertibleUrlScanRow = {
  id: string;
  requested_url_normalized: string;
  status: string;
  contract_version: number;
  result_json: string | null;
  submission_id: string | null;
  expires_at: string;
};

export const conversionSubmissionInsertSql = `
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
  AND EXISTS (
    SELECT 1 FROM url_scan_jobs
    WHERE id = ? AND creator_id = ? AND status = 'needs_confirmation'
      AND contract_version = 1 AND submission_id IS NULL AND expires_at > ?
  )
`;

export const conversionScanUpdateSql = `
  UPDATE url_scan_jobs
  SET status = 'converted', submission_id = ?, completed_at = ?, updated_at = ?
  WHERE id = ? AND creator_id = ? AND status = 'needs_confirmation'
    AND contract_version = 1 AND submission_id IS NULL AND expires_at > ?
    AND EXISTS (
      SELECT 1 FROM submissions WHERE id = ? AND creator_id = ?
    )
`;

type ConversionInsertInput = {
  id: string;
  creatorId: string;
  scanId: string;
  submission: ValidatedSubmission;
  preScreen: SubmissionPreScreenResult;
  now: string;
  since: string;
  submissionLimit: number;
};

export function buildConversionSubmissionInsertBindings(input: ConversionInsertInput): unknown[] {
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
    JSON.stringify({ ...submission.rights, attested_at: input.now, source_scan_id: input.scanId }),
    preScreen.status,
    JSON.stringify(preScreen),
    input.now,
    input.now,
    input.now,
    input.creatorId,
    input.since,
    input.submissionLimit,
    input.scanId,
    input.creatorId,
    input.now,
  ];
}

export function scanAllowsCanonical(
  row: Pick<ConvertibleUrlScanRow, "requested_url_normalized" | "result_json">,
  canonicalUrl: string,
): boolean {
  const allowed = new Set<string>();
  const requested = normalizePublicHttpsUrl(row.requested_url_normalized);
  if (requested.ok) allowed.add(requested.value);

  const result = parseResult(row.result_json);
  for (const candidate of [result?.final_url, result?.canonical_url_candidate]) {
    const normalized = normalizePublicHttpsUrl(candidate);
    if (normalized.ok) allowed.add(normalized.value);
  }
  return allowed.has(canonicalUrl);
}

function parseResult(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
