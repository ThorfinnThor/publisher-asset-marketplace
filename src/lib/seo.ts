import type { PublishedAssetDetail } from "@/lib/assets/get-asset";
import { normalizePublicHttpsUrl } from "@/lib/submissions/validate";

export const SITE_ORIGIN = "https://citesupply.com";

export const siteSeo = {
  title: "Cite Supply — Publisher-ready data, charts, and tools",
  description:
    "Find publisher-ready charts, datasets, calculators and benchmarks with visible sources, freshness and reuse conditions.",
} as const;

export function buildSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "Cite Supply",
        url: SITE_ORIGIN,
        logo: `${SITE_ORIGIN}/icon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "Cite Supply",
        alternateName: "Where publishers find data",
        url: SITE_ORIGIN,
        description: siteSeo.description,
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        inLanguage: "en",
      },
    ],
  };
}

export function buildAssetJsonLd(asset: PublishedAssetDetail): Record<string, unknown> {
  const pageUrl = `${SITE_ORIGIN}/asset/${encodeURIComponent(asset.slug)}`;
  const sourceName = asset.source_name || asset.attribution_name || "Independent source";
  const sourceUrl = publicHttpsUrl(asset.attribution_url) ?? publicHttpsUrl(asset.canonical_url);
  const image = publicHttpsUrl(asset.preview_url);
  const license = publicHttpsUrl(asset.source_policy_url);
  const modified = validIsoDate(asset.source_updated_at ?? asset.last_checked_at);
  const common = {
    "@id": `${pageUrl}#asset`,
    name: asset.title,
    description: structuredDescription(asset.description, sourceName),
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    sameAs: asset.canonical_url,
    isBasedOn: asset.canonical_url,
    creator: {
      "@type": "Organization",
      name: sourceName,
      ...(sourceUrl ? { url: sourceUrl } : {}),
    },
    provider: { "@id": `${SITE_ORIGIN}/#organization` },
    ...(modified ? { dateModified: modified } : {}),
    ...(image ? { image } : {}),
    ...(license ? { license } : {}),
    ...(asset.attribution_terms ? { conditionsOfAccess: asset.attribution_terms } : {}),
  };

  if (asset.asset_type === "dataset" || asset.asset_type === "table") {
    return {
      "@context": "https://schema.org",
      "@type": "Dataset",
      ...common,
      isAccessibleForFree: true,
      includedInDataCatalog: {
        "@type": "DataCatalog",
        "@id": `${SITE_ORIGIN}/#catalog`,
        name: "Cite Supply",
        url: SITE_ORIGIN,
      },
    };
  }

  if (asset.asset_type === "calculator" || asset.asset_type === "widget") {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      ...common,
      applicationCategory:
        asset.asset_type === "calculator" ? "CalculatorApplication" : "WebApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    ...common,
    additionalType: `https://schema.org/${asset.asset_type === "benchmark" ? "Dataset" : "ImageObject"}`,
  };
}

export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function publicHttpsUrl(value: string | null): string | null {
  const normalized = normalizePublicHttpsUrl(value);
  return normalized.ok ? normalized.value : null;
}

function validIsoDate(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function structuredDescription(description: string, sourceName: string): string {
  const value = description.trim();
  if (value.length >= 50) return value;
  return `${value} Source: ${sourceName}. Cite Supply lists its freshness and reuse conditions.`;
}
