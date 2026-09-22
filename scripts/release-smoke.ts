const defaultBaseUrl = "https://publisher-asset-marketplace.shuu9599.workers.dev";
const baseUrl = (process.env.RELEASE_BASE_URL ?? defaultBaseUrl).replace(/\/$/u, "");

type SmokeCheck = {
  path: string;
  expectedStatus: number;
  includes?: string[];
  excludes?: string[];
  headers?: Record<string, string>;
  init?: RequestInit;
  expectedLocation?: string;
  responseHeaders?: Record<string, string>;
};

const checks: SmokeCheck[] = [
  { path: "/", expectedStatus: 200, includes: ["Find data worth citing."] },
  {
    path: "/robots.txt",
    expectedStatus: 200,
    includes: [
      "User-agent: OAI-SearchBot",
      "Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference",
      "Sitemap: https://citesupply.com/sitemap.xml",
    ],
    responseHeaders: { "content-type": "text/plain; charset=utf-8" },
  },
  {
    path: "/sitemap.xml",
    expectedStatus: 200,
    includes: ["<urlset", "https://citesupply.com/asset/solar-pv-prices"],
    excludes: ["https://citesupply.com/creator/terms", "https://citesupply.com/report"],
    responseHeaders: { "content-type": "application/xml; charset=utf-8" },
  },
  {
    path: "/search?q=solar",
    expectedStatus: 200,
    includes: ["Results for", "Solar photovoltaic panel prices"],
  },
  {
    path: "/asset/solar-pv-prices",
    expectedStatus: 200,
    includes: [
      "Solar photovoltaic panel prices",
      "Copy citation",
      "Copy source embed",
      "https://citesupply.com/e/solar-pv-prices",
      'src="https://ourworldindata.org/grapher/solar-pv-prices.png?imType=thumbnail&amp;imWidth=640"',
      "Data visualization loaded directly from Our World in Data.",
      '"@type":"CreativeWork"',
      'name="robots" content="index, follow',
    ],
    excludes: ["Interface preview only—not source data."],
  },
  {
    path: "/e/solar-pv-prices",
    expectedStatus: 302,
    expectedLocation: "https://ourworldindata.org/grapher/solar-pv-prices?embed=1",
    responseHeaders: { "cache-control": "private, no-store" },
  },
  {
    path: "/asset/absolute-number-of-deaths-from-outdoor-air-pollution",
    expectedStatus: 200,
    includes: ["Copy citation", "Copy source embed", "Commercial use"],
  },
  {
    path: "/asset/worldbank-eg.elc.accs.zs",
    expectedStatus: 200,
    includes: [
      "Copy citation",
      "Copy Cite Supply embed",
      "https://citesupply.com/embed/worldbank-eg.elc.accs.zs",
      "reviewed World Bank observations under CC BY 4.0",
    ],
  },
  {
    path: "/embed/worldbank-eg.elc.accs.zs",
    expectedStatus: 200,
    includes: [
      "Latest non-empty observations",
      "Source: World Bank Open Data",
      "Licensed under CC BY 4.0",
      "not an official World Bank embed",
    ],
  },
  {
    path: "/asset/worldbank-sp.pop.totl",
    expectedStatus: 200,
    includes: ["World Bank catalogue assets are citation-only"],
    excludes: ["https://citesupply.com/embed/worldbank-sp.pop.totl"],
  },
  {
    path: "/embed/worldbank-sp.pop.totl",
    expectedStatus: 404,
    includes: ["Not found"],
  },
  {
    path: "/embed/eurostat-tps00001",
    expectedStatus: 200,
    includes: [
      "Reviewed Eurostat observations",
      "Source: Eurostat",
      "Custom EU27 selection from 2020",
      "not an official Eurostat embed",
    ],
  },
  {
    path: "/embed/eurostat-nama_10_gdp",
    expectedStatus: 200,
    includes: ["Reviewed Eurostat observations", "Source: Eurostat"],
  },
  {
    path: "/embed/eurostat-une_rt_a",
    expectedStatus: 200,
    includes: ["Reviewed Eurostat observations", "Source: Eurostat"],
  },
  {
    path: "/asset/children-not-in-school",
    expectedStatus: 404,
    includes: ["Not found"],
  },
  {
    path: "/opportunities",
    expectedStatus: 200,
    includes: ["Build what publishers are looking for."],
  },
  {
    path: "/creator/dashboard",
    expectedStatus: 200,
    includes: ["Sign in to continue", "Continue with Google"],
  },
  {
    path: "/submit?topic=saas%20churn",
    expectedStatus: 200,
    includes: ["Publish an asset", "Submission requirements", "Maximum 10 submissions"],
  },
  {
    path: "/api/analytics/search",
    expectedStatus: 400,
    init: { method: "POST", body: "{}" },
  },
  {
    path: "/api/submissions",
    expectedStatus: 403,
    init: { method: "POST", body: "{}" },
  },
  {
    path: "/api/auth/sign-out",
    expectedStatus: 403,
    init: { method: "POST" },
  },
];

// Eurostat marketplace-rendered embeds become available only after the reviewed
// rights manifest is applied to D1. The deploy workflow therefore runs the
// baseline smoke before that import, while the import workflow runs this full
// smoke afterwards.
const checksToRun =
  process.env.RELEASE_INCLUDE_EUROSTAT_EMBEDS === "false"
    ? checks.filter((check) => !check.path.startsWith("/embed/eurostat-"))
    : checks;

async function run(): Promise<void> {
  const failures: string[] = [];
  for (const check of checksToRun) {
    const url = new URL(check.path, `${baseUrl}/`);
    url.searchParams.set("__release_smoke", process.env.GITHUB_SHA ?? Date.now().toString());
    let response: Response | null = null;
    let body = "";
    const maxAttempts = check.path === "/sitemap.xml" ? 5 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      response = await fetch(url, {
        redirect: "manual",
        headers: { "cache-control": "no-cache", ...check.headers },
        ...check.init,
      });
      body = await response.text();
      const sitemapUrlCount = body.match(/<url>/gu)?.length ?? 0;
      if (check.path !== "/sitemap.xml" || sitemapUrlCount <= 503 || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
    if (!response) throw new Error(`No response received for ${check.path}`);
    if (response.status !== check.expectedStatus) {
      failures.push(`${check.path}: expected ${check.expectedStatus}, got ${response.status}`);
    }
    if (check.expectedLocation && response.headers.get("location") !== check.expectedLocation) {
      failures.push(
        `${check.path}: expected redirect to ${check.expectedLocation}, got ${response.headers.get("location") ?? "no location"}`,
      );
    }
    for (const [name, expected] of Object.entries(check.responseHeaders ?? {})) {
      if (response.headers.get(name) !== expected) {
        failures.push(
          `${check.path}: expected ${name}=${expected}, got ${response.headers.get(name) ?? "missing"}`,
        );
      }
    }
    for (const expected of check.includes ?? []) {
      if (!body.includes(expected)) failures.push(`${check.path}: missing text ${expected}`);
    }
    for (const unexpected of check.excludes ?? []) {
      if (body.includes(unexpected)) failures.push(`${check.path}: unexpected text ${unexpected}`);
    }
    if (check.path === "/sitemap.xml") {
      const urlCount = body.match(/<url>/gu)?.length ?? 0;
      if (urlCount < 4 || urlCount > 503) {
        failures.push(
          `${check.path}: expected 3 static URLs plus 1-500 curated assets, got ${urlCount} URLs`,
        );
      }
    }
    if (check.path.startsWith("/embed/") && check.expectedStatus === 200) {
      if (response.headers.get("x-frame-options") !== null) {
        failures.push(`${check.path}: embed must not send x-frame-options`);
      }
      const csp = response.headers.get("content-security-policy") ?? "";
      if (!csp.includes("frame-ancestors *") || !csp.includes("script-src 'none'")) {
        failures.push(`${check.path}: isolated embed CSP is incomplete`);
      }
    }
    if (check.path === "/" && response.headers.get("x-frame-options") !== "DENY") {
      failures.push("/: missing x-frame-options=DENY");
    }
  }
  if (failures.length > 0) {
    throw new Error(`Release smoke failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(`Release smoke passed for ${baseUrl} (${checksToRun.length} checks).`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
