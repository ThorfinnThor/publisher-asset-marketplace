import { env } from "cloudflare:workers";

import {
  creatorAssetDeletionLookupSql,
  prepareCreatorAssetDeletionStatements,
  type CreatorAssetDeletionRow,
} from "@/lib/assets/delete-creator-asset";
import {
  creatorAssetUpdateDuplicateSql,
  creatorAssetUpdateLookupSql,
  prepareCreatorAssetUpdateStatements,
  type CreatorAssetUpdateLookupRow,
} from "@/lib/assets/update-creator-asset";
import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { rebuildSelectedAssetSearchTrigrams } from "@/lib/search/search-index";
import { planAutonomousPublication } from "@/lib/submissions/auto-publish";
import { buildDeclaredRightsJson, currentAuthorizationVersion } from "@/lib/submissions/create";
import {
  previewVerificationErrorBody,
  runVerifiedSubmissionPreScreen,
} from "@/lib/submissions/server-pre-screen";
import { validateSubmissionPayload } from "@/lib/submissions/validate";
import { submissionValidationErrorBody } from "@/lib/submissions/validation-errors";

const maxDeleteBodyBytes = 2 * 1024;
const maxUpdateBodyBytes = 32 * 1024;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (!sameOrigin(request)) {
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");
  }

  const db = getDatabase();
  let profile: Awaited<ReturnType<typeof getAuthenticatedProfile>>;
  try {
    profile = await getAuthenticatedProfile(request, db);
  } catch (error) {
    logAuthenticationFailure("creator_asset_update_authentication_failed", error);
    return errorResponse(
      503,
      "authentication_unavailable",
      "Sign-in verification is temporarily unavailable.",
    );
  }
  if (!profile) {
    return errorResponse(401, "authentication_required", "Sign in to update an asset.");
  }

  const body = await readLimitedJson(request, maxUpdateBodyBytes);
  if (!body.ok || typeof body.value.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Asset update security check failed.");
  }
  if (!(await verifyCsrfToken(request, body.value.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Asset update security check failed.");
  }

  const { slug } = await params;
  if (!isValidSlug(slug)) return errorResponse(404, "asset_not_found", "Asset not found.");

  const payload = { ...body.value };
  delete payload.csrf_token;
  const validation = validateSubmissionPayload(payload);
  if (!validation.ok) {
    return Response.json(submissionValidationErrorBody(validation), {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }
  const verifiedPreScreen = await runVerifiedSubmissionPreScreen(validation.value, {
    marketplaceOrigin: new URL(request.url).origin,
    creatorId: profile.id,
    previewBucket: env.PREVIEW_UPLOADS,
  });
  if (!verifiedPreScreen.ok) {
    return Response.json(previewVerificationErrorBody(verifiedPreScreen), {
      status: verifiedPreScreen.status,
      headers: { "cache-control": "no-store" },
    });
  }
  const preScreen = verifiedPreScreen.preScreen;
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

  try {
    const lookup = await db
      .prepare(creatorAssetUpdateLookupSql)
      .bind(slug, profile.id)
      .first<CreatorAssetUpdateLookupRow>();
    if (!lookup) return errorResponse(404, "asset_not_found", "Asset not found.");

    const duplicate = await db
      .prepare(creatorAssetUpdateDuplicateSql)
      .bind(
        validation.value.canonicalUrl,
        lookup.asset_id,
        validation.value.canonicalUrl,
        lookup.submission_id,
      )
      .first<{ duplicate: number }>();
    if (duplicate) {
      return errorResponse(409, "canonical_url_exists", "This canonical URL is already in use.");
    }

    const now = new Date().toISOString();
    const declaredRightsJson = buildDeclaredRightsJson(validation.value, now);
    const publication = planAutonomousPublication({
      id: lookup.submission_id,
      creatorId: profile.id,
      submission: validation.value,
      declaredRightsJson,
      preScreen,
      authorizationVersion: currentAuthorizationVersion,
      now,
    });
    if (!publication.ok) {
      return errorResponse(503, publication.code, "The asset update could not be prepared.");
    }

    const results = await db.batch(
      prepareCreatorAssetUpdateStatements(db, {
        lookup,
        submission: validation.value,
        declaredRightsJson,
        preScreen,
        publication: publication.value,
        authorizationVersion: currentAuthorizationVersion,
        now,
      }),
    );
    if (results.some((result) => (result.meta.changes ?? 0) === 0)) {
      return errorResponse(409, "asset_update_conflict", "The asset could not be updated.");
    }

    try {
      await rebuildSelectedAssetSearchTrigrams(db, [lookup.asset_id]);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "creator_asset_update_search_refresh_failed",
          asset_id: lookup.asset_id,
          message: error instanceof Error ? error.message : "unknown_error",
        }),
      );
    }

    return Response.json(
      { ok: true, auto_publish: true, asset_slug: lookup.slug, pre_screen: preScreen },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return errorResponse(409, "canonical_url_exists", "This canonical URL is already in use.");
    }
    console.error(
      JSON.stringify({
        event: "creator_asset_update_failed",
        creator_id: profile.id,
        slug,
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
    return errorResponse(503, "asset_update_unavailable", "The asset could not be updated.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (!sameOrigin(request)) {
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");
  }

  const db = getDatabase();
  let profile: Awaited<ReturnType<typeof getAuthenticatedProfile>>;
  try {
    profile = await getAuthenticatedProfile(request, db);
  } catch (error) {
    logAuthenticationFailure("creator_asset_delete_authentication_failed", error);
    return errorResponse(
      503,
      "authentication_unavailable",
      "Sign-in verification is temporarily unavailable.",
    );
  }
  if (!profile) {
    return errorResponse(401, "authentication_required", "Sign in to delete an asset.");
  }

  const body = await readLimitedJson(request, maxDeleteBodyBytes);
  if (!body.ok || typeof body.value.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Asset deletion security check failed.");
  }
  if (!(await verifyCsrfToken(request, body.value.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Asset deletion security check failed.");
  }

  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return errorResponse(404, "asset_not_found", "Asset not found.");
  }

  try {
    const asset = await db
      .prepare(creatorAssetDeletionLookupSql)
      .bind(slug, profile.id)
      .first<CreatorAssetDeletionRow>();
    if (!asset) return errorResponse(404, "asset_not_found", "Asset not found.");

    const results = await db.batch(prepareCreatorAssetDeletionStatements(db, asset.id, profile.id));
    if ((results[1]?.meta.changes ?? 0) === 0) {
      return errorResponse(409, "asset_delete_conflict", "The asset could not be deleted.");
    }

    return Response.json(
      { ok: true, deleted_slug: slug },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "creator_asset_delete_failed",
        creator_id: profile.id,
        slug,
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
    return errorResponse(503, "asset_delete_unavailable", "The asset could not be deleted.");
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

async function readLimitedJson(
  request: Request,
  maxBodyBytes: number,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
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
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? { ok: true, value } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,255}$/u.test(value);
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
