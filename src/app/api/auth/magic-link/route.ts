import { requestMagicLink } from "@/lib/auth/magic-link";
import { sameOriginAuthRequest } from "@/lib/auth/magic-link-core";

export async function POST(request: Request): Promise<Response> {
  if (!sameOriginAuthRequest(request)) {
    return json({ error: "Request origin is not allowed." }, 403);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4_096) {
    return json({ error: "Request is too large." }, 413);
  }

  const payload = (await request.json().catch(() => null)) as { email?: unknown } | null;
  try {
    await requestMagicLink(request, payload?.email);
    return json({ ok: true }, 202);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "magic_link_request_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return json({ error: "Sign-in email could not be sent. Please try again later." }, 503);
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
