import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import type { PublishableSubmission } from "@/lib/assets/publish-submission";
import { getDatabase } from "@/lib/db/client";
import { rebuildAssetSearchTrigrams } from "@/lib/search/search-index";
import {
  planAutonomousPublication,
  prepareAutonomousPublicationStatements,
  validatedSubmissionFromStored,
} from "@/lib/submissions/auto-publish";
import { runSubmissionPreScreen } from "@/lib/submissions/pre-screen";

const maxBodyBytes = 4 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!sameOrigin(request)) {
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");
  }
  const db = getDatabase();
  const profile = await loadProfile(request, db);
  if (!profile) return errorResponse(401, "authentication_required", "Sign in first.");
  if (profile.role !== "admin") {
    return errorResponse(403, "admin_required", "Admin access is required.");
  }

  const input = await readJson(request);
  if (!input || typeof input.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Review security check failed.");
  }
  if (!(await verifyCsrfToken(request, input.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Review security check failed.");
  }

  const { id } = await params;
  if (!isUuid(id)) return errorResponse(404, "submission_not_found", "Submission not found.");

  try {
    const current = await db
      .prepare(
        `
          SELECT id, creator_id, canonical_url, embed_url, preview_url, asset_type,
            title, description, attribution_name, attribution_url, attribution_terms,
            opportunity_topic, declared_rights_json, created_at, authorization_version
          FROM submissions
          WHERE id = ? AND review_status IN ('pending', 'needs_changes')
          LIMIT 1
        `,
      )
      .bind(id)
      .first<PublishableSubmission>();
    if (!current) {
      return errorResponse(409, "submission_not_reviewable", "This submission is already decided.");
    }
    const submission = validatedSubmissionFromStored(current);
    if (!submission) {
      return errorResponse(
        422,
        "stored_submission_invalid",
        "The stored submission no longer meets the publication contract.",
      );
    }
    const preScreen = runSubmissionPreScreen(submission, {
      marketplaceOrigin: new URL(request.url).origin,
    });
    if (preScreen.status !== "pass") {
      return Response.json(
        {
          error: "Automatic publication checks did not pass.",
          code: "auto_publish_checks_failed",
          pre_screen: preScreen,
        },
        { status: 422, headers: { "cache-control": "no-store" } },
      );
    }

    const now = new Date().toISOString();
    const publication = planAutonomousPublication({
      id: current.id,
      creatorId: current.creator_id,
      submission,
      declaredRightsJson: current.declared_rights_json,
      preScreen,
      now,
    });
    if (!publication.ok) {
      return errorResponse(
        503,
        publication.code,
        "The asset could not be prepared for publication.",
      );
    }
    const results = await db.batch([
      db
        .prepare(
          `
            UPDATE submissions
            SET pre_screen_status = 'pass', pre_screen_json = ?, updated_at = ?
            WHERE id = ? AND review_status IN ('pending', 'needs_changes')
          `,
        )
        .bind(JSON.stringify(preScreen), now, current.id),
      ...prepareAutonomousPublicationStatements(db, publication.value),
    ]);
    if (
      results[0].meta.changes === 0 ||
      results[2].meta.changes === 0 ||
      results[3].meta.changes === 0
    ) {
      return errorResponse(
        409,
        "submission_not_reviewable",
        "This submission changed before publication.",
      );
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
        auto_publish: true,
        asset_id: publication.value.asset.id,
        asset_slug: publication.value.asset.slug,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "auto_publish_unavailable", "Automatic publication is unavailable.");
  }
}

async function loadProfile(request: Request, db: D1Database) {
  try {
    return await getAuthenticatedProfile(request, db);
  } catch {
    return null;
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}
