import { describe, expect, it } from "vitest";

import {
  isOwidChartCanonicalUrl,
  parseOwidChartRightsPage,
} from "../src/lib/rights/owid-chart-rights";

const canonicalUrl = "https://ourworldindata.org/grapher/life-expectancy";

function page(overrides: Record<string, unknown> = {}): string {
  const image = {
    "@type": "ImageObject",
    contentUrl: `${canonicalUrl}.png?imWidth=1700`,
    creator: {
      "@type": "Organization",
      name: "Our World in Data",
      url: "https://ourworldindata.org",
    },
    creditText: "Data source: Example. Chart: Our World in Data.",
    copyrightNotice: "Our World in Data",
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...overrides,
  };
  return `<!doctype html><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: canonicalUrl,
    image,
  })}</script>`;
}

describe("OWID chart rights proof", () => {
  it("accepts only official Grapher canonical URLs before network access", () => {
    expect(isOwidChartCanonicalUrl(canonicalUrl)).toBe(true);
    expect(isOwidChartCanonicalUrl("https://example.org/grapher/life-expectancy")).toBe(false);
    expect(isOwidChartCanonicalUrl("https://ourworldindata.org/explorers/example")).toBe(false);
  });

  it("accepts matching asset-specific OWID JSON-LD", () => {
    expect(parseOwidChartRightsPage(page(), canonicalUrl)).toEqual({
      ok: true,
      proof: {
        canonical_url: canonicalUrl,
        chart_owner: "owid",
        chart_license_code: "CC_BY",
        chart_license_raw: "CC BY 4.0",
        chart_license_url: "https://creativecommons.org/licenses/by/4.0/",
        copyright_notice: "Our World in Data",
        credit_text: "Data source: Example. Chart: Our World in Data.",
      },
    });
  });

  it("fails closed for third-party ownership or an unsupported license", () => {
    expect(
      parseOwidChartRightsPage(page({ copyrightNotice: "Example Institute" }), canonicalUrl),
    ).toEqual({ ok: false, reason: "asset_specific_ownership_proof_not_found" });
    expect(
      parseOwidChartRightsPage(page({ license: "https://example.org/custom" }), canonicalUrl),
    ).toEqual({ ok: false, reason: "unsupported_or_missing_chart_license" });
  });

  it("rejects cross-asset or non-OWID evidence", () => {
    const mismatched = page().replace(canonicalUrl, `${canonicalUrl}-other`);
    expect(parseOwidChartRightsPage(mismatched, canonicalUrl)).toEqual({
      ok: false,
      reason: "asset_specific_ownership_proof_not_found",
    });
    expect(parseOwidChartRightsPage(page(), "https://example.org/grapher/life-expectancy")).toEqual(
      { ok: false, reason: "invalid_canonical_url" },
    );
  });

  it("ignores malformed unrelated JSON-LD blocks", () => {
    const html = `<script type="application/ld+json">not-json</script>${page()}`;
    expect(parseOwidChartRightsPage(html, canonicalUrl).ok).toBe(true);
  });
});
