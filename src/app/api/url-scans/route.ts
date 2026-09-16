import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase, getUrlScanQueue } from "@/lib/db/client";
import { urlScanContractV1, type UrlScanJobMessageV1 } from "@/lib/submissions/url-scan-contract";
import {
  insertUrlScanJobSql,
  publicUrlScanJob,
  type UrlScanJobRow,
} from "@/lib/submissions/url-scan-jobs";
import { normalizePublicHttpsUrl } from "@/lib/submissions/url-scan-network";

const windowMs = 24 * 60 * 60 * 1_000;
const jobTtlMs = urlScanContractV1.limits.inactiveJobTtlDays * 24 * 60 * 60 * 1_000;

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");

  const profile = await loadProfile(request);
  if (!profile) return errorResponse(401, "authentication_required", "Sign in to scan a URL.");

  const body = await readLimitedBody(request);
  if (!body.ok) return errorResponse(413, "payload_too_large", "Scan request is too large.");

  let input: unknown;
  try {
    input = JSON.parse(body.value);
  } catch {
    return errorResponse(400, "invalid_payload", "Scan request is invalid.");
  }
  if (!isRecord(input) || typeof input.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Scan security check failed.");
  }
  if (!(await verifyCsrfToken(request, input.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Scan security check failed.");
  }

  const normalized = normalizePublicHttpsUrl(input.url);
  if (!normalized.ok) {
    return errorResponse(400, normalized.code, "Enter a public HTTPS URL without credentials.");
  }

  const db = getDatabase();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const since = new Date(nowDate.getTime() - windowMs).toISOString();
  const expiresAt = new Date(nowDate.getTime() + jobTtlMs).toISOString();

  try {
    const duplicate = await db
      .prepare(
        `
          SELECT 1 AS duplicate FROM assets WHERE canonical_url_normalized = ?
          UNION ALL
          SELECT 1 AS duplicate FROM submissions WHERE canonical_url_normalized = ?
          LIMIT 1
        `,
      )
      .bind(normalized.url, normalized.url)
      .first<{ duplicate: number }>();
    if (duplicate) return errorResponse(409, "canonical_url_exists", "This asset already exists.");

    const jobId = crypto.randomUUID();
    const insert = await db
      .prepare(insertUrlScanJobSql)
      .bind(
        jobId,
        profile.id,
        normalized.url,
        normalized.url,
        normalized.hostname,
        now,
        expiresAt,
        now,
        profile.id,
        now,
        profile.id,
        since,
        urlScanContractV1.limits.scansPerCreatorPer24Hours,
      )
      .run();

    if (insert.meta.changes === 0) {
      const active = await db
        .prepare(
          `
            SELECT id, requested_url, status, attempt_count, result_json, error_code,
                   created_at, started_at, completed_at, expires_at, updated_at
            FROM url_scan_jobs
            WHERE creator_id = ?
              AND status IN ('queued', 'running', 'needs_confirmation', 'needs_changes')
              AND expires_at > ?
            ORDER BY created_at DESC
            LIMIT 1
          `,
        )
        .bind(profile.id, now)
        .first<UrlScanJobRow>();
      if (active) {
        return Response.json(
          { code: "scan_already_active", job: publicUrlScanJob(active) },
          { status: 409, headers: { "cache-control": "no-store" } },
        );
      }
      return errorResponse(429, "scan_rate_limited", "You can start up to 10 scans in 24 hours.");
    }

    const message: UrlScanJobMessageV1 = {
      schema_version: 1,
      job_id: jobId,
      requested_url: normalized.url,
    };
    try {
      await getUrlScanQueue().send(message, { contentType: "json" });
    } catch {
      await db
        .prepare(
          `
            UPDATE url_scan_jobs
            SET status = 'failed', error_code = 'queue_unavailable', completed_at = ?, updated_at = ?
            WHERE id = ? AND status = 'queued'
          `,
        )
        .bind(now, now, jobId)
        .run();
      return errorResponse(503, "scan_unavailable", "The URL scan could not be queued.");
    }

    return Response.json(
      { ok: true, job_id: jobId, status: "queued", auto_publish: false },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "scan_unavailable", "The URL scan could not be started.");
  }
}

async function loadProfile(request: Request) {
  try {
    return await getAuthenticatedProfile(request, getDatabase());
  } catch {
    return null;
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function readLimitedBody(
  request: Request,
): Promise<{ ok: true; value: string } | { ok: false }> {
  const maxBodyBytes = urlScanContractV1.limits.requestBodyBytes;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return { ok: false };
  const reader = request.body?.getReader();
  if (!reader) return { ok: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: new TextDecoder().decode(bytes) };
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
