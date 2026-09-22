import { describe, expect, it } from "vitest";

import {
  isEmbeddableMarketplacePath,
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
});
