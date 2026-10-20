import { describe, expect, it } from "vitest";

import type { PublishedAssetDetail } from "@/lib/assets/get-asset";
import {
  buildAssetJsonLd,
  buildAssetMetaDescription,
  buildBreadcrumbJsonLd,
  buildSiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import { assetRobotsMetadata, isAssetSeoEligible, isSearchIndexable } from "@/lib/seo/indexability";

const asset: PublishedAssetDetail = {
  id: "asset-1",
  source_id: "source_worldbank",
  slug: "population",
  asset_type: "dataset",
  title: "Population, total",
  description: "Total population counts by country and reporting year from the source.",
  canonical_url: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  embed_url: null,
  embed_origin: null,
  preview_url: "https://example.com/population.png",
  citation_text: "World Bank: Population, total.",
  attribution_name: "World Bank",
  attribution_url: "https://data.worldbank.org",
  attribution_terms: "Credit World Bank — CC BY 4.0",
  source_updated_at: "2026-09-20T00:00:00Z",
  last_checked_at: "2026-09-21T00:00:00Z",
  license_code: "CC-BY-4.0",
  rights_status: "safe",
  rights_json: null,
  metadata_json: null,
  source_name: "World Bank Open Data",
  source_base_url: "https://data.worldbank.org",
  source_policy_url: "https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets",
  search_indexable: 1,
};

describe("SEO structured data", () => {
  it("describes Cite Supply as a website and organization", () => {
    const value = buildSiteJsonLd();
    expect(value).toMatchObject({ "@context": "https://schema.org" });
    expect(JSON.stringify(value)).toContain('"@type":"WebSite"');
    expect(JSON.stringify(value)).toContain('"@type":"Organization"');
    expect(JSON.stringify(value)).toContain('"@type":"DataCatalog"');
    expect(JSON.stringify(value)).toContain("citesupply-mark.png");
    expect(JSON.stringify(value)).toContain("info@citesupply.com");
  });

  it("marks dataset assets with source provenance and catalog membership", () => {
    expect(buildAssetJsonLd(asset)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: asset.title,
      sameAs: asset.canonical_url,
      creator: { name: "World Bank Open Data" },
      includedInDataCatalog: { name: "Cite Supply" },
    });
    expect(buildAssetJsonLd(asset)).not.toHaveProperty("isBasedOn");
  });

  it("describes visible breadcrumb paths", () => {
    expect(
      buildBreadcrumbJsonLd([
        { name: "Topics", path: "/topics" },
        { name: "Health", path: "/topics/health" },
      ]),
    ).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "Cite Supply", item: "https://citesupply.com" },
        { position: 2, name: "Topics", item: "https://citesupply.com/topics" },
        { position: 3, name: "Health", item: "https://citesupply.com/topics/health" },
      ],
    });
  });

  it("escapes markup-breaking characters in JSON-LD", () => {
    expect(serializeJsonLd({ value: "</script>" })).toBe('{"value":"\\u003c/script>"}');
  });
});

describe("search indexability", () => {
  it("indexes only assets explicitly selected for search", () => {
    expect(isSearchIndexable(1)).toBe(true);
    expect(isSearchIndexable(true)).toBe(true);
    expect(isSearchIndexable(0)).toBe(false);
    expect(isSearchIndexable(undefined)).toBe(false);
  });

  it("keeps non-selected assets discoverable through internal links without indexing them", () => {
    expect(assetRobotsMetadata(0)).toMatchObject({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
    expect(assetRobotsMetadata(1)).toMatchObject({
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    });
  });

  it("requires safe rights, useful copy and a public canonical URL", () => {
    expect(isAssetSeoEligible(asset)).toBe(true);
    expect(isAssetSeoEligible({ ...asset, rights_status: "restricted" })).toBe(false);
    expect(isAssetSeoEligible({ ...asset, description: "Too short" })).toBe(false);
    expect(isAssetSeoEligible({ ...asset, canonical_url: "http://example.com" })).toBe(false);
  });
});

describe("asset meta description", () => {
  it("leads with source and freshness instead of the verbatim source text", () => {
    const value = buildAssetMetaDescription(asset);
    expect(value).toBe(
      "Dataset from World Bank Open Data, updated Sept 2026: Total population counts by country and reporting year from the source. Reuse rights and exact citation.",
    );
    expect(value).not.toBe(asset.description);
  });

  it("keeps long source descriptions within 160 characters at a word boundary", () => {
    const value = buildAssetMetaDescription({
      ...asset,
      description:
        "Broad money is the sum of currency outside banks; demand deposits other than those of the central government; the time, savings, and foreign currency deposits of resident sectors.",
    });
    expect(value.length).toBeLessThanOrEqual(160);
    expect(value).toMatch(/… Reuse rights and exact citation\.$/u);
  });

  it("prefers the reviewed editorial answer when one is available", () => {
    const value = buildAssetMetaDescription(
      asset,
      "Proved reserves cover about 50 years of current oil production. Gas lasts longer.",
    );
    expect(value).toContain("Proved reserves cover about 50 years of current oil production.");
    expect(value).not.toContain("Gas lasts longer");
  });
});
