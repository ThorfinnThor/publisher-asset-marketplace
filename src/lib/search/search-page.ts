import type { SearchRequest } from "./ranking-contract";

export const assetTypeOptions = [
  { value: "chart", label: "Charts" },
  { value: "calculator", label: "Calculators" },
  { value: "table", label: "Tables" },
  { value: "dataset", label: "Datasets" },
  { value: "benchmark", label: "Benchmarks" },
] as const;

export type SearchSourceOption = { value: string; label: string; count?: number };

export const sourceOptions: SearchSourceOption[] = [
  { value: "source_owid", label: "Our World in Data" },
  { value: "source_worldbank", label: "World Bank Open Data" },
  { value: "source_eurostat", label: "Eurostat" },
];

export const freshnessOptions = [
  { value: "any", label: "Any time" },
  { value: "365", label: "Past 12 months" },
  { value: "1095", label: "Past 3 years" },
] as const;

export type SearchPageParam = string | string[] | undefined;

export type SearchPageParams = {
  q?: SearchPageParam;
  type?: SearchPageParam;
  source?: SearchPageParam;
  rights?: SearchPageParam;
  freshness?: SearchPageParam;
  cursor?: SearchPageParam;
};

export type ParsedSearchPage = {
  query: string;
  selectedAssetTypes: string[];
  selectedSource: string;
  selectedRights: Array<"safe" | "restricted">;
  selectedFreshness: string;
  request: SearchRequest;
};

function values(value: SearchPageParam): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function first(value: SearchPageParam): string {
  return values(value)[0] ?? "";
}

function isAssetType(value: string): boolean {
  return assetTypeOptions.some((option) => option.value === value);
}

function isSourceForOptions(value: string, options: readonly SearchSourceOption[]): boolean {
  return options.some((option) => option.value === value);
}

function isRights(value: string): value is "safe" | "restricted" {
  return value === "safe" || value === "restricted";
}

export function freshnessDate(value: string, now = new Date()): string | undefined {
  if (value !== "365" && value !== "1095") return undefined;
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - Number(value));
  return date.toISOString();
}

export function parseSearchPageParams(
  params: SearchPageParams,
  now = new Date(),
  availableSources: readonly SearchSourceOption[] = sourceOptions,
): ParsedSearchPage {
  const query = first(params.q).trim();
  const selectedAssetTypes = values(params.type).filter(isAssetType);
  const selectedSource =
    values(params.source).find((value) => isSourceForOptions(value, availableSources)) ?? "";
  const selectedRights = values(params.rights).filter(isRights);
  const requestedFreshness = first(params.freshness);
  const selectedFreshness = freshnessOptions.some((option) => option.value === requestedFreshness)
    ? requestedFreshness
    : "any";
  const updatedSince = freshnessDate(selectedFreshness, now);

  const request: SearchRequest = {
    query,
    filters: {
      ...(selectedAssetTypes.length > 0 ? { asset_types: selectedAssetTypes } : {}),
      ...(selectedSource ? { source_ids: [selectedSource] } : {}),
      ...(selectedRights.length > 0 ? { rights_statuses: selectedRights } : {}),
      ...(updatedSince ? { updated_since: updatedSince } : {}),
    },
    limit: 24,
    ...(first(params.cursor) ? { cursor: first(params.cursor) } : {}),
  };

  return {
    query,
    selectedAssetTypes,
    selectedSource,
    selectedRights,
    selectedFreshness,
    request,
  };
}
