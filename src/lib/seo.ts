import type { PublishedAssetDetail } from "@/lib/assets/get-asset";
import { publicContactEmail } from "@/lib/site-identity";
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
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/citesupply-mark.png`,
          width: 256,
          height: 256,
        },
        email: `mailto:${publicContactEmail}`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: publicContactEmail,
          availableLanguage: ["English", "German"],
        },
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
      {
        "@type": "DataCatalog",
        "@id": `${SITE_ORIGIN}/#catalog`,
        name: "Cite Supply catalog",
        description: siteSeo.description,
        url: `${SITE_ORIGIN}/topics`,
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
    ...(asset.source_id ? { sameAs: asset.canonical_url } : { isBasedOn: asset.canonical_url }),
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

export function buildBreadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Cite Supply",
        item: SITE_ORIGIN,
      },
      ...items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: item.name,
        item: new URL(item.path, SITE_ORIGIN).toString(),
      })),
    ],
  };
}

const META_DESCRIPTION_MAX_LENGTH = 160;

// Source descriptions are copied verbatim from OWID, World Bank and Eurostat, so
// using them as the meta description duplicates the source page. Lead with what
// this page adds (source, freshness, reuse) and keep only a trimmed summary.
export function buildAssetMetaDescription(
  asset: Pick<
    PublishedAssetDetail,
    "asset_type" | "attribution_name" | "description" | "source_name" | "source_updated_at"
  >,
  directAnswer?: string | null,
): string {
  const sourceName = asset.source_name || asset.attribution_name || "an independent source";
  const updated = monthYear(asset.source_updated_at);
  const assetType = asset.asset_type.charAt(0).toUpperCase() + asset.asset_type.slice(1);
  const lead = `${assetType} from ${sourceName}${updated ? `, updated ${updated}` : ""}`;
  const suffix = "Reuse rights and exact citation.";
  const summary = firstSentence(directAnswer?.trim() || asset.description);
  const budget = META_DESCRIPTION_MAX_LENGTH - lead.length - suffix.length - 4;
  return `${lead}: ${truncateAtWord(summary, budget)} ${suffix}`;
}

function firstSentence(value: string): string {
  const trimmed = value.trim().replace(/\s+/gu, " ");
  const match = trimmed.match(/^.+?[.!?](?=\s|$)/u);
  return (match ? match[0] : trimmed).replace(/[.!?]$/u, "") + ".";
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, Math.max(0, maxLength - 1));
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:]+$/u, "")}…`;
}

function monthYear(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
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
