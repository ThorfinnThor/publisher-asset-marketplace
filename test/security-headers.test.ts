import { describe, expect, it } from "vitest";

import {
  isEmbeddableMarketplacePath,
  isPrivateEditorialPreviewPath,
  isPublicPreviewPath,
  withSecurityHeaders,
} from "../src/lib/security-headers";

describe("production security headers", () => {
  it("allows framing only on reviewed marketplace embed route families", () => {
    expect(isEmbeddableMarketplacePath("/embed/eurostat-tps00001")).toBe(true);
    expect(isEmbeddableMarketplacePath("/embed/worldbank-fb.bnk.capa.zs")).toBe(true);
    expect(isEmbeddableMarketplacePath("/embed/creator-unreviewed")).toBe(false);
    expect(isEmbeddableMarketplacePath("/embed/worldbank-x/extra")).toBe(false);
  });

  it("adds browser isolation and framing protections without dropping response headers", async () => {
    const response = withSecurityHeaders(
      new Response("ok", { headers: { "cache-control": "no-store" } }),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).toContain(
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    );
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(await response.text()).toBe("ok");
  });

  it("allows only the isolated marketplace embed response to be framed", () => {
    const response = withSecurityHeaders(new Response("embed"), { allowEmbedding: true });
    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors *");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("content-security-policy")).not.toContain(
      "static.cloudflareinsights.com",
    );
  });

  it("allows public submission previews to render across the legacy and custom domains", () => {
    expect(
      isPublicPreviewPath("/api/submission-previews/11111111-1111-4111-8111-111111111111"),
    ).toBe(true);
    expect(isPublicPreviewPath("/api/submission-previews/not-a-uuid")).toBe(false);

    const response = withSecurityHeaders(new Response("image"), {
      allowCrossOriginResource: true,
    });
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("protects the complete private editorial namespace, including encoded paths", () => {
    expect(
      isPrivateEditorialPreviewPath("/_editorial/preview/cb-002-eu-renewable-share-patterns"),
    ).toBe(true);
    expect(isPrivateEditorialPreviewPath("/_editorial/preview/not-a-brief")).toBe(true);
    expect(isPrivateEditorialPreviewPath("/%5Feditorial/preview/cb-002-reviewed")).toBe(true);
    expect(isPrivateEditorialPreviewPath("/%255Feditorial/preview/cb-002-reviewed")).toBe(true);
    expect(isPrivateEditorialPreviewPath("/_editorial-other/preview/cb-002-reviewed")).toBe(false);
    expect(isPrivateEditorialPreviewPath("/%E0%A4%A")).toBe(false);
  });

  it("applies fail-closed indexing, caching, referrer and framing headers to editorial previews", () => {
    const response = withSecurityHeaders(new Response("private preview"), {
      privateEditorialPreview: true,
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});
