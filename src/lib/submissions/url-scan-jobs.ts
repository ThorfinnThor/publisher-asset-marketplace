import type { UrlScanIssueCode, UrlScanResultMessageV1, UrlScanStatus } from "./url-scan-contract";

const activeStatuses = ["queued", "running", "needs_confirmation", "needs_changes"] as const;
const issueCodes = new Set<UrlScanIssueCode>([
  "address_not_public",
  "authentication_required",
  "consent_blocked",
  "dns_unavailable",
  "embed_not_found",
  "frame_blocked",
  "navigation_timeout",
  "ownership_unconfirmed",
  "preview_failed",
  "prompt_injection_ignored",
  "redirect_limit",
  "request_limit",
  "response_too_large",
  "rights_evidence_missing",
  "robots_disallowed",
  "sandbox_not_interactive",
  "sandbox_runtime_error",
  "unsupported_content_type",
]);

export type UrlScanJobRow = {
  id: string;
  requested_url: string;
  status: UrlScanStatus;
  attempt_count: number;
  result_json: string | null;
  error_code: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  updated_at: string;
};

export const insertUrlScanJobSql = `
  INSERT INTO url_scan_jobs (
    id,
    creator_id,
    requested_url,
    requested_url_normalized,
    requested_hostname,
    status,
    contract_version,
    attempt_count,
    created_at,
    expires_at,
    updated_at
  )
  SELECT ?, ?, ?, ?, ?, 'queued', 1, 0, ?, ?, ?
  WHERE (
    SELECT COUNT(*)
    FROM url_scan_jobs
    WHERE creator_id = ?
      AND status IN ('queued', 'running', 'needs_confirmation', 'needs_changes')
      AND expires_at > ?
  ) = 0
  AND (
    SELECT COUNT(*)
    FROM url_scan_jobs
    WHERE creator_id = ?
      AND created_at >= ?
  ) < ?
`;

export function parseUrlScanResultMessage(value: unknown): UrlScanResultMessageV1 | null {
  if (!isRecord(value) || value.schema_version !== 1 || !isUuid(value.job_id)) return null;
  if (!Number.isInteger(value.attempt) || Number(value.attempt) < 1 || Number(value.attempt) > 3) {
    return null;
  }

  if (value.status === "running") {
    return {
      schema_version: 1,
      job_id: value.job_id,
      attempt: Number(value.attempt),
      status: "running",
    };
  }

  if (
    value.status === "failed" &&
    typeof value.error_code === "string" &&
    issueCodes.has(value.error_code as UrlScanIssueCode)
  ) {
    return {
      schema_version: 1,
      job_id: value.job_id,
      attempt: Number(value.attempt),
      status: "failed",
      error_code: value.error_code as UrlScanIssueCode,
    };
  }

  if (
    (value.status === "needs_confirmation" || value.status === "needs_changes") &&
    isUrlScanResult(value.result)
  ) {
    return {
      schema_version: 1,
      job_id: value.job_id,
      attempt: Number(value.attempt),
      status: value.status,
      result: value.result,
    };
  }
  return null;
}

export async function applyUrlScanResult(
  db: D1Database,
  message: UrlScanResultMessageV1,
  now = new Date().toISOString(),
): Promise<void> {
  if (message.status === "running") {
    await db
      .prepare(
        `
          UPDATE url_scan_jobs
          SET status = 'running',
              attempt_count = MAX(attempt_count, ?),
              started_at = COALESCE(started_at, ?),
              updated_at = ?
          WHERE id = ?
            AND status IN ('queued', 'running')
        `,
      )
      .bind(message.attempt, now, now, message.job_id)
      .run();
    return;
  }

  if (message.status === "failed") {
    await db
      .prepare(
        `
          UPDATE url_scan_jobs
          SET status = 'failed',
              attempt_count = MAX(attempt_count, ?),
              error_code = ?,
              completed_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status IN ('queued', 'running')
        `,
      )
      .bind(message.attempt, message.error_code, now, now, message.job_id)
      .run();
    return;
  }

  const resultJson = JSON.stringify(message.result);
  if (new TextEncoder().encode(resultJson).byteLength > 64 * 1024) {
    throw new Error("url_scan_result_too_large");
  }
  await db
    .prepare(
      `
        UPDATE url_scan_jobs
        SET status = ?,
            attempt_count = MAX(attempt_count, ?),
            result_json = ?,
            error_code = NULL,
            preview_r2_key = ?,
            completed_at = ?,
            updated_at = ?
        WHERE id = ?
          AND status IN ('queued', 'running')
      `,
    )
    .bind(
      message.status,
      message.attempt,
      resultJson,
      message.result.preview.r2_key,
      now,
      now,
      message.job_id,
    )
    .run();
}

export async function expireUrlScanJobs(
  db: D1Database,
  now = new Date().toISOString(),
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE url_scan_jobs
        SET status = 'expired', updated_at = ?
        WHERE expires_at <= ?
          AND status IN ('queued', 'running', 'needs_confirmation', 'needs_changes')
      `,
    )
    .bind(now, now)
    .run();
}

export function publicUrlScanJob(row: UrlScanJobRow): Record<string, unknown> {
  return {
    id: row.id,
    requested_url: row.requested_url,
    status: row.status,
    attempt_count: row.attempt_count,
    result: row.result_json ? safeJson(row.result_json) : null,
    error_code: row.error_code,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    updated_at: row.updated_at,
  };
}

function isUrlScanResult(
  value: unknown,
): value is Extract<UrlScanResultMessageV1, { status: "needs_confirmation" }>["result"] {
  if (!isRecord(value) || value.schema_version !== 1) return false;
  if (typeof value.final_url !== "string" || value.raw_content_stored !== false) return false;
  if (value.auto_publish !== false || !isRecord(value.preview) || !isRecord(value.embed)) {
    return false;
  }
  if (!Array.isArray(value.issues) || !isRecord(value.rights_candidates)) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export { activeStatuses };
