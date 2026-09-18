import { nonceCookie, signOAuthState, stateCookie } from "@/lib/auth/github";
import { googleAuthIsConfigured, googleAuthorizationUrl } from "@/lib/auth/google";

export async function GET(request: Request): Promise<Response> {
  if (!googleAuthIsConfigured()) {
    return Response.json({ error: "Google sign-in is not configured yet." }, { status: 503 });
  }
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const headers = new Headers({
    location: googleAuthorizationUrl(request, state, nonce),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", stateCookie(await signOAuthState(state)));
  headers.append("set-cookie", nonceCookie(await signOAuthState(nonce)));
  return new Response(null, { status: 302, headers });
}
