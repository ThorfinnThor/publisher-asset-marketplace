import { describe, expect, it } from "vitest";

import {
  createMagicLinkToken,
  magicLinkDisplayName,
  magicLinkFragmentUrl,
  magicLinkIdentitySeed,
  normalizeMagicLinkAppOrigin,
  normalizeMagicLinkEmail,
  sameOriginAuthRequest,
  validMagicLinkToken,
} from "../src/lib/auth/magic-link-core";

describe("magic-link authentication primitives", () => {
  it("normalizes valid addresses and rejects malformed input", () => {
    expect(normalizeMagicLinkEmail(" Creator@Example.COM ")).toBe("creator@example.com");
    expect(normalizeMagicLinkEmail("not-an-email")).toBeNull();
    expect(normalizeMagicLinkEmail(null)).toBeNull();
    expect(normalizeMagicLinkEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });

  it("generates distinct 256-bit base64url tokens", () => {
    const first = createMagicLinkToken();
    const second = createMagicLinkToken();
    expect(first).not.toBe(second);
    expect(validMagicLinkToken(first)).toBe(true);
    expect(validMagicLinkToken(second)).toBe(true);
    expect(first).toHaveLength(43);
  });

  it("rejects truncated, padded and non-base64url tokens", () => {
    expect(validMagicLinkToken("a".repeat(42))).toBe(false);
    expect(validMagicLinkToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(validMagicLinkToken(`${"a".repeat(42)}!`)).toBe(false);
  });

  it("places the one-time token in a fragment instead of the server-visible query", () => {
    const token = "a".repeat(43);
    const url = new URL(magicLinkFragmentUrl("https://market.example/api/auth/magic-link", token));
    expect(url.origin).toBe("https://market.example");
    expect(url.pathname).toBe("/auth/email");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#token=${token}`);
  });

  it("accepts only a bare HTTPS application origin", () => {
    expect(normalizeMagicLinkAppOrigin("https://market.example")).toBe("https://market.example");
    expect(normalizeMagicLinkAppOrigin("http://market.example")).toBeNull();
    expect(normalizeMagicLinkAppOrigin("https://user:password@market.example")).toBeNull();
    expect(normalizeMagicLinkAppOrigin("https://market.example/path")).toBeNull();
  });

  it("derives a readable default display name", () => {
    expect(magicLinkDisplayName("jane.doe+assets@example.com")).toBe("jane doe assets");
  });

  it("derives the same durable identity seed for equivalent email spelling", () => {
    const first = normalizeMagicLinkEmail(" Creator@Example.COM ");
    const second = normalizeMagicLinkEmail("creator@example.com");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(magicLinkIdentitySeed(first as string)).toBe(magicLinkIdentitySeed(second as string));
  });

  it("accepts only same-origin browser submissions", () => {
    const allowed = new Request("https://market.example/api/auth/magic-link", {
      method: "POST",
      headers: { origin: "https://market.example", "sec-fetch-site": "same-origin" },
    });
    const crossSite = new Request("https://market.example/api/auth/magic-link", {
      method: "POST",
      headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    });
    expect(sameOriginAuthRequest(allowed)).toBe(true);
    expect(sameOriginAuthRequest(crossSite)).toBe(false);
  });
});
