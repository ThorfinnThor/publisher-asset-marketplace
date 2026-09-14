import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { validateSubmissionPayload } from "@/lib/submissions/validate";

const maxBodyBytes = 32 * 1024;
const submissionLimit = 10;
const windowMs = 24 * 60 * 60 * 1_000;

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");

  const profile = await loadProfile(request);
  if (!profile) return errorResponse(401, "authentication_required", "Sign in to submit an asset.");

  const body = await readLimitedBody(request);
  if (!body.ok) return errorResponse(413, "payload_too_large", "Submission is too large.");

  let input: unknown;
  try {
    input = JSON.parse(body.value);
  } catch {
    return errorResponse(400, "invalid_payload", "Submission data is invalid.");
  }
  if (!isRecord(input) || typeof input.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Submission security check failed.");
  }
  if (!(await verifyCsrfToken(request, input.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Submission security check failed.");
  }

  const payload = { ...input };
  delete payload.csrf_token;
  const validation = validateSubmissionPayload(payload);
  if (!validation.ok) {
    return errorResponse(400, validation.code, "Please correct the highlighted submission fields.");
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const since = new Date(Date.now() - windowMs).toISOString();
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
      .bind(validation.value.canonicalUrl, validation.value.canonicalUrl)
      .first<{ duplicate: number }>();
    if (duplicate)
      return errorResponse(409, "canonical_url_exists", "This asset is already submitted.");

    const submissionId = crypto.randomUUID();
    const result = await db
      .prepare(
        `
          INSERT INTO submissions (
            id, creator_id, canonical_url, canonical_url_normalized, embed_url, preview_url,
            asset_type, title, description, attribution_name, attribution_url, attribution_terms,
            declared_rights_json, authorization_attested_at, authorization_version,
            review_status, created_at, updated_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?
          WHERE (
            SELECT COUNT(*) FROM submissions
            WHERE creator_id = ? AND created_at >= ?
          ) < ?
        `,
      )
      .bind(
        submissionId,
        profile.id,
        validation.value.canonicalUrl,
        validation.value.canonicalUrl,
        validation.value.embedUrl,
        validation.value.previewUrl,
        validation.value.assetType,
        validation.value.title,
        validation.value.description,
        validation.value.attributionName,
        validation.value.attributionUrl,
        validation.value.attributionTerms,
        JSON.stringify({ ...validation.value.rights, attested_at: now }),
        now,
        now,
        profile.id,
        since,
        submissionLimit,
      )
      .run();

    if (result.meta.changes === 0) {
      return errorResponse(429, "submission_rate_limited", "Please try again later.");
    }

    return Response.json(
      { ok: true, submission_id: submissionId, review_status: "pending" },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return errorResponse(409, "canonical_url_exists", "This asset is already submitted.");
    }
    return errorResponse(503, "submission_unavailable", "The submission could not be saved.");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
