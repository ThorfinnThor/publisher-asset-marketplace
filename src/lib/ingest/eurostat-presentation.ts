export type EurostatSample = {
  datasetCode: string;
  observationCount: number;
  selector: Record<string, string>;
  dimensions: Array<{ id: string; label: string }>;
  observations: Array<{
    value: number | string;
    status: string | null;
    coordinates: Record<string, string>;
    labels: Record<string, string>;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([, entry]) => typeof entry !== "string")) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

export function parseEurostatSample(value: string | null): EurostatSample | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.source !== "eurostat") return null;
    const datasetCode = typeof parsed.dataset_code === "string" ? parsed.dataset_code : null;
    const observationCount =
      typeof parsed.observation_count === "number" && Number.isFinite(parsed.observation_count)
        ? parsed.observation_count
        : null;
    const selector = stringMap(parsed.selector);
    const dimensions = Array.isArray(parsed.dimensions)
      ? parsed.dimensions.flatMap((dimension) => {
          if (!isRecord(dimension)) return [];
          const id = typeof dimension.id === "string" ? dimension.id : null;
          const label = typeof dimension.label === "string" ? dimension.label : null;
          return id && label ? [{ id, label }] : [];
        })
      : [];
    const observations = Array.isArray(parsed.observations)
      ? parsed.observations.flatMap((observation) => {
          if (!isRecord(observation)) return [];
          const observationValue =
            (typeof observation.value === "number" && Number.isFinite(observation.value)) ||
            typeof observation.value === "string"
              ? observation.value
              : null;
          const coordinates = stringMap(observation.coordinates);
          const labels = stringMap(observation.labels);
          const status =
            observation.status === null || typeof observation.status === "string"
              ? observation.status
              : null;
          return observationValue !== null && coordinates && labels
            ? [{ value: observationValue, status, coordinates, labels }]
            : [];
        })
      : [];
    if (
      !datasetCode ||
      observationCount === null ||
      !selector ||
      dimensions.length === 0 ||
      observations.length === 0
    ) {
      return null;
    }
    return { datasetCode, observationCount, selector, dimensions, observations };
  } catch {
    return null;
  }
}

export function isReviewedEurostatSample(sample: EurostatSample): boolean {
  return (
    /^[a-z0-9][a-z0-9_]{1,63}$/u.test(sample.datasetCode) &&
    sample.selector.lang === "en" &&
    sample.selector.geo === "EU27_2020" &&
    sample.selector.sinceTimePeriod === "2020"
  );
}

export function formatEurostatObservationValue(value: number | string): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
  }
  return value;
}
