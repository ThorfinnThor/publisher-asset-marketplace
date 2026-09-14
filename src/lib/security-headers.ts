export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "content-security-policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src https:; connect-src 'self'",
  );
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=(), payment=()");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
