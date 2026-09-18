import { sessionCookie } from "@/lib/auth/github";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { sameOriginAuthRequest } from "@/lib/auth/magic-link-core";

export async function POST(request: Request): Promise<Response> {
  if (!sameOriginAuthRequest(request)) {
    return json({ error: "Request origin is not allowed." }, 403);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4_096) {
    return json({ error: "Request is too large." }, 413);
  }

  const payload = (await request.json().catch(() => null)) as { token?: unknown } | null;
  try {
    const result = await consumeMagicLink(payload?.token);
    if (!result) return json({ error: "This sign-in link is invalid or has expired." }, 401);
    const response = json({ ok: true, redirect: "/creator/dashboard?auth=signed_in" }, 200);
    response.headers.append("set-cookie", sessionCookie(result.sessionToken));
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "magic_link_verification_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return json({ error: "Sign-in could not be completed. Please request a new link." }, 503);
  }
}

function json(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
