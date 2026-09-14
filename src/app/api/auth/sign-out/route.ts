import { clearSessionCookie, deleteAuthSession } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";

export async function POST(request: Request): Promise<Response> {
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
