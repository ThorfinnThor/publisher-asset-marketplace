import { describe, expect, it } from "vitest";

import benchmark from "../data/benchmarks/url-scan-security-v1.json";
import { urlScanContractV1 } from "../src/lib/submissions/url-scan-contract";

describe("G1 URL-first onboarding contract", () => {
  it("keeps the machine contract and normative cases on the same version", () => {
    expect(benchmark.contractVersion).toBe(urlScanContractV1.version);
  });

  it("defines the complete state machine without duplicate states", () => {
    expect(benchmark.requiredStates).toEqual(urlScanContractV1.statuses);
    expect(new Set(urlScanContractV1.statuses).size).toBe(urlScanContractV1.statuses.length);
    expect(urlScanContractV1.terminalStatuses).toEqual(["failed", "expired", "converted"]);
  });

  it("never permits a scan or manifest to publish automatically", () => {
    expect(urlScanContractV1.autoPublish).toBe(false);
    expect(benchmark.cases.every((testCase) => testCase.autoPublish === false)).toBe(true);
  });

  it("covers the required network, sandbox, rights and prompt-injection failures", () => {
    const caseIds = benchmark.cases.map((testCase) => testCase.id);
    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(caseIds).toEqual(
      expect.arrayContaining([
        "mixed-dns-rejected",
        "redirect-to-private-rejected",
        "subresource-private-rejected",
        "frame-ancestor-block",
        "unguarded-session-storage",
        "unclear-rights-remain-unverified",
        "manifest-does-not-auto-publish",
        "prompt-injection-is-data",
      ]),
    );
  });

  it("keeps the scanner bounded and cheaper than an unbounded crawl", () => {
    expect(urlScanContractV1.limits.redirects).toBe(3);
    expect(urlScanContractV1.limits.requests).toBeLessThanOrEqual(80);
    expect(urlScanContractV1.limits.jobTimeoutMs).toBeLessThanOrEqual(30_000);
    expect(urlScanContractV1.limits.resultJsonBytes).toBeLessThanOrEqual(64 * 1024);
    expect(urlScanContractV1.sandboxProfile).toBe("v1:allow-scripts");
  });
});
