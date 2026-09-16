import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { rebuildAssetSearchTrigrams } from "@/lib/search/search-index";
import {
  planAutonomousPublication,
  prepareAutonomousPublicationStatements,
} from "@/lib/submissions/auto-publish";
import {
  buildDeclaredRightsJson,
  buildSubmissionInsertBindings,
  currentAuthorizationVersion,
  submissionInsertSql,
} from "@/lib/submissions/create";
import { runSubmissionPreScreen } from "@/lib/submissions/pre-screen";
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
    return errorResponse(400, validation.code, validationErrorMessage(validation.code));
  }
  const preScreen = runSubmissionPreScreen(validation.value, {
    marketplaceOrigin: new URL(request.url).origin,
  });
  if (preScreen.status !== "pass") {
    return Response.json(
      {
        error:
          "Automatic publication checks did not pass. Correct the flagged fields and try again.",
        code: "auto_publish_checks_failed",
        pre_screen: preScreen,
      },
      { status: 422, headers: { "cache-control": "no-store" } },
    );
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
    const declaredRightsJson = buildDeclaredRightsJson(validation.value, now);
    const insertBindings = buildSubmissionInsertBindings({
      id: submissionId,
      creatorId: profile.id,
      submission: validation.value,
      preScreen,
      now,
      since,
      submissionLimit,
    });
    const publication = planAutonomousPublication({
      id: submissionId,
      creatorId: profile.id,
      submission: validation.value,
      declaredRightsJson,
      preScreen,
      authorizationVersion: currentAuthorizationVersion,
      now,
    });
    if (!publication.ok) {
      return errorResponse(
        503,
        publication.code,
        "The asset could not be prepared for publication.",
      );
    }
    const publicationStatements = prepareAutonomousPublicationStatements(db, publication.value);
    const results = await db.batch([
      db.prepare(submissionInsertSql).bind(...insertBindings),
      ...publicationStatements,
    ]);

    if (results[0].meta.changes === 0) {
      return errorResponse(429, "submission_rate_limited", "Please try again later.");
    }
    if (results[2].meta.changes === 0 || results[3].meta.changes === 0) {
      return errorResponse(503, "auto_publish_failed", "The asset could not be published.");
    }

    try {
      await rebuildAssetSearchTrigrams(db);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "autonomous_asset_search_index_refresh_failed",
          asset_id: publication.value.asset.id,
          message: error instanceof Error ? error.message : "unknown_error",
        }),
      );
    }

    return Response.json(
      {
        ok: true,
        submission_id: submissionId,
        review_status: "approved",
        publication_status: "published",
        asset_id: publication.value.asset.id,
        asset_slug: publication.value.asset.slug,
        pre_screen: preScreen,
        auto_publish: true,
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return errorResponse(409, "canonical_url_exists", "This asset is already submitted.");
    }
    return errorResponse(503, "submission_unavailable", "The submission could not be saved.");
  }
}

function validationErrorMessage(code: string): string {
  if (code === "sandbox_compatibility_required") {
    return "Test the embed in the marketplace sandbox and confirm that it remains interactive without storage, cookies or same-origin access.";
  }
  if (code === "commercial_marketplace_acknowledgement_required") {
    return "Confirm that the asset may be listed and promoted within the commercially operated marketplace.";
  }
  if (code === "creator_terms_acceptance_required") {
    return "Read and accept the current Creator Terms before publishing.";
  }
  return "Please correct the highlighted submission fields.";
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
