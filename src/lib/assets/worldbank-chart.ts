const INDICATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PREFERRED_COUNTRIES = ["USA", "DEU", "CHN", "IND", "BRA", "ZAF", "JPN", "AUS"];
const MAX_POINTS = 8;

export type WorldBankChartPoint = {
  country: string;
  iso3: string;
  date: string;
  value: number;
};

export function parseWorldBankIndicator(
  metadataJson: string | null,
  canonicalUrl: string,
): string | null {
  const metadata = parseRecord(metadataJson);
  const metadataIndicator = readString(metadata?.indicator)?.toUpperCase();
  if (metadataIndicator && INDICATOR_PATTERN.test(metadataIndicator)) return metadataIndicator;

  try {
    const url = new URL(canonicalUrl);
    if (url.hostname !== "data.worldbank.org") return null;
    const match = url.pathname.match(/^\/indicator\/([^/]+)\/?$/i);
    const indicator = match ? decodeURIComponent(match[1]).toUpperCase() : null;
    return indicator && INDICATOR_PATTERN.test(indicator) ? indicator : null;
  } catch {
    return null;
  }
}

export function parseWorldBankMetadataPoints(metadataJson: string | null): WorldBankChartPoint[] {
  const metadata = parseRecord(metadataJson);
  if (!metadata || metadata.source !== "worldbank" || !Array.isArray(metadata.rows)) return [];
  return selectPoints(metadata.rows);
}

export function parseWorldBankApiPoints(value: unknown): WorldBankChartPoint[] {
  if (!Array.isArray(value) || value.length < 2 || !Array.isArray(value[1])) return [];
  return selectPoints(value[1]);
}

export function parseWorldBankPreviewPoints(value: unknown): WorldBankChartPoint[] {
  if (!isRecord(value) || !Array.isArray(value.points)) return [];
  return value.points
    .flatMap((point) => {
      if (!isRecord(point) || typeof point.value !== "number" || !Number.isFinite(point.value)) {
        return [];
      }
      const country = readString(point.country);
      const iso3 = readString(point.iso3)?.toUpperCase();
      const date = readString(point.date);
      if (!country || !iso3 || !date || !/^[A-Z0-9]{3}$/.test(iso3)) return [];
      return [{ country, iso3, date, value: point.value }];
    })
    .slice(0, MAX_POINTS);
}

function selectPoints(rows: unknown[]): WorldBankChartPoint[] {
  const parsed = rows.flatMap((row) => {
    if (!isRecord(row) || typeof row.value !== "number" || !Number.isFinite(row.value)) return [];
    const countryRecord = isRecord(row.country) ? row.country : null;
    const country = readString(countryRecord?.value);
    const iso3 = readString(row.countryiso3code)?.toUpperCase();
    const date = readString(row.date);
    if (!country || !iso3 || !date || !/^[A-Z0-9]{3}$/.test(iso3)) return [];
    return [{ country, iso3, date, value: row.value }];
  });

  const latestByCountry = new Map<string, WorldBankChartPoint>();
  for (const point of parsed) {
    const current = latestByCountry.get(point.iso3);
    if (!current || point.date.localeCompare(current.date) > 0)
      latestByCountry.set(point.iso3, point);
  }

  const preferred = PREFERRED_COUNTRIES.flatMap((iso3) => {
    const point = latestByCountry.get(iso3);
    return point ? [point] : [];
  });
  const fallback = [...latestByCountry.values()]
    .filter((point) => !PREFERRED_COUNTRIES.includes(point.iso3))
    .sort((left, right) => left.country.localeCompare(right.country));
  return [...preferred, ...fallback].slice(0, MAX_POINTS);
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
