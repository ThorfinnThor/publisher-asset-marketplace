import {
  authIsConfigured,
  githubAuthorizationUrl,
  signOAuthState,
  stateCookie,
} from "@/lib/auth/github";

export async function GET(request: Request): Promise<Response> {
  if (!authIsConfigured()) {
    return Response.json({ error: "Creator sign-in is not configured yet." }, { status: 503 });
  }
  const state = crypto.randomUUID();
  const signedState = await signOAuthState(state);
  return new Response(null, {
    status: 302,
    headers: {
      location: githubAuthorizationUrl(request, state),
      "set-cookie": stateCookie(signedState),
      "cache-control": "no-store",
    },
  });
}
