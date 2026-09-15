import type { SupportedLicense } from "./contracts";

const OWID_ORIGIN = "https://ourworldindata.org";
const CREATIVE_COMMONS_HOST = "creativecommons.org";

export type OwidChartRightsProof = {
  canonical_url: string;
  chart_owner: "owid";
  chart_license_code: SupportedLicense;
  chart_license_raw: string;
  chart_license_url: string;
  copyright_notice: string;
  credit_text: string | null;
};

export type OwidChartRightsParseResult =
  { ok: true; proof: OwidChartRightsProof } | { ok: false; reason: string };

type LicenseMatch = {
  code: SupportedLicense;
  label: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizedOfficialUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== OWID_ORIGIN) {
      return null;
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    return url;
  } catch {
    return null;
  }
}

export function isOwidChartCanonicalUrl(value: string): boolean {
  const url = normalizedOfficialUrl(value);
  return Boolean(url && /^\/grapher\/[a-z0-9][a-z0-9-]*$/.test(url.pathname));
}

function licenseFromUrl(value: string): LicenseMatch | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== CREATIVE_COMMONS_HOST) {
    return null;
  }

  const normalizedPath = url.pathname.toLocaleLowerCase("en").replace(/\/$/, "");
  const creativeCommonsLicenses: Record<string, LicenseMatch> = {
    "/licenses/by/4.0": { code: "CC_BY", label: "CC BY 4.0" },
    "/licenses/by-sa/4.0": { code: "CC_BY_SA", label: "CC BY-SA 4.0" },
    "/licenses/by-nd/4.0": { code: "CC_BY_ND", label: "CC BY-ND 4.0" },
    "/licenses/by-nc/4.0": { code: "CC_BY_NC", label: "CC BY-NC 4.0" },
    "/licenses/by-nc-sa/4.0": { code: "CC_BY_NC_SA", label: "CC BY-NC-SA 4.0" },
    "/licenses/by-nc-nd/4.0": { code: "CC_BY_NC_ND", label: "CC BY-NC-ND 4.0" },
    "/publicdomain/zero/1.0": { code: "CC0_1_0", label: "CC0 1.0" },
    "/publicdomain/mark/1.0": { code: "PUBLIC_DOMAIN", label: "Public Domain Mark 1.0" },
  };
  return creativeCommonsLicenses[normalizedPath] ?? null;
}

function jsonLdBlocks(html: string): unknown[] {
  const values: unknown[] = [];
  const pattern = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      values.push(JSON.parse(match[1] ?? ""));
    } catch {
      // Ignore unrelated malformed JSON-LD and fail closed if no valid chart proof remains.
    }
  }
  return values;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }
  if (!isRecord(value)) {
    return [];
  }
  const graph = value["@graph"];
  return graph === undefined ? [value] : [value, ...flattenJsonLd(graph)];
}

export function parseOwidChartRightsPage(
  html: string,
  expectedCanonicalUrl: string,
): OwidChartRightsParseResult {
  const expectedUrl = normalizedOfficialUrl(expectedCanonicalUrl);
  if (!expectedUrl || !isOwidChartCanonicalUrl(expectedCanonicalUrl)) {
    return { ok: false, reason: "invalid_canonical_url" };
  }

  const pages = jsonLdBlocks(html)
    .flatMap(flattenJsonLd)
    .filter((entry) => entry["@type"] === "WebPage");
  if (pages.length === 0) {
    return { ok: false, reason: "missing_webpage_jsonld" };
  }

  for (const page of pages) {
    const pageUrl = normalizedOfficialUrl(asString(page.url) ?? "");
    if (!pageUrl || pageUrl.toString() !== expectedUrl.toString()) {
      continue;
    }
    const image = Array.isArray(page.image) ? page.image.find(isRecord) : page.image;
    if (!isRecord(image) || image["@type"] !== "ImageObject") {
      continue;
    }
    const creator = isRecord(image.creator) ? image.creator : null;
    const creatorUrl = normalizedOfficialUrl(asString(creator?.url) ?? "");
    if (
      creator?.["@type"] !== "Organization" ||
      asString(creator.name) !== "Our World in Data" ||
      creatorUrl?.origin !== OWID_ORIGIN
    ) {
      continue;
    }
    if (asString(image.copyrightNotice) !== "Our World in Data") {
      continue;
    }
    const contentUrl = normalizedOfficialUrl(asString(image.contentUrl) ?? "");
    if (!contentUrl || contentUrl.pathname !== `${expectedUrl.pathname}.png`) {
      continue;
    }
    const licenseUrl = asString(image.license);
    if (!licenseUrl) {
      return { ok: false, reason: "unsupported_or_missing_chart_license" };
    }
    const license = licenseFromUrl(licenseUrl);
    if (!license) {
      return { ok: false, reason: "unsupported_or_missing_chart_license" };
    }

    return {
      ok: true,
      proof: {
        canonical_url: expectedUrl.toString(),
        chart_owner: "owid",
        chart_license_code: license.code,
        chart_license_raw: license.label,
        chart_license_url: licenseUrl,
        copyright_notice: "Our World in Data",
        credit_text: asString(image.creditText),
      },
    };
  }

  return { ok: false, reason: "asset_specific_ownership_proof_not_found" };
}
