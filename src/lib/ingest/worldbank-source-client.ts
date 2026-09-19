import {
  normalizeSupportedLicense,
  type IndicatorRightsEvidence,
  type RightsEvidence,
} from "../rights/classify-rights";
import type { SupportedLicense } from "../rights/contracts";

const WORLD_BANK_API_HOST = "api.worldbank.org";
const WORLD_BANK_WEB_HOST = "data.worldbank.org";
const WORLD_BANK_POLICY_URL = "https://data.worldbank.org/summary-terms-of-use";
const DEFAULT_USER_AGENT =
  "publisher-asset-marketplace/0.1 (World Bank source ingestion; contact: maintainers)";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const INDICATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_ROWS = 25;

export type WorldBankSourceUrls = {
  canonicalUrl: string;
  apiUrl: string;
  previewUrl: string;
};

export type WorldBankApiRow = {
  indicator?: { id?: unknown; value?: unknown };
  country?: { id?: unknown; value?: unknown };
  countryiso3code?: unknown;
  date?: unknown;
  value?: unknown;
  obs_status?: unknown;
  unit?: unknown;
  decimal?: unknown;
  license?: unknown;
  license_url?: unknown;
  provider?: unknown;
  citation?: unknown;
  [key: string]: unknown;
};

export type WorldBankApiHeader = {
  page?: unknown;
  pages?: unknown;
  per_page?: unknown;
  total?: unknown;
  license?: unknown;
  license_url?: unknown;
  provider?: unknown;
  citation?: unknown;
  [key: string]: unknown;
};

export type WorldBankNormalizedAsset = {
  externalId: string;
  title: string;
  description: string;
  citationText: string;
  sourceUpdatedAt: string | null;
  canonicalUrl: string;
  embedUrl: null;
  previewUrl: null;
  assetType: "dataset";
  licenseCode: SupportedLicense | null;
  attributionName: string;
  attributionUrl: string;
};

export type WorldBankAssetFetch = {
  indicator: string;
  urls: WorldBankSourceUrls;
  header: WorldBankApiHeader;
  rows: WorldBankApiRow[];
  normalized: WorldBankNormalizedAsset;
  rightsEvidence: RightsEvidence;
  raw: {
    response: [WorldBankApiHeader, WorldBankApiRow[]];
  };
};

export type WorldBankEndpoint = "indicator";

export type WorldBankSourceErrorDetails = {
  indicator: string;
  endpoint: WorldBankEndpoint;
  code: string;
  message: string;
  status?: number;
  attempts: number;
};

export class WorldBankSourceClientError extends Error {
  readonly details: WorldBankSourceErrorDetails;

  constructor(details: WorldBankSourceErrorDetails, cause?: unknown) {
    super(details.message, { cause });
    this.name = "WorldBankSourceClientError";
    this.details = details;
  }
}

export type WorldBankBatchFailure = {
  indicator: string;
  error: WorldBankSourceErrorDetails;
};

export type WorldBankBatchResult = {
  successful: WorldBankAssetFetch[];
  failed: WorldBankBatchFailure[];
};

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type WorldBankSourceClientOptions = {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  maxAttempts?: number;
  concurrency?: number;
  userAgent?: string;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (event: WorldBankLogEvent) => void;
};

export type WorldBankLogEvent = {
  level: "warn" | "error";
  event: "retry" | "request_failed";
  indicator: string;
  endpoint: WorldBankEndpoint;
  attempt: number;
  status?: number;
  code?: string;
  message: string;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeIndicator(value: string): string {
  const indicator = value.trim().toUpperCase();
  if (!INDICATOR_PATTERN.test(indicator)) {
    throw new Error(`invalid World Bank indicator: ${value}`);
  }
  return indicator;
}

export function buildWorldBankSourceUrls(input: string): WorldBankSourceUrls {
  const indicator = normalizeIndicator(input);
  const encodedIndicator = encodeURIComponent(indicator);
  const canonicalUrl = `https://${WORLD_BANK_WEB_HOST}/indicator/${encodedIndicator}`;
  const apiUrl = `https://${WORLD_BANK_API_HOST}/v2/country/all/indicator/${encodedIndicator}?format=json&per_page=400&mrnev=1`;
  return { canonicalUrl, apiUrl, previewUrl: canonicalUrl };
}

function parseApiResponse(
  indicator: string,
  value: unknown,
): [WorldBankApiHeader, WorldBankApiRow[]] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new WorldBankSourceClientError({
      indicator,
      endpoint: "indicator",
      code: "invalid_shape",
      message: "World Bank indicator response must contain a header and row array",
      attempts: 0,
    });
  }
  const header = readRecord(value[0]);
  const rows = Array.isArray(value[1]) ? value[1].map(readRecord) : null;
  if (!header || !rows || rows.some((row) => row === null)) {
    throw new WorldBankSourceClientError({
      indicator,
      endpoint: "indicator",
      code: "invalid_shape",
      message: "World Bank indicator response contained malformed metadata or rows",
      attempts: 0,
    });
  }
  return [header as WorldBankApiHeader, rows as WorldBankApiRow[]];
}

function latestDate(rows: WorldBankApiRow[]): string | null {
  const dates = rows
    .map((row) => readString(row.date))
    .filter((value): value is string => value !== undefined)
    .sort((left, right) => right.localeCompare(left));
  return dates[0] ?? null;
}

function licenseEvidence(
  header: WorldBankApiHeader,
  rows: WorldBankApiRow[],
): { name: string | null; url: string | null; provider: string | null; citation: string | null } {
  const row = rows[0] ?? {};
  const name = readString(header.license) ?? readString(row.license) ?? null;
  const url = readString(header.license_url) ?? readString(row.license_url) ?? null;
  const provider = readString(header.provider) ?? readString(row.provider) ?? null;
  const citation = readString(header.citation) ?? readString(row.citation) ?? null;
  return { name, url, provider, citation };
}

function buildRightsEvidence(
  urls: WorldBankSourceUrls,
  header: WorldBankApiHeader,
  rows: WorldBankApiRow[],
): RightsEvidence {
  const license = licenseEvidence(header, rows);
  const indicatorEvidence: IndicatorRightsEvidence[] = [
    {
      indicator_url: urls.apiUrl,
      non_redistributable: null,
      origins: [
        {
          license_code: normalizeSupportedLicense(license.name),
          license_raw: license.name,
          license_url: license.url ?? WORLD_BANK_POLICY_URL,
        },
      ],
    },
  ];
  return {
    chart_owner: "third_party",
    chart_license_code: normalizeSupportedLicense(license.name),
    chart_license_raw: license.name,
    chart_license_url: license.url ?? WORLD_BANK_POLICY_URL,
    chart_license_explicit: license.name !== null,
    manual_review_completed: false,
    embed_available: false,
    citation_only_allowed: false,
    chart_reuse_prohibited: null,
    evidence_conflict: false,
    citation_available: true,
    indicator_evidence: indicatorEvidence,
    evidence_url: urls.canonicalUrl,
    evidence_checked_at: null,
  };
}

function normalizeAsset(
  indicator: string,
  urls: WorldBankSourceUrls,
  header: WorldBankApiHeader,
  rows: WorldBankApiRow[],
): WorldBankNormalizedAsset {
  const first = rows[0] ?? {};
  const indicatorRecord = readRecord(first.indicator);
  const title = readString(indicatorRecord?.value) ?? readString(indicatorRecord?.id) ?? indicator;
  const license = licenseEvidence(header, rows);
  const provider = license.provider ?? "World Bank Open Data";
  const citation =
    license.citation ?? `${provider}: ${title}. Data retrieved from World Bank Open Data.`;
  const latest = latestDate(rows);
  const description = latest
    ? `World Bank indicator ${indicator}; latest fetched observation: ${latest}.`
    : `World Bank indicator ${indicator}.`;
  return {
    externalId: indicator,
    title,
    description,
    citationText: citation,
    sourceUpdatedAt: latest,
    canonicalUrl: urls.canonicalUrl,
    embedUrl: null,
    previewUrl: null,
    assetType: "dataset",
    licenseCode: normalizeSupportedLicense(license.name),
    attributionName: provider,
    attributionUrl: urls.canonicalUrl,
  };
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "request failed";
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof WorldBankSourceClientError)) {
    return true;
  }
  if (error.details.status !== undefined) {
    return RETRYABLE_STATUSES.has(error.details.status);
  }
  return error.details.code === "network_error" || error.details.code === "timeout";
}

export class WorldBankSourceClient {
  private readonly fetchImpl: FetchImpl;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly concurrency: number;
  private readonly userAgent: string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly logger: (event: WorldBankLogEvent) => void;
  private availableSlots: number;
  private readonly slotWaiters: Array<() => void> = [];

  constructor(options: WorldBankSourceClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
    this.maxAttempts = Math.min(5, Math.max(1, options.maxAttempts ?? 3));
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.sleep = options.sleep ?? defaultSleep;
    this.logger = options.logger ?? ((event) => console.warn(JSON.stringify(event)));
    this.availableSlots = this.concurrency;
  }

  async fetchAsset(input: string): Promise<WorldBankAssetFetch> {
    const indicator = normalizeIndicator(input);
    const urls = buildWorldBankSourceUrls(indicator);
    const response = await this.fetchJson<unknown>(indicator, urls.apiUrl);
    const [header, rows] = parseApiResponse(indicator, response);
    if (rows.length === 0) {
      throw new WorldBankSourceClientError({
        indicator,
        endpoint: "indicator",
        code: "empty_data",
        message: "World Bank indicator response contained no observations",
        attempts: 1,
      });
    }
    const boundedRows = rows.slice(0, MAX_ROWS);
    return {
      indicator,
      urls,
      header,
      rows: boundedRows,
      normalized: normalizeAsset(indicator, urls, header, boundedRows),
      rightsEvidence: buildRightsEvidence(urls, header, boundedRows),
      raw: { response: [header, boundedRows] },
    };
  }

  async fetchAssets(indicators: string[]): Promise<WorldBankBatchResult> {
    const successful: WorldBankAssetFetch[] = [];
    const failed: WorldBankBatchFailure[] = [];
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < indicators.length) {
        const index = nextIndex;
        nextIndex += 1;
        const indicator = indicators[index];
        try {
          successful.push(await this.fetchAsset(indicator));
        } catch (error) {
          const details =
            error instanceof WorldBankSourceClientError
              ? error.details
              : {
                  indicator,
                  endpoint: "indicator" as const,
                  code: "unexpected_error",
                  message: toErrorMessage(error),
                  attempts: 1,
                };
          failed.push({ indicator, error: details });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, indicators.length) }, () => worker()),
    );
    successful.sort((left, right) => left.indicator.localeCompare(right.indicator));
    failed.sort((left, right) => left.indicator.localeCompare(right.indicator));
    return { successful, failed };
  }

  private async fetchJson<T>(indicator: string, url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const controller = new AbortController();
        let response: Response;
        await this.acquireSlot();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          response = await this.fetchImpl(url, {
            headers: {
              accept: "application/json",
              "user-agent": this.userAgent,
            },
            signal: controller.signal,
          });
        } finally {
          this.releaseSlot();
          clearTimeout(timeout);
        }
        if (!response.ok) {
          throw new WorldBankSourceClientError({
            indicator,
            endpoint: "indicator",
            code: `http_${response.status}`,
            message: `World Bank indicator request returned HTTP ${response.status}`,
            status: response.status,
            attempts: attempt,
          });
        }
        try {
          return (await response.json()) as T;
        } catch (error) {
          throw new WorldBankSourceClientError(
            {
              indicator,
              endpoint: "indicator",
              code: "invalid_json",
              message: "World Bank indicator response was not valid JSON",
              attempts: attempt,
            },
            error,
          );
        }
      } catch (error) {
        lastError = error;
        const retryable = isRetryableError(error);
        const details =
          error instanceof WorldBankSourceClientError
            ? error.details
            : {
                indicator,
                endpoint: "indicator" as const,
                code:
                  error instanceof DOMException && error.name === "AbortError"
                    ? "timeout"
                    : "network_error",
                message: toErrorMessage(error),
                attempts: attempt,
              };
        if (!retryable || attempt >= this.maxAttempts) {
          this.logger({
            level: "error",
            event: "request_failed",
            indicator,
            endpoint: "indicator",
            attempt,
            status: details.status,
            code: details.code,
            message: details.message,
          });
          throw new WorldBankSourceClientError({ ...details, attempts: attempt }, error);
        }
        const delay = Math.min(2_000, 250 * 2 ** (attempt - 1));
        this.logger({
          level: "warn",
          event: "retry",
          indicator,
          endpoint: "indicator",
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
    if (next) {
      next();
    } else {
      this.availableSlots += 1;
    }
  }
}
