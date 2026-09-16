# G1 URL-first creator onboarding contract

Status: accepted for implementation  
Design and security owner: **SOL**  
Routine UI, migrations and deterministic tests after this contract: **LUNA**  
Critical scanner and launch review: **SOL**  
Contract version: **1**

## Decision

The creator experience may begin with one public HTTPS tool URL. The marketplace may then produce a
bounded, untrusted draft containing metadata, embed, preview and rights candidates. URL-only means
**one URL to start**, not automatic publication.

Every scan remains non-public. A creator must confirm the generated preview, source identity,
attribution, explicit usage-rights declarations and authorization before the existing submission
flow can be created. The existing admin moderation and publication gate remains authoritative.

A scan, AI extraction or publisher manifest must never:

- create a public asset;
- mark rights `safe` or `restricted`;
- assert ownership;
- enable embed-copy or citation-copy actions; or
- weaken the fixed `sandbox="allow-scripts"` profile.

The normative cases are in
[`data/benchmarks/url-scan-security-v1.json`](../data/benchmarks/url-scan-security-v1.json). The
runtime constants are in
[`src/lib/submissions/url-scan-contract.ts`](../src/lib/submissions/url-scan-contract.ts). A future
implementation that conflicts with either must fail closed and return to SOL.

## Product boundary

The scanner may automate:

- canonical URL, title, description, asset type and brand candidates;
- discovery of a source-hosted embed candidate;
- a real preview screenshot stored in a dedicated private R2 bucket;
- deterministic inspection of frame policy, runtime errors and basic interactivity;
- discovery of public item-level rights evidence and attribution candidates; and
- form prefill plus specific creator-facing remediation instructions.

The scanner cannot reliably create a missing route on another domain, override CSP or
`X-Frame-Options`, prove ownership, decide legal permission, or prove that a calculator is factually
correct. Those results remain creator declarations plus admin-reviewed evidence.

## Cloudflare architecture

Cloudflare Browser Run can render dynamic pages and return screenshots, HTML, Markdown and
accessibility data. Cloudflare Queues are suitable for moving a bounded, retryable scan out of the
interactive request path:

- <https://developers.cloudflare.com/browser-run/>
- <https://developers.cloudflare.com/browser-run/quick-actions/snapshot/>
- <https://developers.cloudflare.com/queues/>

The implementation uses four isolated responsibilities:

```text
Authenticated marketplace Worker
  -> validates URL, CSRF, ownership and quota
  -> writes url_scan_jobs in D1
  -> sends opaque job ID + normalized URL to scan-jobs Queue

Dedicated scanner Worker
  -> has Browser Run + scan-jobs consumer + private preview R2 only
  -> has no GitHub OAuth secret, AUTH_SECRET, D1 binding or marketplace session access
  -> returns bounded structured output through scan-results Queue

Marketplace result consumer
  -> revalidates schema and job state
  -> stores bounded result JSON in D1
  -> never trusts a scanner decision as rights approval

Creator confirmation UI
  -> shows candidates and exact failures
  -> converts a confirmed draft into the existing pending submission flow
```

The scanner and result consumer must use separate queue bindings. Screenshot bytes never travel in
a Queue message; the scanner writes them to a dedicated private R2 bucket and sends only an opaque
object key. Unconfirmed screenshots expire after seven days. A confirmed preview is retained only
after the creator explicitly authorizes marketplace display.

## Trust boundaries

| Boundary                   | Untrusted data                         | Required control                                           |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| Creator to scan request    | URL, headers, route state              | Auth, CSRF, strict JSON, 8 KiB body cap, quota             |
| Marketplace to Queue       | Job ID and normalized URL              | Versioned message, no cookies, tokens or page text         |
| Queue to scanner           | Entire message                         | Strict schema, current job version, bounded attempts       |
| Scanner to remote page     | DNS, redirects, HTML, JS, subresources | Public HTTPS only, isolation, request interception, limits |
| Page to extraction         | DOM text and metadata                  | Plain data only; no instruction authority                  |
| Scanner to R2              | Generated screenshot                   | Dedicated private bucket, opaque key, size/type limits     |
| Scanner result to D1       | All candidate fields                   | Closed schema, size cap, text normalization, no raw HTML   |
| Scan to submission         | Generated candidate values             | Creator confirmation plus existing server validation       |
| Submission to public asset | Creator declarations and scan output   | Existing admin moderation; never automatic                 |

## Network and browser security contract

The dedicated scanner may navigate only after all of these controls pass:

1. Normalize with the platform URL parser and accept only public `https:` URLs without credentials
   or non-default ports.
2. Resolve the hostname before the first request and every redirect. Reject any answer set that
   contains loopback, private, link-local, carrier-grade NAT, documentation, benchmark, multicast,
   reserved, unspecified or metadata addresses.
3. Intercept every browser request before it is sent. Apply the same scheme, credential, port,
   hostname and resolved-address checks to documents, scripts, frames, images, styles and XHR/fetch.
4. Follow at most three redirects. Revalidate each target. A redirect or subresource to a blocked
   destination is never requested.
5. Use a fresh browser context with no cookies, credentials, authorization headers, client
   certificates, persisted cache or prior storage. Never expose marketplace secrets to the browser.
6. Block popups, downloads, notifications, camera, microphone, geolocation, payment, USB and
   top-level navigation outside the bounded navigation flow.
7. Abort after 10 seconds for navigation or 30 seconds for the complete job, 80 requests, a 2 MiB
   main document, 12 MiB declared aggregate transfer or a 2 MiB preview.
8. Allow only HTML for the navigated document and PNG/JPEG for a generated preview. Never store
   executable page content, response bodies, raw HTML, raw Markdown or submitted JavaScript.
9. Run the embed candidate in a separate parent document with exactly `sandbox="allow-scripts"`.
   Record frame-policy blocks, page errors, failed requests and a bounded interaction result.
10. Close the browser in `finally`. Retry only explicitly transient platform/network failures and
    stop after three attempts.

DNS validation alone does not eliminate rebinding. G2 may ship only if SOL verifies that the chosen
Browser Run/request-interception implementation either pins the validated destination or provides
an equivalent isolated control. Otherwise the production scanner must be restricted to verified
manifest domains or remain client-side. A documentation example that simply calls `page.goto()` on
a user URL is not sufficient for this product.

## Prompt-injection boundary

Page text, metadata, accessibility labels, linked manifests and rights prose are untrusted data.
They cannot change scanner rules, request other tools, request secrets, authorize additional URLs or
override rights policy. If an LLM is added later:

- it receives only bounded extracted text, never cookies, headers or credentials;
- it returns a strict schema with no tool access;
- all URLs are revalidated outside the model;
- rights booleans remain `null` unless confirmed by the creator and reviewed by an admin; and
- content that attempts to instruct the scanner is recorded as `prompt_injection_ignored`.

V1 should prefer deterministic metadata, JSON-LD, link relations and DOM heuristics over an LLM.

## D1 schema contract for G2

G2 may implement this schema through a forward-only migration:

```text
url_scan_jobs
  id                         TEXT primary key
  creator_id                 TEXT not null -> profiles(id)
  requested_url              TEXT not null
  requested_url_normalized   TEXT not null
  requested_hostname         TEXT not null
  status                     queued | running | needs_confirmation | needs_changes |
                             failed | expired | converted
  contract_version           INTEGER not null = 1
  attempt_count              INTEGER not null default 0
  result_json                TEXT nullable, valid JSON, maximum 64 KiB in application code
  error_code                 TEXT nullable, bounded stable code only
  preview_r2_key             TEXT nullable, opaque marketplace-generated key only
  submission_id              TEXT nullable -> submissions(id)
  created_at                 TEXT not null
  started_at                 TEXT nullable
  completed_at               TEXT nullable
  expires_at                 TEXT not null
  updated_at                 TEXT not null
```

Required indexes:

- `(creator_id, created_at)` for the rolling scan quota;
- `(status, created_at)` for job recovery and expiry;
- `(creator_id, requested_url_normalized, status)` for active-job deduplication; and
- unique non-null `submission_id` so a scan converts at most once.

No raw page content, screenshot bytes, IP address, cookies, browser trace or publisher identity is
stored in D1. Logs contain job ID, stage, stable issue code, attempt and duration only. Query strings
are excluded from logs.

## Queue message contracts

Job message:

```json
{
  "schema_version": 1,
  "job_id": "opaque UUID",
  "requested_url": "normalized public HTTPS URL",
  "attempt": 1
}
```

Result message:

```json
{
  "schema_version": 1,
  "job_id": "opaque UUID",
  "status": "needs_confirmation",
  "result": "bounded UrlScanResultV1 object or null",
  "error_code": null,
  "preview_r2_key": "unconfirmed/opaque-key.png"
}
```

Queue messages never include authentication state, creator profile data, CSRF values, secrets,
cookies, raw HTML, Markdown, screenshots or browser logs.

## Result and rights rules

`UrlScanResultV1` is a suggestion packet. Every text value is NFC-normalized, bounded plain text.
Every URL is normalized again by the marketplace Worker before display or conversion.

Rights extraction is deliberately asymmetric:

- absence or ambiguity becomes `null`, never `false` or `true`;
- extracted license text is evidence candidate text, not a public decision;
- commercial use, embedding, modification and citation remain unverified;
- a preview always requires creator authorization before retention/display; and
- a manifest reduces typing but does not prove domain ownership or publish an asset.

Conversion creates the same structured pending submission used today. It does not create a second
rights model or bypass `validateSubmissionPayload`, duplicate checks, rate limits, sandbox
attestation, admin sandbox verification or promotion validation.

## Optional publisher manifest

G3 may recognize either a same-site link relation or
`/.well-known/publisher-asset.json`. It is optional and versioned. The scanner accepts only fields
already supported by the submission schema: canonical URL, embed URL, preview URL, asset type,
title, description, attribution name/URL/terms and an item-level rights evidence URL.

Manifest rules:

- manifest URL and canonical URL must be the same registrable site;
- embed and preview hosts must be same-site or explicitly flagged for admin review;
- unknown fields are rejected;
- redirects and network limits remain unchanged;
- rights are candidates only; and
- the creator still confirms authorization and the final generated fields.

## State machine

```text
create -> queued
queued -> running                    scanner claims job
running -> needs_confirmation        bounded candidate packet available
running -> needs_changes             technical/remediation issue found
running -> failed                    terminal validation or retry exhaustion
running -> queued                    transient retry, maximum three attempts
needs_confirmation -> converted      creator confirms into one pending submission
needs_changes -> queued              creator changes URL and explicitly rescans
queued|needs_* -> expired             retention cleanup
```

Only the owner may read or convert a scan. A missing scan and another creator's scan both return
`404`. Terminal rows are immutable except for retention deletion. A converted job stores the
resulting submission ID and cannot convert again.

## Abuse, retention and operational limits

- Maximum ten requested scans per GitHub creator in a rolling 24-hour window.
- Maximum one active scan per creator; identical active URL requests return the existing job.
- Scanner jobs use at most three attempts and a dead-letter queue.
- Unconfirmed previews expire after seven days.
- Inactive scan rows expire after 30 days unless linked to a submission audit record.
- Do not store creator or publisher IP addresses solely for limiting.
- Repeated abuse may be blocked at the account level without exposing internal reason details.
- Failed jobs use stable safe codes; they never return internal addresses, DNS answers, stack
  traces, response bodies or browser console contents to the creator.

## G1 acceptance gates

- Contract constants, normative cases and prose use the same version.
- Cases cover mixed DNS, redirect-to-private, private subresources, frame blocking, sandbox storage
  failure, missing rights evidence, manifest non-publication and prompt injection.
- Every normative case has `autoPublish = false`.
- Existing submission, moderation and publication security contracts remain stricter where they
  overlap.
- No Cloudflare binding, production queue, browser, R2 bucket, migration or runtime fetch is added
  in G1. Those begin only after this contract passes CI.

## Remaining implementation allocation

1. **G2 — SOL — complete:** isolated Queue/Browser Run/R2 scanner, network controls, D1 job
   migration, result consumer, private preview lifecycle and production queue verification.
2. **G3 — LUNA — next:** URL-only form, progress/result UI, deterministic autofill, remediation copy and
   optional manifest documentation against the approved contract.
3. **G4 — SOL:** rights/confirmation conversion gate, adversarial E2E suite and final security
   review before enabling URL-only onboarding as the primary submission path.
