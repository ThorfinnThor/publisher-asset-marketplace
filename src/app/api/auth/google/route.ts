import {
  clearLinkIntentCookie,
  getAuthenticatedProfile,
  linkIntentCookie,
  nonceCookie,
  signOAuthState,
  stateCookie,
} from "@/lib/auth/github";
import { googleAuthIsConfigured, googleAuthorizationUrl } from "@/lib/auth/google";
import { getDatabase } from "@/lib/db/client";

export async function GET(request: Request): Promise<Response> {
  if (!googleAuthIsConfigured()) {
    return Response.json({ error: "Google sign-in is not configured yet." }, { status: 503 });
  }
  const linkMode = new URL(request.url).searchParams.get("mode") === "link";
  let profile = null;
  try {
    profile = linkMode ? await getAuthenticatedProfile(request, getDatabase()) : null;
  } catch {
    if (linkMode) {
      return Response.redirect(new URL("/creator/dashboard?auth=auth_error", request.url), 303);
    }
  }
  if (linkMode && !profile) {
    return Response.redirect(new URL("/creator/dashboard?auth=auth_error", request.url), 303);
  }
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const headers = new Headers({
    location: googleAuthorizationUrl(request, state, nonce),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", stateCookie(await signOAuthState(state)));
  headers.append("set-cookie", nonceCookie(await signOAuthState(nonce)));
  if (profile) {
    headers.append("set-cookie", linkIntentCookie(await signOAuthState(`${state}|${profile.id}`)));
  } else {
    headers.append("set-cookie", clearLinkIntentCookie());
  }
  return new Response(null, { status: 302, headers });
}
