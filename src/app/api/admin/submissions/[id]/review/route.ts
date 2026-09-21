import { env } from "cloudflare:workers";

import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { isReviewableStatus, validateReviewPayload } from "@/lib/admin/moderation";
import { prepareCreatorAssetUpsert } from "@/lib/assets/persist-creator-asset";
import {
  buildCreatorAssetRecord,
  type PublishableSubmission,
} from "@/lib/assets/publish-submission";
import { rebuildSelectedAssetSearchTrigrams } from "@/lib/search/search-index";
import { verifyMarketplacePreviewUpload } from "@/lib/submissions/marketplace-preview";

const maxBodyBytes = 16 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");

  let profile: Awaited<ReturnType<typeof getAuthenticatedProfile>>;
  try {
    profile = await getAuthenticatedProfile(request, getDatabase());
  } catch (error) {
    logAuthenticationFailure("admin_review_authentication_failed", error);
    return errorResponse(
      503,
      "authentication_unavailable",
      "Sign-in verification is temporarily unavailable.",
    );
  }
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
      .prepare(
        `
          SELECT id, creator_id, canonical_url, embed_url, preview_url, asset_type,
            title, description, attribution_name, attribution_url, attribution_terms,
            opportunity_topic, declared_rights_json, created_at, authorization_version, review_status, asset_id
          FROM submissions
          WHERE id = ?
          LIMIT 1
        `,
      )
      .bind(id)
      .first<PublishableSubmission & { review_status: string; asset_id: string | null }>();
    if (!current) return errorResponse(404, "submission_not_found", "Submission not found.");
    if (!isReviewableStatus(current.review_status)) {
      return errorResponse(409, "submission_not_reviewable", "This submission is already decided.");
    }

    let publishedAsset: ReturnType<typeof buildCreatorAssetRecord> | null = null;
    if (validation.value.decision === "approved") {
      const previewVerification = await verifyMarketplacePreviewUpload(
        env.PREVIEW_UPLOADS,
        current.preview_url ?? "",
        new URL(request.url).origin,
        current.creator_id,
      );
      if (previewVerification.kind === "invalid" || previewVerification.kind === "unavailable") {
        return Response.json(
          {
            error: previewVerification.message,
            code: previewVerification.code,
            field_errors: { preview_url: previewVerification.message },
          },
          {
            status: previewVerification.kind === "unavailable" ? 503 : 422,
            headers: { "cache-control": "no-store" },
          },
        );
      }
      if (
        validation.value.rightsStatus !== "safe" &&
        validation.value.rightsStatus !== "restricted"
      ) {
        return errorResponse(
          400,
          "approved_rights_evidence_required",
          "Approved assets need reviewed rights.",
        );
      }
      publishedAsset = buildCreatorAssetRecord(current, {
        reviewed_by: profile.id,
        rights_status: validation.value.rightsStatus,
        rights_reason_code: validation.value.rightsReasonCode,
        rights_evidence_url: validation.value.rightsEvidenceUrl ?? "",
        title: validation.value.title,
        description: validation.value.description,
        attribution_name: validation.value.attributionName,
        attribution_terms: validation.value.attributionTerms,
        reviewed_at: now,
        sandbox_tested: true,
      });
      if (!publishedAsset.ok)
        return errorResponse(400, publishedAsset.code, "Asset cannot be published.");
    }

    const reviewId = crypto.randomUUID();
    const asset = publishedAsset?.ok ? publishedAsset.value : null;
    const statements = [] as Array<D1PreparedStatement>;
    if (asset) {
      statements.push(prepareCreatorAssetUpsert(db, asset, current.id));
    }

    statements.push(
      db
        .prepare(
          `
            UPDATE submissions
            SET review_status = ?, review_notes = ?, reviewed_at = ?, reviewed_by = ?,
                title = COALESCE(?, title), description = COALESCE(?, description),
                attribution_name = COALESCE(?, attribution_name),
                attribution_terms = COALESCE(?, attribution_terms),
                rights_status = ?, rights_reason_code = ?, rights_evidence_url = ?,
                rights_reviewed_at = ?,
                sandbox_tested_at = CASE WHEN ? THEN ? ELSE sandbox_tested_at END,
                asset_id = COALESCE(?, asset_id), updated_at = ?
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
          validation.value.sandboxTested ? 1 : 0,
          now,
          asset?.id ?? null,
          now,
          id,
        ),
    );

    statements.push(
      db
        .prepare(
          `
            INSERT INTO submission_reviews (
              id, submission_id, decision, review_notes, rights_status,
              rights_reason_code, rights_evidence_url, sandbox_tested, reviewed_by, created_at
            )
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM submissions
              WHERE id = ? AND reviewed_at = ? AND reviewed_by = ?
                AND (? IS NULL OR asset_id = ?)
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
          validation.value.sandboxTested ? 1 : 0,
          profile.id,
          now,
          id,
          now,
          profile.id,
          asset?.id ?? null,
          asset?.id ?? null,
        ),
    );

    const results = await db.batch(statements);
    const updateResult = results[asset ? 1 : 0];
    const auditResult = results[asset ? 2 : 1];
    if (updateResult.meta.changes === 0 || auditResult.meta.changes === 0) {
      return errorResponse(409, "submission_not_reviewable", "This submission is already decided.");
    }

    if (asset) {
      try {
        await rebuildSelectedAssetSearchTrigrams(db, [asset.id]);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "creator_asset_search_index_refresh_failed",
            asset_id: asset.id,
            message: error instanceof Error ? error.message : "unknown_error",
          }),
        );
      }
    }

    return Response.json(
      {
        ok: true,
        submission_id: id,
        review_status: validation.value.decision,
        rights_status: validation.value.rightsStatus,
        asset_id: asset?.id ?? null,
        asset_slug: asset?.slug ?? null,
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

function logAuthenticationFailure(event: string, error: unknown): void {
  console.error(
    JSON.stringify({
      event,
      message: error instanceof Error ? error.message : "unknown_error",
    }),
  );
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
