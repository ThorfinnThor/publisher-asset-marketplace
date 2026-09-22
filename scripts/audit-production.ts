export {};

const defaultBaseUrl = "https://citesupply.com";
const baseUrl = (process.env.AUDIT_BASE_URL ?? defaultBaseUrl).replace(/\/$/u, "");
const concurrency = Number(process.env.AUDIT_CONCURRENCY ?? "2");

const publicUtilityPaths = [
  "/search",
  "/opportunities",
  "/creator/guide",
  "/creator/terms",
  "/privacy",
  "/legal-notice",
  "/report",
  "/submit",
  "/creator/dashboard",
  "/auth/email",
  "/this-page-must-not-exist",
] as const;

type PageAudit = {
  url: string;
  status: number;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  h1Count: number;
  htmlLang: string;
  links: string[];
};

function firstMatch(html: string, expression: RegExp): string {
  return (html.match(expression)?.[1] ?? "").replace(/\s+/gu, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">");
}

function extractLinks(html: string, pageUrl: string): string[] {
  const links = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/giu)]
    .map((match) => decodeHtml(match[1] ?? ""))
    .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:"))
    .map((href) => new URL(href, pageUrl))
    .filter((url) => url.origin === new URL(baseUrl).origin)
    .map((url) => `${url.origin}${url.pathname}${url.search}`);
  return [...new Set(links)];
}

async function fetchText(url: string, redirect: RequestRedirect = "follow") {
  const response = await fetch(url, {
    redirect,
    headers: { "cache-control": "no-cache", "user-agent": "CiteSupply-QA/1.0" },
  });
  return { response, body: await response.text() };
}

async function auditPage(url: string): Promise<PageAudit> {
  let response: Response | null = null;
  let body = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const fetched = await fetchText(url);
    response = fetched.response;
    body = fetched.body;
    if (
      response.status < 500 &&
      !body.includes("This asset is temporarily unavailable.") &&
      !body.includes("Search is temporarily unavailable.")
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  if (!response) throw new Error(`No response received for ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return {
      url,
      status: response.status,
      title: "",
      description: "",
      canonical: "",
      robots: "",
      h1Count: 0,
      htmlLang: "",
      links: [],
    };
  }
  return {
    url,
    status: response.status,
    title: decodeHtml(firstMatch(body, /<title[^>]*>([\s\S]*?)<\/title>/iu)),
    description: decodeHtml(
      firstMatch(
        body,
        /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/iu,
      ) ||
        firstMatch(
          body,
          /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["'][^>]*>/iu,
        ),
    ),
    canonical: decodeHtml(
      firstMatch(body, /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/iu) ||
        firstMatch(body, /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/iu),
    ),
    robots: decodeHtml(
      firstMatch(
        body,
        /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/iu,
      ) ||
        firstMatch(
          body,
          /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']robots["'][^>]*>/iu,
        ),
    ),
    h1Count: body.match(/<h1\b/giu)?.length ?? 0,
    htmlLang: firstMatch(body, /<html\b[^>]*\blang=["']([^"']+)["']/iu),
    links: extractLinks(body, url),
  };
}

async function mapConcurrent<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        results[current] = await fn(items[current] as T);
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
    }),
  );
  return results;
}

async function run(): Promise<void> {
  const failures: string[] = [];
  const { response: sitemapResponse, body: sitemap } = await fetchText(`${baseUrl}/sitemap.xml`);
  if (sitemapResponse.status !== 200)
    failures.push(`/sitemap.xml returned ${sitemapResponse.status}`);
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) =>
    decodeHtml(match[1] ?? ""),
  );
  if (sitemapUrls.length < 4 || sitemapUrls.length > 503) {
    failures.push(`sitemap contains ${sitemapUrls.length} URLs; expected 4-503`);
  }

  const auditUrls = [
    ...new Set([...sitemapUrls, ...publicUtilityPaths.map((path) => `${baseUrl}${path}`)]),
  ];
  const pages = await mapConcurrent(auditUrls, auditPage);
  const sitemapSet = new Set(sitemapUrls);
  const titleOwners = new Map<string, string[]>();

  for (const page of pages) {
    const pathname = new URL(page.url).pathname;
    const expectedStatus = pathname === "/this-page-must-not-exist" ? 404 : 200;
    if (page.status !== expectedStatus)
      failures.push(`${pathname}: expected ${expectedStatus}, got ${page.status}`);
    if (!page.title) failures.push(`${pathname}: missing title`);
    if (!page.description && expectedStatus === 200)
      failures.push(`${pathname}: missing meta description`);
    if (page.h1Count !== 1) failures.push(`${pathname}: expected one h1, got ${page.h1Count}`);
    if (page.htmlLang !== "en")
      failures.push(`${pathname}: expected html lang=en, got ${page.htmlLang || "missing"}`);

    if (sitemapSet.has(page.url)) {
      if (normalizeUrl(page.canonical) !== normalizeUrl(page.url)) {
        failures.push(`${pathname}: canonical is ${page.canonical || "missing"}`);
      }
      if (!page.robots.toLowerCase().includes("index"))
        failures.push(`${pathname}: missing index directive`);
      const owners = titleOwners.get(page.title) ?? [];
      owners.push(pathname);
      titleOwners.set(page.title, owners);
    } else if (
      pathname !== "/this-page-must-not-exist" &&
      !page.robots.toLowerCase().includes("noindex")
    ) {
      failures.push(`${pathname}: utility page should be noindex`);
    }
  }

  for (const [title, owners] of titleOwners) {
    if (owners.length > 1)
      failures.push(`duplicate indexable title “${title}” on ${owners.slice(0, 4).join(", ")}`);
  }

  const auditedUrls = new Set(auditUrls.map(normalizeUrl));
  const internalLinks = [...new Set(pages.flatMap((page) => page.links))].filter((url) => {
    const path = new URL(url).pathname;
    return (
      !auditedUrls.has(normalizeUrl(url)) &&
      !path.startsWith("/api/") &&
      !path.startsWith("/auth/") &&
      !path.startsWith("/e/")
    );
  });
  const linkedResponses = await mapConcurrent(internalLinks, async (url) => {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "CiteSupply-QA/1.0" },
    });
    return { url, status: response.status };
  });
  for (const link of linkedResponses) {
    if (link.status >= 400) failures.push(`broken internal link ${link.url} (${link.status})`);
  }

  if (failures.length > 0) throw new Error(`Production audit failed:\n- ${failures.join("\n- ")}`);
  console.log(
    `Production audit passed: ${pages.length} pages, ${sitemapUrls.length} sitemap URLs, ${internalLinks.length} internal links.`,
  );
}

function normalizeUrl(value: string): string {
  if (!value) return "";
  const url = new URL(value, `${baseUrl}/`);
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/u, "")}${url.search}`;
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
