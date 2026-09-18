import { getAuthenticatedProfile, sessionTokenForRequest } from "@/lib/auth/github";
import { hashAuthToken, type AuthProfile } from "@/lib/auth/identity";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { sameOriginAuthRequest } from "@/lib/auth/magic-link-core";
import { getDatabase } from "@/lib/db/client";

export async function POST(request: Request): Promise<Response> {
  if (!sameOriginAuthRequest(request))
    return json({ error: "Request origin is not allowed." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4_096) {
    return json({ error: "Request is too large." }, 413);
  }

  let profile: AuthProfile | null = null;
  try {
    profile = await getAuthenticatedProfile(request, getDatabase());
  } catch {
    return json({ error: "Sign-in is temporarily unavailable." }, 503);
  }
  const sessionToken = sessionTokenForRequest(request);
  if (!profile || !sessionToken) return json({ error: "Sign-in is required." }, 401);
  const payload = (await request.json().catch(() => null)) as { email?: unknown } | null;
  try {
    await requestMagicLink(request, payload?.email, {
      profileId: profile.id,
      sessionTokenHash: await hashAuthToken(sessionToken),
    });
    return json({ ok: true }, 202);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "magic_link_link_request_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return json({ error: "The linking email could not be sent. Please try again later." }, 503);
  }
}

function json(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
