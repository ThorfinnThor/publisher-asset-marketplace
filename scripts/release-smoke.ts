const defaultBaseUrl = "https://publisher-asset-marketplace.shuu9599.workers.dev";
const baseUrl = (process.env.RELEASE_BASE_URL ?? defaultBaseUrl).replace(/\/$/u, "");

type SmokeCheck = {
  path: string;
  expectedStatus: number;
  includes?: string[];
  headers?: Record<string, string>;
  init?: RequestInit;
};

const checks: SmokeCheck[] = [
  { path: "/", expectedStatus: 200, includes: ["Find data worth citing."] },
  { path: "/search?q=solar", expectedStatus: 200, includes: ["Results for"] },
  {
    path: "/asset/solar-pv-prices",
    expectedStatus: 200,
    includes: ["Copy citation", "Copy embed"],
  },
  {
    path: "/opportunities",
    expectedStatus: 200,
    includes: ["Build what publishers are looking for."],
  },
  {
    path: "/creator/dashboard",
    expectedStatus: 200,
    includes: ["Sign in to continue"],
  },
  {
    path: "/submit?topic=saas%20churn",
    expectedStatus: 200,
    includes: ["Publish an asset"],
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

async function run(): Promise<void> {
  const failures: string[] = [];
  for (const check of checks) {
    const response = await fetch(`${baseUrl}${check.path}`, {
      redirect: "manual",
      ...check.init,
    });
    const body = await response.text();
    if (response.status !== check.expectedStatus) {
      failures.push(`${check.path}: expected ${check.expectedStatus}, got ${response.status}`);
    }
    for (const expected of check.includes ?? []) {
      if (!body.includes(expected)) failures.push(`${check.path}: missing text ${expected}`);
    }
    if (check.path === "/" && response.headers.get("x-frame-options") !== "DENY") {
      failures.push("/: missing x-frame-options=DENY");
    }
  }
  if (failures.length > 0) {
    throw new Error(`Release smoke failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(`Release smoke passed for ${baseUrl} (${checks.length} checks).`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
