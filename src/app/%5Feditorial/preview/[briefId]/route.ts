import { getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import {
  getVerifiedPrivateEditorialPreview,
  privateEditorialPreviewHeaders,
} from "@/lib/editorial/private-preview";

type PreviewRouteContext = {
  params: Promise<{ briefId: string }>;
};

export async function GET(request: Request, context: PreviewRouteContext): Promise<Response> {
  const { briefId } = await context.params;
  const preview = await getVerifiedPrivateEditorialPreview(briefId);
  if (!preview) return notFoundResponse();

  let isAdmin = false;
  try {
    const profile = await getAuthenticatedProfile(request, getDatabase());
    isAdmin = profile?.role === "admin";
  } catch {
    isAdmin = false;
  }
  if (!isAdmin) return notFoundResponse();

  return new Response(preview.html, { headers: privateEditorialPreviewHeaders() });
}

function notFoundResponse(): Response {
  return new Response("Not found.", {
    status: 404,
    headers: privateEditorialPreviewHeaders(),
  });
}
