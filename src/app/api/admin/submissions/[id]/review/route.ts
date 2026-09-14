import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { isReviewableStatus, validateReviewPayload } from "@/lib/admin/moderation";

const maxBodyBytes = 16 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");

  const profile = await loadProfile(request);
  if (!profile)
    return errorResponse(401, "authentication_required", "Sign in to moderate submissions.");
  if (profile.role !== "admin")
    return errorResponse(403, "admin_required", "Admin access is required.");

  const body = await readLimitedBody(request);
  if (!body.ok) return errorResponse(413, "payload_too_large", "Review data is too large.");

  let input: unknown;
  try {
    input = JSON.parse(body.value);
  } catch {
    return errorResponse(400, "invalid_payload", "Review data is invalid.");
  }
  if (!isRecord(input) || typeof input.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Review security check failed.");
  }
  if (!(await verifyCsrfToken(request, input.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Review security check failed.");
  }

  const payload = { ...input };
  delete payload.csrf_token;
  const validation = validateReviewPayload(payload);
  if (!validation.ok) {
    return errorResponse(400, validation.code, "Please correct the review fields.");
  }

  const { id } = await params;
  if (!isSafeId(id)) return errorResponse(404, "submission_not_found", "Submission not found.");

  const db = getDatabase();
  const now = new Date().toISOString();
  try {
    const current = await db
      .prepare("SELECT review_status FROM submissions WHERE id = ? LIMIT 1")
      .bind(id)
      .first<{ review_status: string }>();
    if (!current) return errorResponse(404, "submission_not_found", "Submission not found.");
    if (!isReviewableStatus(current.review_status)) {
      return errorResponse(409, "submission_not_reviewable", "This submission is already decided.");
    }

    const reviewId = crypto.randomUUID();
    const update = db
      .prepare(
        `
          UPDATE submissions
          SET review_status = ?, review_notes = ?, reviewed_at = ?, reviewed_by = ?,
              title = COALESCE(?, title), description = COALESCE(?, description),
              attribution_name = COALESCE(?, attribution_name),
              attribution_terms = COALESCE(?, attribution_terms),
              rights_status = ?, rights_reason_code = ?, rights_evidence_url = ?,
              rights_reviewed_at = ?, updated_at = ?
          WHERE id = ? AND review_status IN ('pending', 'needs_changes')
        `,
      )
      .bind(
        validation.value.decision,
        validation.value.reviewNotes,
        now,
        profile.id,
        validation.value.title,
        validation.value.description,
        validation.value.attributionName,
        validation.value.attributionTerms,
        validation.value.rightsStatus,
        validation.value.rightsReasonCode,
        validation.value.rightsEvidenceUrl,
        now,
        now,
        id,
      );
    const audit = db
      .prepare(
        `
          INSERT INTO submission_reviews (
            id, submission_id, decision, review_notes, rights_status,
            rights_reason_code, rights_evidence_url, reviewed_by, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM submissions
            WHERE id = ? AND reviewed_at = ? AND reviewed_by = ?
          )
        `,
      )
      .bind(
        reviewId,
        id,
        validation.value.decision,
        validation.value.reviewNotes,
        validation.value.rightsStatus,
        validation.value.rightsReasonCode,
        validation.value.rightsEvidenceUrl,
        profile.id,
        now,
        id,
        now,
        profile.id,
      );
    const [updateResult, auditResult] = await db.batch([update, audit]);
    if (updateResult.meta.changes === 0 || auditResult.meta.changes === 0) {
      return errorResponse(409, "submission_not_reviewable", "This submission is already decided.");
    }

    return Response.json(
      {
        ok: true,
        submission_id: id,
        review_status: validation.value.decision,
        rights_status: validation.value.rightsStatus,
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && /unique|foreign key/i.test(error.message)) {
      return errorResponse(409, "submission_not_reviewable", "This submission is already decided.");
    }
    return errorResponse(503, "moderation_unavailable", "The review could not be saved.");
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

function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
