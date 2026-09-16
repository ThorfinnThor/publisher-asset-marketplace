# E2 submission security contract

Status: accepted for E3 implementation  
Owner model: SOL  
Applies to: creator submissions, moderation, publishing, and generated embed markup

## Decision

The MVP accepts only structured fields and absolute HTTPS URLs. It does not accept HTML,
JavaScript, iframe markup, uploads, or a URL that the application must fetch. Every new submission
starts in `pending` and requires manual moderation before it can create or change a public asset.

This keeps untrusted creator input inert at submission time and removes server-side request
forgery (SSRF) from the E3 request path. A future fetcher is a separate SOL-reviewed feature and
must implement the controls in [Future fetcher boundary](#future-fetcher-boundary).

The machine-readable examples in
[`data/benchmarks/submission-security-v1.json`](../data/benchmarks/submission-security-v1.json)
are normative. If prose and a fixture disagree, fail closed and return the decision to SOL.

## Trust boundaries

| Boundary                     | Trusted input                       | Untrusted input                | Required control                                                         |
| ---------------------------- | ----------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| Browser to creator mutation  | Server-side session                 | Body, headers, route params    | Authentication, same-origin check, schema validation, size limit         |
| Creator to D1                | Authenticated profile ID            | All submitted fields           | Prepared statements and ownership predicate                              |
| Admin to moderation mutation | Server-side profile role            | Submission ID, decision, notes | `role = admin`, allowed state transition, audit fields                   |
| Submission to public asset   | Admin decision                      | Creator rights claims and URLs | Explicit promotion transaction; never auto-publish                       |
| Asset to embed markup        | Published asset and reviewed rights | Stored URL and title           | Revalidate approved URL/origin; attribute escaping; deny blocked/unknown |
| Worker to external network   | None in E3                          | Creator-provided URL           | No fetch in MVP                                                          |

D1 does not provide row-level security for this application. Authorization is therefore enforced in
the application, and every creator update query includes both the submission ID and authenticated
creator ID. The actor ID and role always come from the server-side session, never from the request
body.

## Authenticated mutation contract

- Creator and admin writes use `POST` Server Actions. Equivalent route handlers may be used only if
  they implement the same checks.
- A valid `publisher_asset_session` cookie is required. Missing or expired sessions return `401`.
- The request `Origin` must exactly match the request URL origin. A missing, malformed, `null`, or
  cross-origin value returns `403`. Keep the session cookie `Secure`, `HttpOnly`, and `SameSite=Lax`.
- When a mutation is exposed outside the Server Action transport, require a random CSRF token bound
  to the session in addition to the Origin check.
- Read a maximum of 32 KiB for a submission payload. Reject a larger declared or observed body with
  `413` before parsing further.
- Parse into a strict schema: unknown fields are rejected. Never bind a client-supplied `creator_id`,
  `review_status`, `reviewed_by`, `asset_id`, or public asset status.
- Use D1 prepared statements. Authentication and authorization reads must use the primary database,
  not a stale read replica.
- Security-sensitive comparisons, including OAuth state signatures and CSRF tokens, use Web Crypto
  verification or a constant-time byte comparison.

## Authorization matrix

| Actor         | Create submission          | Read submission | Edit metadata                         | Moderate | Publish                   |
| ------------- | -------------------------- | --------------- | ------------------------------------- | -------- | ------------------------- |
| Anonymous     | No                         | No              | No                                    | No       | No                        |
| Creator owner | Yes                        | Own only        | Own `pending` or `needs_changes` only | No       | No                        |
| Other creator | Yes, as self               | No              | No                                    | No       | No                        |
| Admin         | No implicit creator action | Yes             | No creator impersonation              | Yes      | Through E5 promotion flow |

Use non-enumerating responses for creator reads and edits: an absent submission and another
creator's submission both return `404`. A non-admin moderation attempt returns `403`.

## State machine

```text
create -> pending
pending -> pending             creator edits own submission
needs_changes -> pending       creator edits and resubmits own submission
pending -> approved            admin only
pending -> rejected            admin only
pending -> needs_changes       admin only
approved -> public asset       E5 admin promotion transaction only
```

There is no automatic approval or publication. Rejected and approved submissions are immutable to
creators. An admin decision records `reviewed_at`, `reviewed_by`, a decision, and a non-empty reason.
Promotion revalidates all URLs and rights data rather than trusting values validated earlier.

## Field validation

All strings are converted to Unicode NFC, trimmed, and rejected if they contain C0/C1 control
characters other than ordinary spaces. No field accepts Markdown or HTML in V1. React text nodes
render stored text; `dangerouslySetInnerHTML`, `srcDoc`, DOM HTML parsing, and template concatenation
with raw creator input are prohibited.

| Field                     | Rule                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `canonical_url`           | Required normalized public HTTPS URL, maximum 2,048 characters          |
| `embed_url`               | Required normalized public HTTPS URL, maximum 2,048 characters          |
| `preview_url`             | Required normalized public HTTPS image URL, maximum 2,048 characters    |
| `attribution_url`         | Required normalized public HTTPS URL, maximum 2,048 characters          |
| `asset_type`              | One of `chart`, `calculator`, `table`, `dataset`, `benchmark`, `widget` |
| `title`                   | Plain text, 3-160 characters                                            |
| `description`             | Plain text, 20-2,000 characters                                         |
| `attribution_name`        | Plain text, 2-120 characters                                            |
| `attribution_terms`       | Plain text, 2-1,000 characters                                          |
| rights answers            | Explicit booleans; absence is invalid, not `false`                      |
| `sandbox_compatible`      | Must be exactly `true` after testing the fixed `allow-scripts` profile  |
| authorization attestation | Must be exactly `true`; record its version and timestamp                |

The rights object is closed and versioned. E3 writes:

```json
{
  "schema_version": 1,
  "embed_allowed": true,
  "commercial_use": true,
  "modification_allowed": false,
  "citation_required": true,
  "sandbox_compatible": true,
  "sandbox_profile": "v1:allow-scripts",
  "attribution_required": true,
  "attribution_terms": "Credit Example Source",
  "submitter_authorized": true,
  "attested_at": "server-generated ISO-8601 timestamp"
}
```

These are creator declarations, not verified rights. They must never produce a public "safe" badge
until moderation creates reviewed rights evidence.

## URL normalization and network-address rejection

Validation uses the platform `URL` parser and then applies these rules:

1. Require an absolute URL whose scheme is exactly `https:`. Reject `http:`, `javascript:`, `data:`,
   `file:`, `blob:`, protocol-relative values, backslash-confused values, and embedded whitespace.
2. Require a hostname. Reject username/password credentials and non-default ports; port `443` is
   removed during normalization.
3. Lowercase the hostname using the URL parser's ASCII/IDNA serialization. Remove the fragment.
   Preserve path and query because they may identify the asset. An empty path serializes as `/`.
4. Reject `localhost`, any subdomain of `.localhost`, names ending in `.local`, `.internal`, `.home`,
   or `.lan`, and single-label hostnames.
5. Reject literal IPv4 and IPv6 addresses in loopback, private, link-local, carrier-grade NAT,
   documentation, benchmark, multicast, reserved, or unspecified ranges. Reject IPv4 alternatives
   such as integer, hexadecimal, octal, or shortened notation after URL canonicalization.
6. Reject cloud metadata targets, including `169.254.169.254`, `metadata.google.internal`, and their
   normalized equivalents.

Because E3 performs no DNS or HTTP request, a public-looking domain that resolves privately cannot
cause SSRF at submission time. It remains `pending`; moderation must not open it through an
unprotected backend fetcher.

`canonical_url_normalized` is the serialized result and is checked case-insensitively for an
existing asset or submission. A duplicate returns `409` without revealing another creator's
identity or moderation state.

## Embed boundary

Creator-side route, preview, rights-evidence, and framing requirements are specified in
[Creator embed, preview, rights, and security standard v1](creator-embed-rights-security-standard-v1.md).

- A creator submits only an `embed_url`, never iframe markup.
- Approval snapshots an exact normalized embed origin for the asset. Public embed generation
  requires `status = published`, rights status `safe` or `restricted`, reviewed
  `embed_allowed = true`, and an exact origin match with that snapshot.
- Blocked, unknown, draft, review, or hidden assets cannot generate an embed action or markup.
- The embed URL must remain source-hosted according to the reviewed source/creator domain policy.
- Generated markup escapes every attribute and includes `title`, `loading="lazy"`, and
  `referrerpolicy="strict-origin-when-cross-origin"`.
- The default sandbox is `sandbox="allow-scripts"`. Do not add `allow-same-origin`, navigation,
  popups, downloads, forms, or storage capabilities automatically. A broader capability profile
  requires per-origin admin review in E5/E6.
- The public page CSP `frame-src` contains only the marketplace origin plus reviewed embed origins.
  Never frame creator-controlled content from the marketplace's own origin.

## Abuse controls and observability

- E3 allows at most 10 newly created submissions per authenticated creator in a rolling 24-hour
  window. Exceeding it returns `429` with a generic message.
- Failed validation is logged only as a reason code and request correlation ID. Do not log submitted
  descriptions, URLs with query strings, cookies, OAuth tokens, CSRF tokens, or secrets.
- Moderation and publication write durable audit records. A later migration may add a dedicated
  audit table; until then the submission decision fields are mandatory and append-only behavior is
  enforced by the mutation layer.
- Do not persist publisher identity or creator IP addresses solely for rate limiting.

## Future fetcher boundary

Adding server-side previews, metadata extraction, link checks, or screenshots reopens SSRF and is
out of E3 scope. Before any such request is shipped, SOL must approve a fetcher that:

- accepts only HTTPS and resolves DNS before the first request and every redirect;
- rejects all non-public IPv4/IPv6 results, mixed public/private answer sets, and metadata hosts;
- prevents DNS rebinding by connecting to the validated result or an equivalent platform control;
- follows at most three redirects, revalidating scheme, host, port, and resolved addresses each time;
- uses a five-second deadline, a 2 MiB response cap, and an allowlist of required MIME types;
- sends no user cookies, authorization headers, or internal headers;
- streams and aborts oversized bodies instead of buffering them; and
- records only bounded diagnostics without response bodies or sensitive query parameters.

If those guarantees cannot be implemented on the selected runtime, the fetcher must remain absent.

## Error contract

| Status | Meaning                                              |
| ------ | ---------------------------------------------------- |
| `400`  | Strict schema, text, URL, or state validation failed |
| `401`  | No valid creator session                             |
| `403`  | Origin/CSRF failed or actor lacks the required role  |
| `404`  | Submission is absent or not owned by the creator     |
| `409`  | Normalized canonical URL already exists              |
| `413`  | Request body exceeds 32 KiB                          |
| `429`  | Creator submission limit exceeded                    |
| `503`  | D1 or required service unavailable                   |

Responses expose a stable reason code and safe user message, never SQL, stack traces, secrets,
ownership, or internal moderation details.

## E3 acceptance checklist

- Implement the normative fixture cases and keep them as automated unit/integration tests.
- Create pending submissions only for authenticated creators and derive `creator_id` from session.
- Validate and normalize all URLs on the server; client validation is convenience only.
- Store plain text and explicit rights booleans; never accept executable content.
- Enforce origin/CSRF, ownership, state, duplicate, size, and rate-limit rules.
- Do not fetch submitted URLs and do not publish submissions.
- Keep the currently disabled form disabled until the mutation and its tests are deployed together.

Before launch, R1 must also verify security headers/CSP, Web Crypto signature verification, embed
origin snapshots, moderation audit integrity, and the absence of raw-HTML rendering paths.
