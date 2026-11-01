import { describe, expect, it } from "vitest";

import {
  gaMeasurementId,
  isAnalyticsExcludedPath,
  isGoogleAnalyticsCookie,
} from "../src/lib/analytics/consent";

describe("GA4 consent boundaries", () => {
  it("uses the Cite Supply measurement ID", () => {
    expect(gaMeasurementId).toBe("G-NJETCBLLNE");
  });

  it("keeps GA off signed-in, admin, private preview and embed surfaces", () => {
    for (const path of [
      "/admin/submissions",
      "/admin",
      "/auth/github/callback",
      "/creator/dashboard",
      "/creator/assets/abc/edit",
      "/dashboard",
      "/embed/worldbank-sp.pop.totl",
      "/submit",
      "/_editorial/preview/cb-002",
      "/%5Feditorial/preview/cb-002",
    ]) {
      expect(isAnalyticsExcludedPath(path), path).toBe(true);
    }
  });

  it("allows GA on public pages after consent", () => {
    for (const path of [
      "/",
      "/search",
      "/asset/owid-life-expectancy",
      "/creator/guide",
      "/creator/terms",
      "/privacy",
      "/submitted-assets",
      "/embedded",
    ]) {
      expect(isAnalyticsExcludedPath(path), path).toBe(false);
    }
  });

  it("recognises only Google Analytics cookies for revocation cleanup", () => {
    expect(isGoogleAnalyticsCookie("_ga")).toBe(true);
    expect(isGoogleAnalyticsCookie("_ga_NJETCBLLNE")).toBe(true);
    expect(isGoogleAnalyticsCookie("_gid")).toBe(true);
    expect(isGoogleAnalyticsCookie("__Host-session")).toBe(false);
    expect(isGoogleAnalyticsCookie("garden")).toBe(false);
  });
});

describe("consent banner paints with the page", () => {
  // Appearing after hydration made the banner paragraph the late mobile LCP element.
  it("renders open on the server and is hidden before paint once a choice exists", async () => {
    const { readFileSync } = await import("node:fs");
    const { consentHeadScript, consentStorageKey } = await import("../src/lib/analytics/consent");
    expect(consentHeadScript).toContain(JSON.stringify(consentStorageKey));
    expect(consentHeadScript).toContain('setAttribute("data-consent-set"');
    const banner = readFileSync("src/components/cookie-consent.tsx", "utf8");
    expect(banner).toContain("useState(!excluded)");
    expect(banner).toContain("removeAttribute(consentDecidedAttribute)");
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(
      /<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: consentHeadScript \}\} \/>/,
    );
    expect(readFileSync("src/app/globals.css", "utf8")).toMatch(
      /html\[data-consent-set\] \.cookie-consent \{\s*display: none;/,
    );
  });
});
