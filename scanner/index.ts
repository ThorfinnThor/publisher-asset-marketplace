import puppeteer, {
  type Browser,
  type HTTPRequest,
  type HTTPResponse,
  type Page,
} from "@cloudflare/puppeteer";

import {
  urlScanContractV1,
  type UrlScanIssueCode,
  type UrlScanJobMessageV1,
  type UrlScanResultMessageV1,
  type UrlScanResultV1,
} from "../src/lib/submissions/url-scan-contract";
import {
  browserGuardrailDomains,
  isNonPublicIp,
  normalizePublicHttpsUrl,
} from "../src/lib/submissions/url-scan-network";

type ScannerEnv = Omit<ScannerEnvBindings, "SCAN_RESULTS"> & {
  SCAN_RESULTS: Queue<UrlScanResultMessageV1>;
};

type PageMetadata = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  attributionName: string | null;
  attributionUrl: string | null;
  embedUrl: string | null;
  embedDiscovery: "manifest" | "link" | "iframe" | "canonical_fallback" | "none";
  assetType: UrlScanResultV1["asset_type_candidate"];
};

type NetworkBudget = {
  requestCount: number;
  aggregateDeclaredBytes: number;
  failure: ScanFailure | null;
};

class ScanFailure extends Error {
  constructor(
    readonly code: UrlScanIssueCode,
    readonly detail: string | null = null,
  ) {
    super(detail ? `${code}:${detail}` : code);
  }
}

export default {
  async fetch(request: Request, env: ScannerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" || !url.pathname.startsWith("/internal/previews/")) {
      return new Response("Not found", { status: 404 });
    }

    const key = decodePreviewKey(url.pathname);
    if (!key) return new Response("Not found", { status: 404 });
    const object = await env.PREVIEWS.get(key);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  },
  async queue(batch: MessageBatch<UrlScanJobMessageV1>, env: ScannerEnv): Promise<void> {
    for (const message of batch.messages) {
      const job = parseJobMessage(message.body);
      if (!job) {
        console.error(
          JSON.stringify({ event: "url_scan_job_rejected", queue_message_id: message.id }),
        );
        message.ack();
        continue;
      }

      const attempt = Math.max(1, Math.min(message.attempts, urlScanContractV1.limits.attempts));
      try {
        await env.SCAN_RESULTS.send(
          { schema_version: 1, job_id: job.job_id, attempt, status: "running" },
          { contentType: "json" },
        );
        const result = await scanUrl(job, env);
        const status = result.embed.status === "blocked" ? "needs_changes" : "needs_confirmation";
        const resultMessage: UrlScanResultMessageV1 = {
          schema_version: 1,
          job_id: job.job_id,
          attempt,
          status,
          result,
        };
        assertResultSize(resultMessage);
        await env.SCAN_RESULTS.send(resultMessage, { contentType: "json" });
        message.ack();
      } catch (error) {
        const code = scanFailureCode(error);
        console.error(
          JSON.stringify({
            event: "url_scan_attempt_failed",
            job_id: job.job_id,
            attempt,
            code,
            detail: error instanceof ScanFailure ? error.detail : null,
          }),
        );
        if (message.attempts < urlScanContractV1.limits.attempts && retryable(code)) {
          message.retry({ delaySeconds: 30 * message.attempts });
          continue;
        }
        await env.SCAN_RESULTS.send(
          {
            schema_version: 1,
            job_id: job.job_id,
            attempt,
            status: "failed",
            error_code: code,
          },
          { contentType: "json" },
        );
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<ScannerEnv, UrlScanJobMessageV1>;

function decodePreviewKey(pathname: string): string | null {
  const encoded = pathname.slice("/internal/previews/".length);
  try {
    const key = decodeURIComponent(encoded);
    return /^unconfirmed\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(
      key,
    )
      ? key
      : null;
  } catch {
    return null;
  }
}

async function scanUrl(job: UrlScanJobMessageV1, env: ScannerEnv): Promise<UrlScanResultV1> {
  const deadline = Date.now() + urlScanContractV1.limits.jobTimeoutMs;
  const dnsCache = new Map<string, Promise<void>>();
  let browser: Browser | null = null;
  const networkBudget: NetworkBudget = {
    requestCount: 0,
    aggregateDeclaredBytes: 0,
    failure: null,
  };

  try {
    await validateNetworkTarget(job.requested_url, dnsCache);
    ensureBeforeDeadline(deadline);
    browser = await puppeteer.launch(env.BROWSER, {
      guardrails: {
        allowedDomains: browserGuardrailDomains(job.requested_url),
        allowedDomainSets: ["common-cdns"],
      },
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await attachNetworkGuards(page, dnsCache, networkBudget);

    let response: HTTPResponse;
    try {
      response = await navigate(page, job.requested_url);
    } catch (error) {
      if (networkBudget.failure) throw networkBudget.failure;
      throw error;
    }
    await settlePage(page);
    if (networkBudget.failure) throw networkBudget.failure;
    validateMainResponse(response);

    const finalUrl = page.url();
    await validateNetworkTarget(finalUrl, dnsCache);
    ensureBeforeDeadline(deadline);
    const metadata = await extractMetadata(page, finalUrl);
    const preview = await createPreview(page, job.job_id, env.PREVIEWS);
    const embedUrl = metadata.embedUrl ?? finalUrl;
    const sandboxStatus = await testSandbox(browser, embedUrl, dnsCache, networkBudget, deadline);

    const issues: UrlScanResultV1["issues"] = [
      { code: "rights_evidence_missing", field: "rights" },
      { code: "ownership_unconfirmed", field: "authorization" },
    ];
    if (sandboxStatus === "blocked") issues.unshift({ code: "frame_blocked", field: "embed_url" });
    if (sandboxStatus === "unknown") {
      issues.unshift({ code: "sandbox_not_interactive", field: "embed_url" });
    }

    return {
      schema_version: 1,
      final_url: finalUrl,
      canonical_url_candidate: normalizeCandidate(metadata.canonical, finalUrl),
      asset_type_candidate: metadata.assetType,
      title_candidate: cleanText(metadata.title, 160),
      description_candidate: cleanText(metadata.description, 2_000),
      attribution_name_candidate: cleanText(metadata.attributionName, 160),
      attribution_url_candidate: normalizeCandidate(metadata.attributionUrl, finalUrl),
      embed: {
        candidate_url: normalizeCandidate(embedUrl, finalUrl),
        discovery: metadata.embedDiscovery,
        sandbox_profile: "v1:allow-scripts",
        status: sandboxStatus,
      },
      preview,
      rights_candidates: {
        evidence_url: null,
        embed_allowed: null,
        commercial_use: null,
        modification_allowed: null,
        citation_required: null,
        verification_status: "unverified",
      },
      issues,
      raw_content_stored: false,
      auto_publish: false,
    };
  } catch (error) {
    if (error instanceof ScanFailure) throw error;
    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new ScanFailure("navigation_timeout");
    }
    throw new ScanFailure("sandbox_runtime_error");
  } finally {
    if (browser) await browser.close();
  }
}

async function attachNetworkGuards(
  page: Page,
  dnsCache: Map<string, Promise<void>>,
  budget: NetworkBudget,
): Promise<void> {
  await page.setRequestInterception(true);
  page.on("popup", (popup) => {
    if (popup) void popup.close().catch(() => undefined);
  });
  page.on("dialog", (dialog) => {
    void dialog.dismiss().catch(() => undefined);
  });
  page.on("request", async (request) => {
    budget.requestCount += 1;
    if (budget.requestCount > urlScanContractV1.limits.requests) {
      budget.failure = new ScanFailure("request_limit");
      await request.abort("blockedbyclient");
      return;
    }
    await validateInterceptedRequest(request, dnsCache, budget);
  });
  page.on("response", (response) => {
    budget.aggregateDeclaredBytes += parseContentLength(response.headers()["content-length"]);
    if (budget.aggregateDeclaredBytes > urlScanContractV1.limits.aggregateDeclaredBytes) {
      budget.failure = new ScanFailure("response_too_large");
    }
    if (response.request().redirectChain().length > urlScanContractV1.limits.redirects) {
      budget.failure = new ScanFailure("redirect_limit");
    }
  });
}

async function validateInterceptedRequest(
  request: HTTPRequest,
  dnsCache: Map<string, Promise<void>>,
  budget: NetworkBudget,
): Promise<void> {
  try {
    await validateNetworkTarget(request.url(), dnsCache);
    if (!request.isInterceptResolutionHandled()) await request.continue();
  } catch (error) {
    budget.failure = error instanceof ScanFailure ? error : new ScanFailure("address_not_public");
    if (!request.isInterceptResolutionHandled()) await request.abort("blockedbyclient");
  }
}

async function navigate(page: Page, url: string): Promise<HTTPResponse> {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: urlScanContractV1.limits.navigationTimeoutMs,
  });
  if (!response) throw new ScanFailure("navigation_timeout");
  return response;
}

function validateMainResponse(response: HTTPResponse): void {
  const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new ScanFailure("unsupported_content_type");
  }
  if (
    parseContentLength(response.headers()["content-length"]) >
    urlScanContractV1.limits.mainDocumentBytes
  ) {
    throw new ScanFailure("response_too_large");
  }
}

async function extractMetadata(page: Page, finalUrl: string): Promise<PageMetadata> {
  const json = await page.evaluate(() => {
    const content = (selector: string): string | null =>
      document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || null;
    const href = (selector: string): string | null =>
      document.querySelector<HTMLLinkElement>(selector)?.href?.trim() || null;
    const embedLink =
      href('link[rel="publisher-asset"]') ??
      href('link[rel="alternate"][type="text/html"]') ??
      document.querySelector<HTMLIFrameElement>("iframe[src]")?.src?.trim() ??
      null;
    const discovery = href('link[rel="publisher-asset"]')
      ? "manifest"
      : href('link[rel="alternate"][type="text/html"]')
        ? "link"
        : document.querySelector("iframe[src]")
          ? "iframe"
          : "canonical_fallback";
    const text = `${document.title} ${content('meta[name="description"]') ?? ""}`.toLowerCase();
    const type =
      text.includes("calculator") || text.includes("rechner")
        ? "calculator"
        : text.includes("benchmark")
          ? "benchmark"
          : document.querySelector("table")
            ? "table"
            : document.querySelector("canvas, svg")
              ? "chart"
              : document.querySelector("form, input, select")
                ? "widget"
                : null;
    return JSON.stringify({
      title: document.title?.trim() || content('meta[property="og:title"]'),
      description:
        content('meta[name="description"]') ?? content('meta[property="og:description"]'),
      canonical: href('link[rel="canonical"]'),
      attributionName: content('meta[property="og:site_name"]'),
      attributionUrl: href('link[rel="author"]'),
      embedUrl: embedLink,
      embedDiscovery: discovery,
      assetType: type,
    });
  });
  const metadata = JSON.parse(json) as PageMetadata;
  if (!metadata.canonical) metadata.canonical = finalUrl;
  return metadata;
}

async function createPreview(
  page: Page,
  jobId: string,
  bucket: R2Bucket,
): Promise<UrlScanResultV1["preview"]> {
  try {
    const screenshot = await page.screenshot({ type: "png", captureBeyondViewport: false });
    const bytes = new Uint8Array(screenshot);
    if (bytes.byteLength > urlScanContractV1.limits.previewBytes) {
      throw new ScanFailure("preview_failed");
    }
    const key = `unconfirmed/${jobId}.png`;
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "private, no-store" },
      customMetadata: {
        expiresAt: new Date(
          Date.now() + urlScanContractV1.limits.unconfirmedPreviewTtlDays * 24 * 60 * 60 * 1_000,
        ).toISOString(),
      },
    });
    return {
      r2_key: key,
      content_type: "image/png",
      width: 1280,
      height: 720,
      creator_confirmation_required: true,
    };
  } catch (error) {
    if (error instanceof ScanFailure) throw error;
    throw new ScanFailure("preview_failed");
  }
}

async function testSandbox(
  browser: Browser,
  embedUrl: string,
  dnsCache: Map<string, Promise<void>>,
  networkBudget: NetworkBudget,
  deadline: number,
): Promise<UrlScanResultV1["embed"]["status"]> {
  ensureBeforeDeadline(deadline);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 960, height: 640, deviceScaleFactor: 1 });
    await attachNetworkGuards(page, dnsCache, networkBudget);
    await page.setContent(
      `<iframe title="Asset preview" sandbox="allow-scripts" src="${escapeHtmlAttribute(embedUrl)}" style="width:100%;height:600px;border:0"></iframe>`,
      { waitUntil: "domcontentloaded", timeout: 5_000 },
    );
    await settlePage(page);
    if (networkBudget.failure) throw networkBudget.failure;
    const child = page
      .frames()
      .find((frame) => frame !== page.mainFrame() && frame.url() !== "about:blank");
    if (!child) return "blocked";
    const interactive = await child.evaluate(() =>
      Boolean(
        document.querySelector(
          "button, input, select, textarea, canvas, svg, table, [role=button]",
        ),
      ),
    );
    return interactive ? "pass" : "unknown";
  } catch (error) {
    if (networkBudget.failure) throw networkBudget.failure;
    if (error instanceof ScanFailure) throw error;
    return "blocked";
  } finally {
    await page.close();
  }
}

async function settlePage(page: Page): Promise<void> {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 3_000 });
  } catch {
    // A continuously polling widget can still be a valid embed.
  }
}

async function validateNetworkTarget(
  input: string,
  cache: Map<string, Promise<void>>,
): Promise<void> {
  const normalized = normalizePublicHttpsUrl(input);
  if (!normalized.ok) throw new ScanFailure("address_not_public", "url_validation");
  if (normalized.hostname.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(normalized.hostname)) {
    if (isNonPublicIp(normalized.hostname)) {
      throw new ScanFailure("address_not_public", `literal_ip:${normalized.hostname}`);
    }
    return;
  }
  let resolution = cache.get(normalized.hostname);
  if (!resolution) {
    resolution = resolvePublicHostname(normalized.hostname);
    cache.set(normalized.hostname, resolution);
  }
  await resolution;
}

async function resolvePublicHostname(hostname: string): Promise<void> {
  const [ipv4, ipv6] = await Promise.all([resolveDns(hostname, "A"), resolveDns(hostname, "AAAA")]);
  const addresses = [...ipv4, ...ipv6];
  if (addresses.length === 0) throw new ScanFailure("dns_unavailable");
  const blockedAddress = addresses.find(isNonPublicIp);
  if (blockedAddress) throw new ScanFailure("address_not_public", `dns_ip:${blockedAddress}`);
}

async function resolveDns(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new ScanFailure("dns_unavailable");
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.Answer)) return [];
  return payload.Answer.flatMap((answer) => {
    if (!isRecord(answer) || typeof answer.data !== "string") return [];
    const value = answer.data.trim();
    if (type === "A" && /^\d+\.\d+\.\d+\.\d+$/.test(value)) return [value];
    if (type === "AAAA" && value.includes(":")) return [value];
    return [];
  });
}

function parseJobMessage(value: unknown): UrlScanJobMessageV1 | null {
  if (!isRecord(value) || value.schema_version !== 1) return null;
  if (typeof value.job_id !== "string" || typeof value.requested_url !== "string") return null;
  if (!/^[0-9a-f-]{36}$/i.test(value.job_id)) return null;
  if (!normalizePublicHttpsUrl(value.requested_url).ok) return null;
  return { schema_version: 1, job_id: value.job_id, requested_url: value.requested_url };
}

function parseContentLength(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeCandidate(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const absolute = new URL(value, base).toString();
    const normalized = normalizePublicHttpsUrl(absolute);
    return normalized.ok ? normalized.url : null;
  } catch {
    return null;
  }
}

function cleanText(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean.slice(0, maxLength) : null;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function ensureBeforeDeadline(deadline: number): void {
  if (Date.now() >= deadline) throw new ScanFailure("navigation_timeout");
}

function assertResultSize(message: UrlScanResultMessageV1): void {
  const bytes = new TextEncoder().encode(JSON.stringify(message)).byteLength;
  if (bytes > urlScanContractV1.limits.resultJsonBytes) {
    throw new ScanFailure("response_too_large");
  }
}

function scanFailureCode(error: unknown): UrlScanIssueCode {
  return error instanceof ScanFailure ? error.code : "sandbox_runtime_error";
}

function retryable(code: UrlScanIssueCode): boolean {
  return (
    code === "dns_unavailable" || code === "navigation_timeout" || code === "sandbox_runtime_error"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
