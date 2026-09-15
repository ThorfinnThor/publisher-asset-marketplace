const OWID_HOST = "ourworldindata.org";
const OWID_API_HOST = "api.ourworldindata.org";
const DEFAULT_USER_AGENT =
  "publisher-asset-marketplace/0.1 (OWID source ingestion; contact: maintainers)";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type OwidSourceUrls = {
  canonicalUrl: string;
  metadataUrl: string;
  configUrl: string;
  embedUrl: string;
  previewUrl: string;
};

export type OwidLogEvent = {
  level: "warn" | "error";
  event: "retry" | "request_failed";
  slug: string;
  endpoint: OwidEndpoint;
  attempt: number;
  status?: number;
  code?: string;
  message: string;
};

export type OwidSourceErrorDetails = {
  slug: string;
  endpoint: OwidEndpoint;
  code: string;
  message: string;
  status?: number;
  attempts: number;
};

export class OwidSourceClientError extends Error {
  readonly details: OwidSourceErrorDetails;

  constructor(details: OwidSourceErrorDetails, cause?: unknown) {
    super(details.message, { cause });
    this.name = "OwidSourceClientError";
    this.details = details;
  }
}

export type OwidMetadataDocument = {
  chart?: {
    title?: unknown;
    subtitle?: unknown;
    citation?: unknown;
    originalChartUrl?: unknown;
  };
  columns?: Record<
    string,
    {
      title?: unknown;
      shortUnit?: unknown;
      unit?: unknown;
      citationShort?: unknown;
      citationLong?: unknown;
      lastUpdated?: unknown;
      nextUpdate?: unknown;
      fullMetadata?: unknown;
      owidVariableId?: unknown;
    }
  >;
  dateDownloaded?: unknown;
  [key: string]: unknown;
};

export type OwidConfigDocument = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  originUrl?: unknown;
  dimensions?: unknown;
  selectedEntityNames?: unknown;
  [key: string]: unknown;
};

export type OwidIndicatorMetadataDocument = {
  id?: unknown;
  name?: unknown;
  processingLevel?: unknown;
  nonRedistributable?: unknown;
  origins?: Array<{
    id?: unknown;
    title?: unknown;
    producer?: unknown;
    citationFull?: unknown;
    attributionShort?: unknown;
    urlMain?: unknown;
    urlDownload?: unknown;
    dateAccessed?: unknown;
    datePublished?: unknown;
    license?: {
      name?: unknown;
      url?: unknown;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type OwidEndpoint = "metadata" | "config" | "indicator";

export type OwidIndicatorEvidence = {
  url: string;
  metadata: OwidIndicatorMetadataDocument;
};

export type OwidNormalizedAsset = {
  externalId: string | null;
  title: string;
  description: string;
  citationText: string | null;
  sourceUpdatedAt: string | null;
  canonicalUrl: string;
  embedUrl: string;
  previewUrl: string;
  assetType: "chart";
  licenseCode: null;
  sourcePolicyUrl: string;
};

export type OwidAssetFetch = {
  slug: string;
  urls: OwidSourceUrls;
  metadata: OwidMetadataDocument;
  config: OwidConfigDocument;
  indicators: OwidIndicatorEvidence[];
  normalized: OwidNormalizedAsset;
  raw: {
    metadata: OwidMetadataDocument;
    config: OwidConfigDocument;
    indicators: OwidIndicatorEvidence[];
  };
};

export type OwidBatchFailure = {
  slug: string;
  error: OwidSourceErrorDetails;
};

export type OwidBatchResult = {
  successful: OwidAssetFetch[];
  failed: OwidBatchFailure[];
};

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OwidSourceClientOptions = {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  maxAttempts?: number;
  concurrency?: number;
  userAgent?: string;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (event: OwidLogEvent) => void;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readIdentifier(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return readString(value);
}

function normalizeSlug(value: string): string {
  const slug = value.trim().toLocaleLowerCase("en");
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`invalid OWID slug: ${value}`);
  }
  return slug;
}

export function buildOwidSourceUrls(input: string): OwidSourceUrls {
  const slug = normalizeSlug(input);
  const canonicalUrl = `https://${OWID_HOST}/grapher/${slug}`;
  const embedUrl = new URL(canonicalUrl);
  embedUrl.searchParams.set("embed", "1");

  return {
    canonicalUrl,
    metadataUrl: `${canonicalUrl}.metadata.json`,
    configUrl: `${canonicalUrl}.config.json`,
    embedUrl: embedUrl.toString(),
    previewUrl: `${canonicalUrl}.png?imType=thumbnail&imWidth=640`,
  };
}

function latestDate(values: string[]): string | null {
  return values.length > 0 ? values.sort((left, right) => right.localeCompare(left))[0] : null;
}

function normalizeMetadata(
  slug: string,
  urls: OwidSourceUrls,
  metadata: OwidMetadataDocument,
  config: OwidConfigDocument,
): OwidNormalizedAsset {
  const chart = metadata.chart ?? {};
  const columns = Object.values(metadata.columns ?? {});
  const citationText =
    readString(chart.citation) ??
    readString(columns.find((column) => readString(column.citationLong))?.citationLong) ??
    readString(columns.find((column) => readString(column.citationShort))?.citationShort) ??
    null;
  const updatedAt = latestDate(
    columns
      .map((column) => readString(column.lastUpdated))
      .filter((value): value is string => value !== undefined),
  );

  return {
    externalId: readIdentifier(config.id) ?? null,
    title: readString(chart.title) ?? readString(config.title) ?? slug,
    description: readString(chart.subtitle) ?? "",
    citationText,
    sourceUpdatedAt: updatedAt,
    canonicalUrl: urls.canonicalUrl,
    embedUrl: urls.embedUrl,
    previewUrl: urls.previewUrl,
    assetType: "chart",
    // OWID policy interpretation belongs to B3. Preserve the source evidence now,
    // but do not infer a license from an absent field.
    licenseCode: null,
    sourcePolicyUrl: "https://ourworldindata.org/faqs",
  };
}

function indicatorMetadataUrls(slug: string, metadata: OwidMetadataDocument): string[] {
  const urls = new Set<string>();
  for (const column of Object.values(metadata.columns ?? {})) {
    const value = readString(column.fullMetadata);
    if (!value) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new OwidSourceClientError({
        slug,
        endpoint: "indicator",
        code: "invalid_indicator_url",
        message: "OWID metadata contained an invalid indicator metadata URL",
        attempts: 0,
      });
    }
    const validPath = /^\/v1\/indicators\/[0-9]+\.metadata\.json$/.test(url.pathname);
    if (url.protocol !== "https:" || url.hostname !== OWID_API_HOST) {
      throw new OwidSourceClientError({
        slug,
        endpoint: "indicator",
        code: "invalid_indicator_url",
        message: "OWID metadata contained an unsupported indicator metadata URL",
        attempts: 0,
      });
    }
    // Some legacy OWID charts expose a same-origin placeholder such as
    // /v1/indicators/undefined.metadata.json. It carries no usable rights
    // evidence, so ignore it and keep the asset in conservative draft state.
    if (!validPath) {
      continue;
    }
    url.search = "";
    url.hash = "";
    urls.add(url.toString());
  }
  return [...urls].sort();
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof OwidSourceClientError)) {
    return true;
  }
  if (error.details.status !== undefined) {
    return RETRYABLE_STATUSES.has(error.details.status);
  }
  return error.details.code === "network_error" || error.details.code === "timeout";
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "request failed";
}

export class OwidSourceClient {
  private readonly fetchImpl: FetchImpl;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly concurrency: number;
  private readonly userAgent: string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly logger: (event: OwidLogEvent) => void;
  private availableSlots: number;
  private readonly slotWaiters: Array<() => void> = [];

  constructor(options: OwidSourceClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
    this.maxAttempts = Math.min(5, Math.max(1, options.maxAttempts ?? 3));
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.sleep = options.sleep ?? defaultSleep;
    this.logger = options.logger ?? ((event) => console.warn(JSON.stringify(event)));
    this.availableSlots = this.concurrency;
  }

  async fetchAsset(input: string): Promise<OwidAssetFetch> {
    const slug = normalizeSlug(input);
    const urls = buildOwidSourceUrls(slug);
    const [metadata, config] = await Promise.all([
      this.fetchJson<OwidMetadataDocument>(slug, "metadata", urls.metadataUrl),
      this.fetchJson<OwidConfigDocument>(slug, "config", urls.configUrl, {}),
    ]);
    const indicators = await Promise.all(
      indicatorMetadataUrls(slug, metadata).map(async (url) => ({
        url,
        metadata: await this.fetchJson<OwidIndicatorMetadataDocument>(slug, "indicator", url),
      })),
    );

    return {
      slug,
      urls,
      metadata,
      config,
      indicators,
      normalized: normalizeMetadata(slug, urls, metadata, config),
      raw: { metadata, config, indicators },
    };
  }

  async fetchAssets(slugs: string[]): Promise<OwidBatchResult> {
    const successful: OwidAssetFetch[] = [];
    const failed: OwidBatchFailure[] = [];
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < slugs.length) {
        const index = nextIndex;
        nextIndex += 1;
        const slug = slugs[index];
        try {
          successful.push(await this.fetchAsset(slug));
        } catch (error) {
          const details =
            error instanceof OwidSourceClientError
              ? error.details
              : {
                  slug,
                  endpoint: "metadata" as const,
                  code: "unexpected_error",
                  message: toErrorMessage(error),
                  attempts: 1,
                };
          failed.push({ slug, error: details });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, slugs.length) }, () => worker()),
    );
    successful.sort((left, right) => left.slug.localeCompare(right.slug));
    failed.sort((left, right) => left.slug.localeCompare(right.slug));
    return { successful, failed };
  }

  private async fetchJson<T>(
    slug: string,
    endpoint: OwidEndpoint,
    url: string,
    notFoundValue?: T,
  ): Promise<T> {
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

        if (response.status === 404 && notFoundValue !== undefined) {
          return notFoundValue;
        }
        if (!response.ok) {
          throw new OwidSourceClientError({
            slug,
            endpoint,
            code: `http_${response.status}`,
            message: `OWID ${endpoint} request returned HTTP ${response.status}`,
            status: response.status,
            attempts: attempt,
          });
        }

        try {
          return (await response.json()) as T;
        } catch (error) {
          throw new OwidSourceClientError(
            {
              slug,
              endpoint,
              code: "invalid_json",
              message: `OWID ${endpoint} response was not valid JSON`,
              attempts: attempt,
            },
            error,
          );
        }
      } catch (error) {
        lastError = error;
        const retryable = isRetryableError(error);
        const details =
          error instanceof OwidSourceClientError
            ? error.details
            : {
                slug,
                endpoint,
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
            slug,
            endpoint,
            attempt,
            status: details.status,
            code: details.code,
            message: details.message,
          });
          throw new OwidSourceClientError({ ...details, attempts: attempt }, error);
        }

        const delay = Math.min(2_000, 250 * 2 ** (attempt - 1));
        this.logger({
          level: "warn",
          event: "retry",
          slug,
          endpoint,
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
