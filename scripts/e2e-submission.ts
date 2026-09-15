import { createHmac } from "node:crypto";

const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:8788").replace(/\/$/u, "");
const creatorSession = process.env.E2E_CREATOR_SESSION ?? "creator-token-for-e2e";
const adminSession = process.env.E2E_ADMIN_SESSION ?? "admin-token-for-e2e";
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
  assert(form.text.includes("Preview image URL"), "preview requirement is missing");

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
      authorized_to_submit: true,
      opportunity_topic: null,
    },
  });
  assert(submission.response.status === 201, `submission returned ${submission.response.status}`);
  const submissionPayload = JSON.parse(submission.text) as {
    submission_id?: unknown;
    pre_screen?: { status?: unknown };
  };
  assert(typeof submissionPayload.submission_id === "string", "submission id is missing");
  assert(submissionPayload.pre_screen?.status === "pass", "pre-screen did not pass");

  const queue = await request("/admin/submissions", { session: adminSession });
  assert(queue.response.status === 200, `admin queue returned ${queue.response.status}`);
  assert(queue.text.includes(title), "admin queue does not show the submission");
  assert(queue.text.includes("Automated pre-screen"), "admin queue has no pre-screen section");
  assert(queue.text.includes("passed"), "admin queue has no passing pre-screen result");

  const review = await request(`/api/admin/submissions/${submissionPayload.submission_id}/review`, {
    method: "POST",
    session: adminSession,
    body: {
      csrf_token: csrfToken(adminSession),
      decision: "approved",
      review_notes: "E2E test rights evidence reviewed and approved.",
      rights_status: "safe",
      rights_reason_code: "source_terms",
      rights_evidence_url: "https://e2e-test.example.com/rights",
    },
  });
  assert(review.response.status === 200, `admin approval returned ${review.response.status}`);
  const reviewPayload = JSON.parse(review.text) as { asset_slug?: unknown; asset_id?: unknown };
  assert(typeof reviewPayload.asset_slug === "string", "published asset slug is missing");
  assert(typeof reviewPayload.asset_id === "string", "published asset id is missing");

  const asset = await request(`/asset/${reviewPayload.asset_slug}`);
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
