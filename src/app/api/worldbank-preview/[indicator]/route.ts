import { parseWorldBankApiPoints } from "@/lib/assets/worldbank-chart";

const INDICATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_RESPONSE_BYTES = 512_000;
const REQUEST_TIMEOUT_MS = 8_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ indicator: string }> },
): Promise<Response> {
  const { indicator: rawIndicator } = await params;
  const indicator = rawIndicator.trim().toUpperCase();
  if (!INDICATOR_PATTERN.test(indicator)) return errorResponse(400, "Invalid indicator.");

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
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return errorResponse(502, "World Bank data is temporarily unavailable.");

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
      return errorResponse(502, "World Bank response exceeded the preview limit.");
    }

    const value = await readBoundedJson(response, MAX_RESPONSE_BYTES);
    const points = parseWorldBankApiPoints(value);
    if (points.length === 0) return errorResponse(404, "No chart observations are available.");

    return Response.json(
      { points },
      {
        headers: {
          "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return errorResponse(502, "World Bank data is temporarily unavailable.");
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

function errorResponse(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
  );
}
