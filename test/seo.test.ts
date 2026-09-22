import { describe, expect, it } from "vitest";

import type { PublishedAssetDetail } from "@/lib/assets/get-asset";
import { buildAssetJsonLd, buildSiteJsonLd, serializeJsonLd } from "@/lib/seo";

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
};

describe("SEO structured data", () => {
  it("describes Cite Supply as a website and organization", () => {
    const value = buildSiteJsonLd();
    expect(value).toMatchObject({ "@context": "https://schema.org" });
    expect(JSON.stringify(value)).toContain('"@type":"WebSite"');
    expect(JSON.stringify(value)).toContain('"@type":"Organization"');
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
  });

  it("escapes markup-breaking characters in JSON-LD", () => {
    expect(serializeJsonLd({ value: "</script>" })).toBe('{"value":"\\u003c/script>"}');
  });
});
