import { describe, expect, it } from "vitest";

import { withSecurityHeaders } from "../src/lib/security-headers";

describe("production security headers", () => {
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
});
