const MARKETPLACE_EMBED_PATH = /^\/embed\/(?:eurostat|worldbank)-[a-z0-9][a-z0-9._-]{1,63}\/?$/u;

export function isEmbeddableMarketplacePath(pathname: string): boolean {
  return MARKETPLACE_EMBED_PATH.test(pathname);
}

export function withSecurityHeaders(
  response: Response,
  options: { allowEmbedding?: boolean } = {},
): Response {
  const headers = new Headers(response.headers);
  if (options.allowEmbedding) {
    headers.set(
      "content-security-policy",
      "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors *; form-action 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; connect-src 'none'",
    );
    headers.delete("x-frame-options");
    headers.set("cross-origin-resource-policy", "cross-origin");
    headers.set("cache-control", "public, max-age=300, must-revalidate");
  } else {
    headers.set(
      "content-security-policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src https:; connect-src 'self'",
    );
    headers.set("x-frame-options", "DENY");
    headers.set("cross-origin-resource-policy", "same-origin");
  }
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=(), payment=()");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
