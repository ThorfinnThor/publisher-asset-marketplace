import {
  clearLinkIntentCookie,
  clearNonceCookie,
  clearStateCookie,
  getAuthenticatedProfile,
  readLinkIntent,
  readNonce,
  readState,
  sessionCookie,
  verifyOAuthState,
} from "@/lib/auth/github";
import { completeGoogleLink, completeGoogleLogin } from "@/lib/auth/google";
import { getDatabase } from "@/lib/db/client";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readState(request);
  let validState = false;
  try {
    validState = Boolean(state && (await verifyOAuthState(state, expectedState)));
  } catch {
    validState = false;
  }
  if (!code || !state || !validState) {
    return redirectToDashboard(request, "auth_error");
  }

  try {
    const linkIntent = readLinkIntent(request);
    if (linkIntent) {
      const profile = await getAuthenticatedProfile(request, getDatabase());
      if (!profile || !(await verifyOAuthState(`${state}|${profile.id}`, linkIntent))) {
        return redirectToDashboard(request, "auth_error");
      }
      const result = await completeGoogleLink(request, code, readNonce(request), profile.id);
      return redirectToDashboard(request, result.ok ? "linked" : "link_error");
    }
    const result = await completeGoogleLogin(request, code, readNonce(request));
    const response = redirectToDashboard(request, "signed_in");
    response.headers.append("set-cookie", sessionCookie(result.sessionToken));
    return response;
  } catch {
    return redirectToDashboard(request, "auth_error");
  }
}

function redirectToDashboard(request: Request, status: string): Response {
  const target = new URL("/creator/dashboard", request.url);
  target.searchParams.set("auth", status);
  const headers = new Headers({ location: target.toString(), "cache-control": "no-store" });
  headers.append("set-cookie", clearStateCookie());
  headers.append("set-cookie", clearNonceCookie());
  headers.append("set-cookie", clearLinkIntentCookie());
  return new Response(null, { status: 302, headers });
}
