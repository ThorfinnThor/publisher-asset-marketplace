const INDICATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SOURCE_PATTERN = /^[0-9]{1,6}$/;
const RIGHTS_RESTRICTION_PATTERN =
  /\b(?:all rights reserved|non-?commercial|not for redistribution|redistribution prohibited|permission required|proprietary|restricted data|copyrighted)\b/iu;

export type WorldBankCatalogEntry = {
  indicator: string;
  title: string;
  sourceId: string;
  sourceName: string;
};

export type WorldBankMetadataReview = {
  indicator: string;
  licenseRaw: "CC BY-4.0";
  licenseUrl: string;
  limitations: string | null;
};

type CatalogEnvelope = [
  { page?: unknown; pages?: unknown; total?: unknown },
  Array<{
    id?: unknown;
    name?: unknown;
    source?: { id?: unknown; value?: unknown };
  }> | null,
];

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizedIndicatorKey(indicator: string): string {
  return indicator.toLocaleUpperCase("en");
}

export function parseWorldBankCatalogPage(value: unknown): {
  page: number;
  pages: number;
  entries: WorldBankCatalogEntry[];
} {
  if (!Array.isArray(value) || value.length < 2 || !Array.isArray(value[1])) {
    throw new Error("World Bank catalogue response must contain a header and indicator array");
  }
  const [header] = value as CatalogEnvelope;
  const rawEntries = value[1] as NonNullable<CatalogEnvelope[1]>;
  const page = Number(header.page);
  const pages = Number(header.pages);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pages) || pages < page) {
    throw new Error("World Bank catalogue pagination metadata is invalid");
  }

  const entries = rawEntries.flatMap((entry) => {
    const indicator = nonEmptyString(entry.id);
    const title = nonEmptyString(entry.name);
    const sourceId = nonEmptyString(entry.source?.id);
    const sourceName = nonEmptyString(entry.source?.value);
    if (
      !indicator ||
      !title ||
      !sourceId ||
      !sourceName ||
      !INDICATOR_PATTERN.test(indicator) ||
      !SOURCE_PATTERN.test(sourceId)
    ) {
      return [];
    }
    return [{ indicator, title, sourceId, sourceName }];
  });
  return { page, pages, entries };
}

export function selectWorldBankCatalogCandidates(
  entries: readonly WorldBankCatalogEntry[],
  limit: number,
): WorldBankCatalogEntry[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = normalizedIndicatorKey(entry.indicator);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sourcePriority = new Map([
    ["2", 0],
    ["14", 1],
    ["29", 2],
    ["28", 3],
    ["86", 4],
    ["13", 5],
    ["83", 6],
    ["89", 7],
    ["3", 8],
    ["63", 9],
    ["19", 10],
    ["46", 11],
    ["58", 12],
    ["75", 13],
    ["61", 14],
    ["70", 15],
    ["43", 16],
  ]);
  return entries
    .filter((entry) => counts.get(normalizedIndicatorKey(entry.indicator)) === 1)
    .sort(
      (left, right) =>
        (sourcePriority.get(left.sourceId) ?? 100) - (sourcePriority.get(right.sourceId) ?? 100) ||
        left.indicator.localeCompare(right.indicator),
    )
    .slice(0, Math.max(0, Math.floor(limit)));
}

function metadataValues(value: unknown, indicator: string): Map<string, string> {
  if (typeof value !== "object" || value === null) {
    throw new Error("World Bank metadata response must be an object");
  }
  const sources = (value as { source?: unknown }).source;
  if (!Array.isArray(sources)) {
    throw new Error("World Bank metadata response is missing sources");
  }
  const values = new Map<string, string>();
  for (const source of sources) {
    if (typeof source !== "object" || source === null) continue;
    const concepts = (source as { concept?: unknown }).concept;
    if (!Array.isArray(concepts)) continue;
    for (const concept of concepts) {
      if (typeof concept !== "object" || concept === null) continue;
      const variables = (concept as { variable?: unknown }).variable;
      if (!Array.isArray(variables)) continue;
      for (const variable of variables) {
        if (typeof variable !== "object" || variable === null) continue;
        if (nonEmptyString((variable as { id?: unknown }).id) !== indicator) continue;
        const metatypes = (variable as { metatype?: unknown }).metatype;
        if (!Array.isArray(metatypes)) continue;
        for (const metatype of metatypes) {
          if (typeof metatype !== "object" || metatype === null) continue;
          const id = nonEmptyString((metatype as { id?: unknown }).id);
          const metadataValue = nonEmptyString((metatype as { value?: unknown }).value);
          if (id && metadataValue) values.set(id, metadataValue);
        }
      }
    }
  }
  return values;
}

export function reviewWorldBankIndicatorMetadata(
  indicator: string,
  value: unknown,
): WorldBankMetadataReview | null {
  if (!INDICATOR_PATTERN.test(indicator)) {
    throw new Error(`invalid World Bank indicator: ${indicator}`);
  }
  const values = metadataValues(value, indicator);
  const licenseRaw = values.get("License_Type")?.trim();
  const licenseUrl = values.get("License_URL")?.trim();
  const limitations = values.get("Limitationsandexceptions")?.trim() || null;
  if (licenseRaw !== "CC BY-4.0" || !licenseUrl) return null;
  const parsedLicenseUrl = new URL(licenseUrl);
  if (parsedLicenseUrl.protocol !== "https:") return null;
  if (limitations && RIGHTS_RESTRICTION_PATTERN.test(limitations)) return null;
  return { indicator, licenseRaw: "CC BY-4.0", licenseUrl, limitations };
}
