import { createHmac } from "node:crypto";

const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:8788").replace(/\/$/u, "");
const creatorSession = process.env.E2E_CREATOR_SESSION ?? "creator-token-for-e2e";
const authSecret = process.env.E2E_AUTH_SECRET ?? "e2e-local-secret";

if (!baseUrl.startsWith("http://localhost:") && process.env.E2E_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing to run the mutating E2E flow against a remote URL.");
}

const stamp = Date.now().toString(36);
const title = `E2E creator asset ${stamp}`;
const canonicalUrl = `https://e2e-test.example.com/assets/${stamp}`;
const previewUrl = `${canonicalUrl}/preview.png`;

function csrfToken(session: string): string {
  const value = `csrf:v1:${session}`;
  const signature = createHmac("sha256", authSecret).update(value).digest("base64url");
  return `v1.${signature}`;
}

async function request(
  path: string,
  options: { session?: string; method?: string; body?: unknown } = {},
): Promise<{ response: Response; text: string }> {
  const headers = new Headers({ "cache-control": "no-cache" });
  if (options.session) {
    headers.set("cookie", `publisher_asset_session=${options.session}`);
    headers.set("origin", baseUrl);
  }
  if (options.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  return { response, text: await response.text() };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`E2E failed: ${message}`);
}

async function run(): Promise<void> {
  const form = await request("/submit", { session: creatorSession });
  assert(form.response.status === 200, `submission form returned ${form.response.status}`);
  assert(form.text.includes("Submission requirements"), "submission requirements are not visible");
  assert(form.text.includes("Preview image"), "preview requirement is missing");
  assert(form.text.includes("Sandbox compatibility test"), "sandbox test is missing");

  const submission = await request("/api/submissions", {
    method: "POST",
    session: creatorSession,
    body: {
      csrf_token: csrfToken(creatorSession),
      canonical_url: canonicalUrl,
      asset_type: "chart",
      title,
      description: "An end-to-end test asset proving the creator publication flow.",
      embed_url: `${canonicalUrl}/embed`,
      preview_url: previewUrl,
      attribution_name: "E2E Example Source",
      attribution_url: "https://e2e-test.example.com/about",
      attribution_terms: "Credit E2E Example Source — CC BY 4.0",
      commercial_use: true,
      embed_allowed: true,
      modification_allowed: false,
      citation_required: true,
      sandbox_compatible: true,
      source_identity_confirmed: true,
      attribution_confirmed: true,
      preview_display_authorized: true,
      authorized_to_submit: true,
      commercial_marketplace_acknowledged: true,
      creator_terms_accepted: true,
      opportunity_topic: null,
    },
  });
  assert(submission.response.status === 201, `submission returned ${submission.response.status}`);
  const submissionPayload = JSON.parse(submission.text) as {
    submission_id?: unknown;
    asset_slug?: unknown;
    auto_publish?: unknown;
    pre_screen?: { status?: unknown };
  };
  assert(typeof submissionPayload.submission_id === "string", "submission id is missing");
  assert(submissionPayload.pre_screen?.status === "pass", "pre-screen did not pass");
  assert(
    submissionPayload.auto_publish === true,
    `passing submission was not auto-published (${submission.text.slice(0, 300)})`,
  );
  assert(typeof submissionPayload.asset_slug === "string", "published asset slug is missing");

  const asset = await request(`/asset/${submissionPayload.asset_slug}`);
  assert(asset.response.status === 200, `published asset returned ${asset.response.status}`);
  assert(asset.text.includes(title), "published asset title is missing");
  assert(asset.text.includes("Data visualization loaded directly"), "real preview is not rendered");
  assert(asset.text.includes("Credit E2E Example Source"), "reviewed attribution is missing");

  const dashboard = await request("/creator/dashboard", { session: creatorSession });
  assert(
    dashboard.response.status === 200,
    `creator dashboard returned ${dashboard.response.status}`,
  );
  assert(dashboard.text.includes(title), "creator dashboard does not show the published asset");

  console.log(`E2E submission flow passed for ${title} (${baseUrl}).`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
