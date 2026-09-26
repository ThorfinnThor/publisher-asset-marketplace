const MARKETPLACE_EMBED_PATH = /^\/embed\/(?:eurostat|worldbank)-[a-z0-9][a-z0-9._-]{1,63}\/?$/u;
const PUBLIC_PREVIEW_PATH =
  /^\/api\/submission-previews\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/iu;
const PRIVATE_EDITORIAL_NAMESPACE = "/_editorial/";

export function isEmbeddableMarketplacePath(pathname: string): boolean {
  return MARKETPLACE_EMBED_PATH.test(pathname);
}

export function isPublicPreviewPath(pathname: string): boolean {
  return PUBLIC_PREVIEW_PATH.test(pathname);
}

export function isPrivateEditorialPreviewPath(pathname: string): boolean {
  let candidate = pathname;
  for (let depth = 0; depth < 3; depth += 1) {
    if (candidate.startsWith(PRIVATE_EDITORIAL_NAMESPACE)) return true;
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) return false;
      candidate = decoded;
    } catch {
      return false;
    }
  }
  return candidate.startsWith(PRIVATE_EDITORIAL_NAMESPACE);
}

export function withSecurityHeaders(
  response: Response,
  options: {
    allowEmbedding?: boolean;
    allowCrossOriginResource?: boolean;
    privateEditorialPreview?: boolean;
  } = {},
): Response {
  const headers = new Headers(response.headers);
  if (options.privateEditorialPreview) {
    headers.set(
      "content-security-policy",
      "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; connect-src 'none'",
    );
    headers.set("cache-control", "private, no-store");
    headers.set("cross-origin-resource-policy", "same-origin");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-frame-options", "DENY");
    headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  } else if (options.allowEmbedding) {
    headers.set(
      "content-security-policy",
      "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors *; form-action 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; connect-src 'none'",
    );
    headers.delete("x-frame-options");
    headers.set("cross-origin-resource-policy", "cross-origin");
    // Embed usage is counted at request time, so browser/CDN reuse must not bypass the Worker.
    headers.set("cache-control", "private, no-store");
  } else {
    headers.set(
      "content-security-policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src https:; connect-src 'self'",
    );
    headers.set("x-frame-options", "DENY");
    headers.set(
      "cross-origin-resource-policy",
      options.allowCrossOriginResource ? "cross-origin" : "same-origin",
    );
  }
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=(), payment=()");
  if (!options.privateEditorialPreview) {
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
  }
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
