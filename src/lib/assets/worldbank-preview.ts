import { parseWorldBankApiPoints, type WorldBankChartPoint } from "./worldbank-chart";

const INDICATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_RESPONSE_BYTES = 512_000;
const REQUEST_TIMEOUT_MS = 8_000;
const UPSTREAM_CACHE_TTL_SECONDS = 86_400;

export class WorldBankPreviewError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 502,
  ) {
    super(message);
    this.name = "WorldBankPreviewError";
  }
}

export function normalizeWorldBankIndicator(value: string): string | null {
  const indicator = value.trim().toUpperCase();
  return INDICATOR_PATTERN.test(indicator) ? indicator : null;
}

export async function fetchWorldBankPreview(
  rawIndicator: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<WorldBankChartPoint[]> {
  const indicator = normalizeWorldBankIndicator(rawIndicator);
  if (!indicator) throw new WorldBankPreviewError("Invalid indicator.", 400);

  const url = new URL(
    `/v2/country/all/indicator/${encodeURIComponent(indicator)}`,
    "https://api.worldbank.org",
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "400");
  url.searchParams.set("mrnev", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cf: {
        cacheEverything: true,
        cacheTtl: UPSTREAM_CACHE_TTL_SECONDS,
      },
    });
    if (!response.ok) {
      throw new WorldBankPreviewError("World Bank data is temporarily unavailable.", 502);
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new WorldBankPreviewError("World Bank response exceeded the preview limit.", 502);
    }

    const value = await readBoundedJson(response, MAX_RESPONSE_BYTES);
    const points = parseWorldBankApiPoints(value);
    if (points.length === 0) {
      throw new WorldBankPreviewError("No chart observations are available.", 404);
    }
    return points;
  } catch (error) {
    if (error instanceof WorldBankPreviewError) throw error;
    throw new WorldBankPreviewError("World Bank data is temporarily unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new Error("missing response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("response too large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(combined)) as unknown;
}
