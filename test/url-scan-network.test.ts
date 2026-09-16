import { describe, expect, it } from "vitest";

import {
  browserGuardrailDomains,
  isNonPublicIp,
  normalizePublicHttpsUrl,
} from "../src/lib/submissions/url-scan-network";

describe("URL scan network boundary", () => {
  it("builds exact and subdomain Browser Run guardrails without prefix wildcards", () => {
    expect(browserGuardrailDomains("https://www.example.com/tool")).toEqual([
      "www.example.com",
      "*.www.example.com",
    ]);
    expect(browserGuardrailDomains("https://tools.example.com/tool")).toEqual([
      "tools.example.com",
      "*.tools.example.com",
    ]);
    expect(browserGuardrailDomains("https://1.1.1.1/tool")).toEqual(["1.1.1.1"]);
  });

  it("normalizes public HTTPS URLs and drops fragments", () => {
    expect(normalizePublicHttpsUrl(" https://Example.com/tool?q=1#section ")).toEqual({
      ok: true,
      url: "https://example.com/tool?q=1",
      hostname: "example.com",
    });
  });

  it.each([
    "http://example.com/tool",
    "https://user:secret@example.com/tool",
    "https://example.com:8443/tool",
    "https://localhost/tool",
    "https://service.internal/tool",
    "https://127.0.0.1/tool",
    "https://10.0.0.1/tool",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/tool",
    "https://[fd00::1]/tool",
  ])("rejects non-public or unsafe target %s", (url) => {
    expect(normalizePublicHttpsUrl(url).ok).toBe(false);
  });

  it.each([
    "0.0.0.0",
    "100.64.0.1",
    "172.31.255.255",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("recognizes reserved address %s", (address) => {
    expect(isNonPublicIp(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isNonPublicIp(address)).toBe(false);
    },
  );
});
