import { getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase, getUrlScanPreviewService } from "@/lib/db/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const db = getDatabase();
  let profile;
  try {
    profile = await getAuthenticatedProfile(request, db);
  } catch {
    profile = null;
  }
  if (!profile) return new Response("Authentication required", { status: 401 });

  const { id } = await params;
  const row = await db
    .prepare(
      `
        SELECT preview_r2_key
        FROM url_scan_jobs
        WHERE id = ? AND creator_id = ?
        LIMIT 1
      `,
    )
    .bind(id, profile.id)
    .first<{ preview_r2_key: string | null }>();
  if (!row?.preview_r2_key || !isPreviewKey(row.preview_r2_key)) {
    return new Response("Preview not found", { status: 404 });
  }

  let preview: Response;
  try {
    preview = await getUrlScanPreviewService().fetch(
      new Request(
        `https://publisher-asset-url-scanner.internal/internal/previews/${encodeURIComponent(row.preview_r2_key)}`,
      ),
    );
  } catch {
    return new Response("Preview unavailable", { status: 503 });
  }
  if (!preview.ok || !preview.body) return new Response("Preview not found", { status: 404 });

  const headers = new Headers(preview.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(preview.body, { status: 200, headers });
}

function isPreviewKey(value: string): boolean {
  return /^unconfirmed\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(
    value,
  );
}
