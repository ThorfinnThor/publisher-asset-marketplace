import { normalizeSupportedLicense, type RightsEvidence } from "../rights/classify-rights";
import type { SupportedLicense } from "../rights/contracts";

const EUROSTAT_API_HOST = "ec.europa.eu";
const EUROSTAT_API_PATH = "/eurostat/api/dissemination/statistics/1.0/data/";
const EUROSTAT_BROWSER_PATH = "/eurostat/databrowser/view/";
export const EUROSTAT_POLICY_URL = "https://ec.europa.eu/eurostat/help/copyright-notice";
const EUROSTAT_API_DOCS_URL =
  "https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started";
const DEFAULT_USER_AGENT =
  "publisher-asset-marketplace/0.1 (Eurostat source ingestion; contact: maintainers)";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DATASET_PATTERN = /^[a-z0-9][a-z0-9_]{1,63}$/;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_OBSERVATIONS = 50;
const MAX_ATTEMPTS = 3;
const MAX_CONCURRENCY = 3;

export type EurostatSelector = {
  lang: "en";
  geo: "EU27_2020";
  sinceTimePeriod: "2020";
};

export type EurostatPilotDataset = {
  code: string;
  subject: string;
  selector: EurostatSelector;
};

export const EUROSTAT_PILOT_DATASETS: readonly EurostatPilotDataset[] = [
  {
    code: "tps00001",
    subject: "Population on 1 January",
    selector: { lang: "en", geo: "EU27_2020", sinceTimePeriod: "2020" },
  },
  {
    code: "nama_10_gdp",
    subject: "Gross domestic product and main components",
    selector: { lang: "en", geo: "EU27_2020", sinceTimePeriod: "2020" },
  },
  {
    code: "une_rt_a",
    subject: "Unemployment by sex and age",
    selector: { lang: "en", geo: "EU27_2020", sinceTimePeriod: "2020" },
  },
];

export type EurostatSourceUrls = {
  canonicalUrl: string;
  apiUrl: string;
  previewUrl: null;
  embedUrl: null;
  selector: EurostatSelector;
};

export type EurostatObservation = {
  flatIndex: number;
  value: number | string;
  status: string | null;
  coordinates: Record<string, string>;
  labels: Record<string, string>;
};

export type EurostatDimensionSummary = {
  id: string;
  label: string;
  codes: string[];
  labels: Record<string, string>;
};

export type EurostatNormalizedAsset = {
  externalId: string;
  title: string;
  description: string;
  citationText: string;
  sourceUpdatedAt: string;
  canonicalUrl: string;
  embedUrl: null;
  previewUrl: null;
  assetType: "dataset";
  licenseCode: SupportedLicense | null;
  attributionName: "Eurostat";
  attributionUrl: string;
};

export type EurostatAssetFetch = {
  datasetCode: string;
  urls: EurostatSourceUrls;
  title: string;
  updated: string;
  dimensions: EurostatDimensionSummary[];
  observations: EurostatObservation[];
  observationCount: number;
  policyFingerprint: string;
  normalized: EurostatNormalizedAsset;
  rightsEvidence: RightsEvidence;
};

export type EurostatEndpoint = "dataset";

export type EurostatSourceErrorDetails = {
  datasetCode: string;
  endpoint: EurostatEndpoint;
  code: string;
  message: string;
  status?: number;
  attempts: number;
};

export class EurostatSourceClientError extends Error {
  readonly details: EurostatSourceErrorDetails;

  constructor(details: EurostatSourceErrorDetails, cause?: unknown) {
    super(details.message, { cause });
    this.name = "EurostatSourceClientError";
    this.details = details;
  }
}

export type EurostatBatchFailure = {
  datasetCode: string;
  error: EurostatSourceErrorDetails;
};

export type EurostatBatchResult = {
  successful: EurostatAssetFetch[];
  failed: EurostatBatchFailure[];
};

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type EurostatSourceClientOptions = {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  maxAttempts?: number;
  concurrency?: number;
  maxResponseBytes?: number;
  userAgent?: string;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (event: EurostatLogEvent) => void;
};

export type EurostatLogEvent = {
  level: "warn" | "error";
  event: "retry" | "request_failed";
  datasetCode: string;
  endpoint: EurostatEndpoint;
  attempt: number;
  status?: number;
  code?: string;
  message: string;
};

type JsonStatDataset = {
  class: unknown;
  label: unknown;
  updated: unknown;
  id: unknown;
  size: unknown;
  dimension: unknown;
  value: unknown;
  status?: unknown;
};

type JsonStatDimension = {
  label: unknown;
  category: unknown;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeDatasetCode(value: string): string {
  const code = value.trim().toLocaleLowerCase("en");
  if (!DATASET_PATTERN.test(code)) {
    throw new Error(`invalid Eurostat dataset code: ${value}`);
  }
  return code;
}

function normalizeSelector(selector: EurostatSelector): EurostatSelector {
  if (
    selector.lang !== "en" ||
    selector.geo !== "EU27_2020" ||
    selector.sinceTimePeriod !== "2020"
  ) {
    throw new Error("Eurostat selector is not in the reviewed pilot allowlist");
  }
  return { lang: "en", geo: "EU27_2020", sinceTimePeriod: "2020" };
}

function selectorQuery(selector: EurostatSelector): string {
  const normalized = normalizeSelector(selector);
  const query = new URLSearchParams();
  query.set("lang", normalized.lang);
  query.set("geo", normalized.geo);
  query.set("sinceTimePeriod", normalized.sinceTimePeriod);
  return query.toString();
}

export function reviewedEurostatPilot(code: string): EurostatPilotDataset | undefined {
  const normalized = normalizeDatasetCode(code);
  return EUROSTAT_PILOT_DATASETS.find((dataset) => dataset.code === normalized);
}

export function buildEurostatSourceUrls(
  input: string,
  selector: EurostatSelector = EUROSTAT_PILOT_DATASETS[0].selector,
): EurostatSourceUrls {
  const datasetCode = normalizeDatasetCode(input);
  const reviewed = reviewedEurostatPilot(datasetCode);
  if (!reviewed) {
    throw new Error(`Eurostat dataset is not in the reviewed pilot manifest: ${datasetCode}`);
  }
  const normalizedSelector = normalizeSelector(selector);
  const encodedCode = encodeURIComponent(datasetCode);
  const query = selectorQuery(normalizedSelector);
  return {
    canonicalUrl: `https://${EUROSTAT_API_HOST}${EUROSTAT_BROWSER_PATH}${encodedCode}/default/table?lang=en`,
    apiUrl: `https://${EUROSTAT_API_HOST}${EUROSTAT_API_PATH}${encodedCode}?${query}`,
    previewUrl: null,
    embedUrl: null,
    selector: normalizedSelector,
  };
}

function policyFingerprint(): string {
  return `${EUROSTAT_POLICY_URL}|commercial-reuse-item-review|no-embed-v1`;
}

function createError(
  datasetCode: string,
  code: string,
  message: string,
  attempts = 0,
  status?: number,
  cause?: unknown,
): EurostatSourceClientError {
  return new EurostatSourceClientError(
    { datasetCode, endpoint: "dataset", code, message, status, attempts },
    cause,
  );
}

function categoryCodes(category: Record<string, unknown>): string[] {
  const index = category.index;
  if (Array.isArray(index)) {
    const codes = index.filter((value): value is string => typeof value === "string");
    if (codes.length !== index.length) throw new Error("JSON-stat category index is malformed");
    return codes;
  }
  const indexRecord = readRecord(index);
  if (!indexRecord) throw new Error("JSON-stat category index is missing");
  return Object.entries(indexRecord)
    .filter(([, position]) => typeof position === "number" && Number.isInteger(position))
    .sort(([, left], [, right]) => (left as number) - (right as number))
    .map(([code]) => code);
}

function categoryLabels(category: Record<string, unknown>): Record<string, string> {
  const labels = readRecord(category.label);
  if (!labels) return {};
  return Object.fromEntries(
    Object.entries(labels).filter(([, label]) => typeof label === "string"),
  ) as Record<string, string>;
}

function dimensionSummaries(value: unknown, datasetCode: string): EurostatDimensionSummary[] {
  const dimension = readRecord(value);
  if (!dimension)
    throw createError(datasetCode, "invalid_shape", "JSON-stat dimensions are missing");
  return Object.entries(dimension).map(([id, rawDimension]) => {
    const parsed = readRecord(rawDimension) as JsonStatDimension | null;
    const category = parsed ? readRecord(parsed.category) : null;
    const label = parsed ? readString(parsed.label) : undefined;
    if (!parsed || !category || !label) {
      throw createError(datasetCode, "invalid_shape", `JSON-stat dimension ${id} is malformed`);
    }
    const codes = categoryCodes(category);
    if (codes.length === 0) {
      throw createError(datasetCode, "invalid_shape", `JSON-stat dimension ${id} is empty`);
    }
    return { id, label, codes, labels: categoryLabels(category) };
  });
}

function valueEntries(value: unknown, datasetCode: string): Array<[number, unknown]> {
  if (Array.isArray(value)) return value.map((entry, index) => [index, entry]);
  const record = readRecord(value);
  if (!record) throw createError(datasetCode, "invalid_shape", "JSON-stat values are malformed");
  return Object.entries(record)
    .map(([index, entry]) => [Number(index), entry] as [number, unknown])
    .filter(([index]) => Number.isInteger(index) && index >= 0)
    .sort(([left], [right]) => left - right);
}

function flatCoordinates(
  flatIndex: number,
  dimensions: EurostatDimensionSummary[],
  sizes: number[],
) {
  const positions = new Array<number>(dimensions.length).fill(0);
  let remainder = flatIndex;
  for (let index = dimensions.length - 1; index >= 0; index -= 1) {
    positions[index] = remainder % sizes[index];
    remainder = Math.floor(remainder / sizes[index]);
  }
  return Object.fromEntries(
    dimensions.map((dimension, index) => [dimension.id, dimension.codes[positions[index]]]),
  ) as Record<string, string>;
}

function statusAt(value: unknown, flatIndex: number): string | null {
  if (Array.isArray(value)) {
    const status = value[flatIndex];
    return typeof status === "string" ? status : null;
  }
  const record = readRecord(value);
  const status = record?.[String(flatIndex)];
  return typeof status === "string" ? status : null;
}

function parseJsonStat(
  datasetCode: string,
  value: unknown,
): Omit<EurostatAssetFetch, "urls" | "normalized" | "rightsEvidence"> {
  const record = readRecord(value) as JsonStatDataset | null;
  if (!record || record.class !== "dataset") {
    throw createError(datasetCode, "invalid_shape", "Eurostat response is not a JSON-stat dataset");
  }
  const title = readString(record.label);
  const updated = readString(record.updated);
  const ids = Array.isArray(record.id)
    ? record.id.filter((id): id is string => typeof id === "string")
    : [];
  const sizes = Array.isArray(record.size)
    ? record.size.filter(
        (size): size is number => typeof size === "number" && Number.isInteger(size),
      )
    : [];
  if (
    !title ||
    !updated ||
    Number.isNaN(Date.parse(updated)) ||
    ids.length === 0 ||
    ids.length !== sizes.length
  ) {
    throw createError(datasetCode, "invalid_shape", "Eurostat JSON-stat metadata is incomplete");
  }
  if (sizes.some((size) => size <= 0)) {
    throw createError(datasetCode, "invalid_shape", "Eurostat JSON-stat dimension size is invalid");
  }
  const dimensions = dimensionSummaries(record.dimension, datasetCode);
  if (
    dimensions.length !== ids.length ||
    dimensions.some((dimension, index) => dimension.id !== ids[index])
  ) {
    throw createError(
      datasetCode,
      "invalid_shape",
      "Eurostat JSON-stat dimension order is invalid",
    );
  }
  const totalSize = sizes.reduce((total, size) => total * size, 1);
  if (!Number.isSafeInteger(totalSize)) {
    throw createError(
      datasetCode,
      "invalid_shape",
      "Eurostat JSON-stat dimension size is too large",
    );
  }
  const entries = valueEntries(record.value, datasetCode);
  const observations: EurostatObservation[] = [];
  for (const [flatIndex, rawValue] of entries) {
    if (flatIndex >= totalSize || rawValue === null || rawValue === undefined) continue;
    const valueIsNumber = typeof rawValue === "number" && Number.isFinite(rawValue);
    const valueIsString = typeof rawValue === "string" && rawValue.trim() !== "";
    if (!valueIsNumber && !valueIsString) {
      throw createError(datasetCode, "invalid_shape", "Eurostat observation value is malformed");
    }
    const coordinates = flatCoordinates(flatIndex, dimensions, sizes);
    observations.push({
      flatIndex,
      value: rawValue as number | string,
      status: statusAt(record.status, flatIndex),
      coordinates,
      labels: Object.fromEntries(
        dimensions.map((dimension) => [
          dimension.id,
          dimension.labels[coordinates[dimension.id]] ?? coordinates[dimension.id],
        ]),
      ) as Record<string, string>,
    });
    if (observations.length >= MAX_OBSERVATIONS) break;
  }
  if (observations.length === 0) {
    throw createError(datasetCode, "empty_data", "Eurostat dataset contains no observations");
  }
  return {
    datasetCode,
    title,
    updated,
    dimensions,
    observations,
    observationCount: entries.filter(([, entry]) => entry !== null && entry !== undefined).length,
    policyFingerprint: policyFingerprint(),
  };
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error("response_too_large");
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("response_too_large");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("response_too_large");
      }
      chunks.push(decoder.decode(next.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "request failed";
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof EurostatSourceClientError)) return true;
  if (error.details.status !== undefined) return RETRYABLE_STATUSES.has(error.details.status);
  return error.details.code === "network_error" || error.details.code === "timeout";
}

export class EurostatSourceClient {
  private readonly fetchImpl: FetchImpl;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly concurrency: number;
  private readonly maxResponseBytes: number;
  private readonly userAgent: string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly logger: (event: EurostatLogEvent) => void;
  private availableSlots: number;
  private readonly slotWaiters: Array<() => void> = [];

  constructor(options: EurostatSourceClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
    this.maxAttempts = Math.min(MAX_ATTEMPTS, Math.max(1, options.maxAttempts ?? MAX_ATTEMPTS));
    this.concurrency = Math.min(
      MAX_CONCURRENCY,
      Math.max(1, Math.floor(options.concurrency ?? MAX_CONCURRENCY)),
    );
    this.maxResponseBytes = Math.min(
      MAX_RESPONSE_BYTES,
      Math.max(1, options.maxResponseBytes ?? MAX_RESPONSE_BYTES),
    );
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.sleep = options.sleep ?? defaultSleep;
    this.logger = options.logger ?? ((event) => console.warn(JSON.stringify(event)));
    this.availableSlots = this.concurrency;
  }

  async fetchAsset(input: string, selector?: EurostatSelector): Promise<EurostatAssetFetch> {
    const datasetCode = normalizeDatasetCode(input);
    const reviewed = reviewedEurostatPilot(datasetCode);
    if (!reviewed)
      throw new Error(`Eurostat dataset is not in the reviewed pilot manifest: ${datasetCode}`);
    const urls = buildEurostatSourceUrls(datasetCode, selector ?? reviewed.selector);
    const response = await this.fetchJson(datasetCode, urls.apiUrl);
    const parsed = parseJsonStat(datasetCode, response);
    const citationText = `Eurostat: ${parsed.title} (${datasetCode}), accessed ${new Date().toISOString().slice(0, 10)}.`;
    const rightsEvidence: RightsEvidence = {
      chart_owner: "third_party",
      chart_license_code: normalizeSupportedLicense(null),
      chart_license_raw: "Eurostat general reuse policy; item-level exceptions apply",
      chart_license_url: EUROSTAT_POLICY_URL,
      chart_license_explicit: false,
      manual_review_completed: false,
      embed_available: null,
      citation_only_allowed: true,
      chart_reuse_prohibited: null,
      evidence_conflict: false,
      citation_available: true,
      indicator_evidence: [
        {
          indicator_url: urls.apiUrl,
          non_redistributable: null,
          origins: [{ license_code: null, license_raw: null, license_url: EUROSTAT_POLICY_URL }],
        },
      ],
      evidence_url: urls.canonicalUrl,
      evidence_checked_at: null,
    };
    const description = `Eurostat dataset ${datasetCode}; ${parsed.title}; updated ${parsed.updated}.`;
    return {
      ...parsed,
      urls,
      normalized: {
        externalId: datasetCode,
        title: parsed.title,
        description,
        citationText,
        sourceUpdatedAt: parsed.updated,
        canonicalUrl: urls.canonicalUrl,
        embedUrl: null,
        previewUrl: null,
        assetType: "dataset",
        licenseCode: null,
        attributionName: "Eurostat",
        attributionUrl: urls.canonicalUrl,
      },
      rightsEvidence,
    };
  }

  async fetchAssets(datasetCodes: string[]): Promise<EurostatBatchResult> {
    const successful: EurostatAssetFetch[] = [];
    const failed: EurostatBatchFailure[] = [];
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < datasetCodes.length) {
        const index = nextIndex;
        nextIndex += 1;
        const datasetCode = datasetCodes[index];
        try {
          successful.push(await this.fetchAsset(datasetCode));
        } catch (error) {
          const details =
            error instanceof EurostatSourceClientError
              ? error.details
              : {
                  datasetCode,
                  endpoint: "dataset" as const,
                  code: "unexpected_error",
                  message: toErrorMessage(error),
                  attempts: 1,
                };
          failed.push({ datasetCode, error: details });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, datasetCodes.length) }, () => worker()),
    );
    successful.sort((left, right) => left.datasetCode.localeCompare(right.datasetCode));
    failed.sort((left, right) => left.datasetCode.localeCompare(right.datasetCode));
    return { successful, failed };
  }

  private async fetchJson(datasetCode: string, url: string): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const controller = new AbortController();
        await this.acquireSlot();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await this.fetchImpl(url, {
            headers: { accept: "application/json", "user-agent": this.userAgent },
            signal: controller.signal,
          });
          if (!response.ok) {
            throw createError(
              datasetCode,
              `http_${response.status}`,
              `Eurostat dataset request returned HTTP ${response.status}`,
              attempt,
              response.status,
            );
          }
          const body = await readBoundedText(response, this.maxResponseBytes);
          try {
            return JSON.parse(body) as unknown;
          } catch (error) {
            throw createError(
              datasetCode,
              "invalid_json",
              "Eurostat dataset response was not valid JSON",
              attempt,
              undefined,
              error,
            );
          }
        } finally {
          clearTimeout(timeout);
          this.releaseSlot();
        }
      } catch (error) {
        lastError = error;
        const details =
          error instanceof EurostatSourceClientError
            ? error.details
            : {
                datasetCode,
                endpoint: "dataset" as const,
                code:
                  error instanceof DOMException && error.name === "AbortError"
                    ? "timeout"
                    : error instanceof Error && error.message === "response_too_large"
                      ? "response_too_large"
                      : "network_error",
                message: toErrorMessage(error),
                attempts: attempt,
              };
        const retryable = isRetryableError(error) && details.code !== "response_too_large";
        if (!retryable || attempt >= this.maxAttempts) {
          this.logger({
            level: "error",
            event: "request_failed",
            datasetCode,
            endpoint: "dataset",
            attempt,
            status: details.status,
            code: details.code,
            message: details.message,
          });
          throw new EurostatSourceClientError({ ...details, attempts: attempt }, error);
        }
        const delay = Math.min(2_000, 250 * 2 ** (attempt - 1));
        this.logger({
          level: "warn",
          event: "retry",
          datasetCode,
          endpoint: "dataset",
          attempt,
          status: details.status,
          code: details.code,
          message: `${details.message}; retrying in ${delay}ms`,
        });
        await this.sleep(delay);
      }
    }
    throw lastError;
  }

  private acquireSlot(): Promise<void> {
    if (this.availableSlots > 0) {
      this.availableSlots -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.slotWaiters.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.slotWaiters.shift();
    if (next) next();
    else this.availableSlots += 1;
  }
}

export const EUROSTAT_API_DOCUMENTATION_URL = EUROSTAT_API_DOCS_URL;
