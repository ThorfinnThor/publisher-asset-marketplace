import { createHash, createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:8788").replace(/\/$/u, "");
const creatorSession = process.env.E2E_CREATOR_SESSION ?? "creator-token-for-e2e";
const adminSession = process.env.E2E_ADMIN_SESSION ?? "admin-token-for-e2e";
const authSecret = process.env.E2E_AUTH_SECRET ?? "e2e-local-secret";

if (!baseUrl.startsWith("http://localhost:")) {
  throw new Error("Refusing to seed or mutate a remote database for URL-scan E2E.");
}

const stamp = Date.now().toString(36);
const scanId = randomUUID();
const blockedScanId = randomUUID();
const canonicalUrl = `https://e2e-scan.example.com/tools/${stamp}`;
const creatorProfileId = `github:e2e-creator-${stamp}`;
const adminProfileId = `github:e2e-admin-${stamp}`;
const now = new Date().toISOString();
const expiresAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
const title = `E2E scanned calculator ${stamp}`;

const resultJson = JSON.stringify({
  schema_version: 1,
  final_url: canonicalUrl,
  canonical_url_candidate: canonicalUrl,
  asset_type_candidate: "calculator",
  title_candidate: title,
  description_candidate: "A locally seeded scan candidate for adversarial conversion testing.",
  attribution_name_candidate: "E2E Scan Source",
  attribution_url_candidate: "https://e2e-scan.example.com/rights",
  embed: {
    candidate_url: `${canonicalUrl}/embed`,
    discovery: "link",
    sandbox_profile: "v1:allow-scripts",
    status: "pass",
  },
  preview: {
    r2_key: null,
    content_type: null,
    width: null,
    height: null,
    creator_confirmation_required: true,
  },
  rights_candidates: {
    evidence_url: null,
    embed_allowed: null,
    commercial_use: null,
    modification_allowed: null,
    citation_required: null,
    verification_status: "unverified",
  },
  issues: [
    { code: "rights_evidence_missing", field: "rights" },
    { code: "ownership_unconfirmed", field: "authorization" },
  ],
  raw_content_stored: false,
  auto_publish: false,
});

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function seedScan(id: string, status: "needs_confirmation" | "needs_changes", url: string): void {
  const command = `
    INSERT INTO url_scan_jobs (
      id, creator_id, requested_url, requested_url_normalized, requested_hostname,
      status, contract_version, attempt_count, result_json, created_at, started_at,
      completed_at, expires_at, updated_at
    ) VALUES (
      ${sql(id)}, ${sql(creatorProfileId)}, ${sql(url)}, ${sql(url)}, 'e2e-scan.example.com',
      ${sql(status)}, 1, 1, ${sql(resultJson)}, ${sql(now)}, ${sql(now)},
      ${sql(now)}, ${sql(expiresAt)}, ${sql(now)}
    );
  `;
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "d1", "execute", "DB", "--local", "--command", command],
    { stdio: "pipe" },
  );
}

function seedAuthFixtures(): void {
  const creatorHash = createHash("sha256").update(creatorSession).digest("base64url");
  const adminHash = createHash("sha256").update(adminSession).digest("base64url");
  const command = `
    INSERT INTO profiles (id, role, display_name, website_url, created_at) VALUES
      (${sql(creatorProfileId)}, 'creator', 'E2E Creator', 'https://example.com', '2026-09-15T00:00:00.000Z'),
      (${sql(adminProfileId)}, 'admin', 'E2E Admin', 'https://example.com', '2026-09-15T00:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET
      role = excluded.role, display_name = excluded.display_name, website_url = excluded.website_url;
    INSERT INTO auth_sessions (id, profile_id, token_hash, expires_at, created_at) VALUES
      ('e2e-session-creator', ${sql(creatorProfileId)}, ${sql(creatorHash)}, '2099-01-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z'),
      ('e2e-session-admin', ${sql(adminProfileId)}, ${sql(adminHash)}, '2099-01-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET
      profile_id = excluded.profile_id, token_hash = excluded.token_hash,
      expires_at = excluded.expires_at;
  `;
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "d1", "execute", "DB", "--local", "--command", command],
    { stdio: "pipe" },
  );
}

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
  if (!condition) throw new Error(`URL-scan E2E failed: ${message}`);
}

function submissionBody(session: string): Record<string, unknown> {
  return {
    csrf_token: csrfToken(session),
    canonical_url: canonicalUrl,
    asset_type: "calculator",
    title,
    description: "A calculator submitted through the URL-scan confirmation gate.",
    embed_url: `${canonicalUrl}/embed`,
    preview_url: `${canonicalUrl}/preview.png`,
    attribution_name: "E2E Scan Source",
    attribution_url: "https://e2e-scan.example.com/rights",
    attribution_terms: "Credit E2E Scan Source — CC BY 4.0",
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
  };
}

async function run(): Promise<void> {
  seedAuthFixtures();
  seedScan(scanId, "needs_confirmation", canonicalUrl);
  seedScan(blockedScanId, "needs_changes", `${canonicalUrl}/blocked`);

  const crossOwner = await request(`/api/url-scans/${scanId}/convert`, {
    method: "POST",
    session: adminSession,
    body: submissionBody(adminSession),
  });
  assert(
    crossOwner.response.status === 404,
    `another creator can discover or convert the scan (${crossOwner.response.status}: ${crossOwner.text.slice(0, 200)})`,
  );

  const missingConfirmationBody = submissionBody(creatorSession);
  missingConfirmationBody.preview_display_authorized = false;
  const missingConfirmation = await request(`/api/url-scans/${scanId}/convert`, {
    method: "POST",
    session: creatorSession,
    body: missingConfirmationBody,
  });
  assert(missingConfirmation.response.status === 400, "missing preview authorization was accepted");

  const swappedBody = submissionBody(creatorSession);
  swappedBody.canonical_url = "https://attacker.example.net/different-tool";
  const swapped = await request(`/api/url-scans/${scanId}/convert`, {
    method: "POST",
    session: creatorSession,
    body: swappedBody,
  });
  assert(swapped.response.status === 409, "canonical URL swap was accepted");

  const blocked = await request(`/api/url-scans/${blockedScanId}/convert`, {
    method: "POST",
    session: creatorSession,
    body: { ...submissionBody(creatorSession), canonical_url: `${canonicalUrl}/blocked` },
  });
  assert(blocked.response.status === 409, "needs_changes scan was converted");

  const converted = await request(`/api/url-scans/${scanId}/convert`, {
    method: "POST",
    session: creatorSession,
    body: submissionBody(creatorSession),
  });
  assert(
    converted.response.status === 201,
    `valid conversion returned ${converted.response.status}`,
  );
  const convertedPayload = JSON.parse(converted.text) as {
    submission_id?: unknown;
    asset_slug?: unknown;
    auto_publish?: unknown;
  };
  assert(typeof convertedPayload.submission_id === "string", "submission id is missing");
  assert(convertedPayload.auto_publish === true, "passing conversion was not auto-published");
  assert(typeof convertedPayload.asset_slug === "string", "published asset slug is missing");

  const repeated = await request(`/api/url-scans/${scanId}/convert`, {
    method: "POST",
    session: creatorSession,
    body: submissionBody(creatorSession),
  });
  assert(repeated.response.status === 409, "converted scan was accepted twice");

  const queue = await request("/admin/submissions", { session: adminSession });
  assert(queue.response.status === 200, `admin queue returned ${queue.response.status}`);
  assert(!queue.text.includes(title), "auto-published submission remained in the admin queue");

  const published = await request(`/asset/${convertedPayload.asset_slug}`);
  assert(published.response.status === 200, "auto-published scanned asset is not public");
  assert(published.text.includes(title), "auto-published scanned asset title is missing");

  const adminScanUrl = `https://e2e-admin-scan.example.com/tools/${stamp}`;
  const crossOwnerRescan = await request("/api/url-scans", {
    method: "POST",
    session: adminSession,
    body: {
      csrf_token: csrfToken(adminSession),
      url: adminScanUrl,
      rescan_of: blockedScanId,
    },
  });
  assert(crossOwnerRescan.response.status === 404, "cross-owner rescan was not hidden");

  const cleanAdminScan = await request("/api/url-scans", {
    method: "POST",
    session: adminSession,
    body: { csrf_token: csrfToken(adminSession), url: adminScanUrl },
  });
  assert(
    cleanAdminScan.response.status === 202,
    "rejected cross-owner rescan left a hidden active queue row",
  );

  console.log(`URL-scan conversion E2E passed for ${scanId} (${baseUrl}).`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
