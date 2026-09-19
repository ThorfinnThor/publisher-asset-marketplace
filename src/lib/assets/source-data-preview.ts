export type PreviewColumn = { id: string; label: string };
export type PreviewRow = { cells: string[]; value: string; flag?: string };

export type SourcePreview = {
  source: "eurostat" | "worldbank";
  label: string;
  columns: PreviewColumn[];
  rows: PreviewRow[];
  note: string;
};

export type SourcePreviewSource = SourcePreview["source"];

export function parseSourcePreviewSource(metadataJson: string | null): SourcePreviewSource | null {
  if (!metadataJson) return null;
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (!isRecord(parsed) || (parsed.source !== "eurostat" && parsed.source !== "worldbank")) {
      return null;
    }
    return parsed.source;
  } catch {
    return null;
  }
}

export function parseSourcePreview(metadataJson: string | null): SourcePreview | null {
  if (!metadataJson) return null;
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (!isRecord(parsed) || (parsed.source !== "eurostat" && parsed.source !== "worldbank")) {
      return null;
    }
    return parsed.source === "eurostat"
      ? parseEurostatPreview(parsed)
      : parseWorldBankPreview(parsed);
  } catch {
    return null;
  }
}

function parseEurostatPreview(parsed: Record<string, unknown>): SourcePreview | null {
  const datasetCode = typeof parsed.dataset_code === "string" ? parsed.dataset_code : null;
  const dimensions = Array.isArray(parsed.dimensions)
    ? parsed.dimensions.flatMap((dimension) => {
        if (!isRecord(dimension)) return [];
        const id = typeof dimension.id === "string" ? dimension.id : null;
        const label = typeof dimension.label === "string" ? dimension.label : null;
        return id && label ? [{ id, label }] : [];
      })
    : [];
  const observations = Array.isArray(parsed.observations) ? parsed.observations : [];
  if (!datasetCode || dimensions.length === 0 || observations.length === 0) return null;

  const rows = observations.flatMap((observation) => {
    if (!isRecord(observation)) return [];
    const labels = isStringMap(observation.labels) ? observation.labels : {};
    const coordinates = isStringMap(observation.coordinates) ? observation.coordinates : {};
    const value = formatValue(observation.value);
    if (!value) return [];
    return [
      {
        cells: dimensions.map(
          (dimension) => labels[dimension.id] ?? coordinates[dimension.id] ?? "",
        ),
        value,
        flag: typeof observation.status === "string" ? observation.status : undefined,
      },
    ];
  });
  if (rows.length === 0) return null;

  return {
    source: "eurostat",
    label: datasetCode,
    columns: dimensions,
    rows,
    note: "Reviewed Eurostat observations; customised presentation, not an official Eurostat embed.",
  };
}

function parseWorldBankPreview(parsed: Record<string, unknown>): SourcePreview | null {
  const indicator = typeof parsed.indicator === "string" ? parsed.indicator : "World Bank";
  const rowsValue = Array.isArray(parsed.rows) ? parsed.rows : [];
  const rows = rowsValue.flatMap((row) => {
    if (!isRecord(row)) return [];
    const country = isRecord(row.country) ? row.country : {};
    const countryLabel = stringValue(country.value) ?? stringValue(row.countryiso3code) ?? "";
    const date = stringValue(row.date) ?? "";
    const value = formatValue(row.value);
    if (!value) return [];
    return [{ cells: [date, countryLabel], value, flag: stringValue(row.obs_status) ?? undefined }];
  });
  if (rows.length === 0) return null;

  return {
    source: "worldbank",
    label: indicator,
    columns: [
      { id: "date", label: "Date" },
      { id: "country", label: "Country" },
    ],
    rows,
    note: "Reviewed World Bank observations; citation-only data preview, not an official embed.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function formatValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
  }
  return stringValue(value);
}
