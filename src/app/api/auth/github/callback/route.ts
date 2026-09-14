import {
  clearStateCookie,
  completeGithubLogin,
  sessionCookie,
  readState,
  verifyOAuthState,
} from "@/lib/auth/github";

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
    const result = await completeGithubLogin(request, code);
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
  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      "set-cookie": clearStateCookie(),
      "cache-control": "no-store",
    },
  });
}
