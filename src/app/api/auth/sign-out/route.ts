import { clearSessionCookie, deleteAuthSession } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    await deleteAuthSession(request, getDatabase());
  } catch {
    // Clear the browser cookie even when the database is temporarily unavailable.
  }
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/creator/dashboard", request.url).toString(),
      "set-cookie": clearSessionCookie(),
      "cache-control": "no-store",
    },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
