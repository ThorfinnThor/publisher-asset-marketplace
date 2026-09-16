import { getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { publicUrlScanJob, type UrlScanJobRow } from "@/lib/submissions/url-scan-jobs";

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
  if (!profile) return errorResponse(401, "authentication_required", "Sign in to view this scan.");

  const { id } = await params;
  const job = await db
    .prepare(
      `
        SELECT id, requested_url, status, attempt_count, result_json, error_code,
               created_at, started_at, completed_at, expires_at, updated_at
        FROM url_scan_jobs
        WHERE id = ? AND creator_id = ?
        LIMIT 1
      `,
    )
    .bind(id, profile.id)
    .first<UrlScanJobRow>();
  if (!job) return errorResponse(404, "scan_not_found", "Scan not found.");

  return Response.json(
    { job: publicUrlScanJob(job) },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}
