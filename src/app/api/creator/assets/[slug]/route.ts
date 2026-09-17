import { env } from "cloudflare:workers";

import {
  creatorAssetDeletionLookupSql,
  marketplacePreviewObjectKey,
  prepareCreatorAssetDeletionStatements,
  type CreatorAssetDeletionRow,
} from "@/lib/assets/delete-creator-asset";
import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";

const maxBodyBytes = 2 * 1024;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (!sameOrigin(request)) {
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");
  }

  const db = getDatabase();
  const profile = await loadProfile(request, db);
  if (!profile) {
    return errorResponse(401, "authentication_required", "Sign in to delete an asset.");
  }

  const body = await readLimitedJson(request);
  if (!body.ok || typeof body.value.csrf_token !== "string") {
    return errorResponse(403, "csrf_failed", "Asset deletion security check failed.");
  }
  if (!(await verifyCsrfToken(request, body.value.csrf_token))) {
    return errorResponse(403, "csrf_failed", "Asset deletion security check failed.");
  }

  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9_-]{0,255}$/u.test(slug)) {
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

    await deleteOwnedPreview(asset.preview_url, new URL(request.url).origin, profile.id);
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

async function deleteOwnedPreview(
  previewUrl: string | null,
  marketplaceOrigin: string,
  creatorId: string,
): Promise<void> {
  const key = marketplacePreviewObjectKey(previewUrl, marketplaceOrigin);
  if (!key) return;
  try {
    const object = await env.PREVIEW_UPLOADS.head(key);
    if (object?.customMetadata?.creatorId !== creatorId) return;
    await env.PREVIEW_UPLOADS.delete(key);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "creator_asset_preview_delete_failed",
        key,
        message: error instanceof Error ? error.message : "unknown_error",
      }),
    );
  }
}

async function loadProfile(request: Request, db: D1Database) {
  try {
    return await getAuthenticatedProfile(request, db);
  } catch {
    return null;
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function readLimitedJson(
  request: Request,
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

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
