import { env } from "cloudflare:workers";

import { getAuthenticatedProfile, verifyCsrfToken } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";

const maxImageBytes = 2 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "csrf_failed", "Request origin is not allowed.");

  const profile = await loadProfile(request);
  if (!profile)
    return errorResponse(401, "authentication_required", "Sign in to upload a preview.");

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxImageBytes + 32 * 1024) {
    return errorResponse(413, "preview_too_large", "Preview images must be 2 MB or smaller.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_payload", "Choose a PNG, JPG or WebP image.");
  }
  const csrfToken = form.get("csrf_token");
  if (typeof csrfToken !== "string" || !(await verifyCsrfToken(request, csrfToken))) {
    return errorResponse(403, "csrf_failed", "Preview upload security check failed.");
  }

  const file = form.get("file");
  if (!(file instanceof File))
    return errorResponse(400, "preview_required", "Choose an image file.");
  const extension = allowedTypes.get(file.type.toLowerCase());
  if (!extension) return errorResponse(400, "preview_format", "Use PNG, JPG or WebP format.");
  if (file.size === 0 || file.size > maxImageBytes) {
    return errorResponse(413, "preview_too_large", "Preview images must be 2 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, extension)) {
    return errorResponse(400, "preview_format", "The selected file is not a valid image.");
  }

  const uploadId = crypto.randomUUID();
  const key = `submission-previews/${uploadId}`;
  try {
    await env.PREVIEW_UPLOADS.put(key, bytes, {
      httpMetadata: {
        contentType: file.type.toLowerCase(),
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        creatorId: profile.id,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch {
    return errorResponse(503, "preview_unavailable", "The preview could not be uploaded.");
  }

  return Response.json(
    {
      ok: true,
      preview_url: new URL(`/api/submission-previews/${uploadId}`, request.url).toString(),
    },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
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

function matchesImageSignature(bytes: Uint8Array, extension: string): boolean {
  if (extension === "png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (extension === "jpg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}
