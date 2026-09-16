# URL-first onboarding G2: isolated scan worker

Status: implemented and deployed on 2026-09-16.

## Runtime boundary

The marketplace Worker owns authentication, CSRF validation, rate limits, D1 job state and the
conversion path. It can only produce scan jobs and consume bounded scan results.

The scanner Worker has exactly three bindings:

- Browser Run
- the private `publisher-asset-scan-previews` R2 bucket
- the `publisher-url-scan-results` Queue producer

It consumes `publisher-url-scan-jobs`. It has no D1 binding, GitHub OAuth binding, session secret,
route or public `workers.dev` endpoint.

## Network controls

Every creator URL, redirect and Browser Run subresource must be HTTPS, contain no credentials, use
the default HTTPS port and resolve only to public A/AAAA addresses. The scanner rejects reserved,
loopback, link-local, private, multicast and documentation ranges. DNS validation is cached only
inside one scan job and is never shared across requests.

Browser Run reports the local Browser Run proxy as `HTTPResponse.remoteAddress()` (`[::1]`) even
for a public origin. Therefore that value cannot be used as the origin server's address. The
scanner instead validates every browser request before continuing it and runs in the separate
Browser Run sandbox. This behavior was verified against the deployed service before removing the
false-positive response-address check.

## Bounded processing

The scanner enforces the G1 contract limits: three attempts, three redirects, 10-second
navigation timeout, 30-second job budget, 80 requests, declared response-size budgets, 64 KiB
result messages and 2 MiB previews. It stores only extracted scalar metadata plus a screenshot;
raw HTML and scripts are never persisted.

The embed check uses exactly `sandbox="allow-scripts"`. A scan can only finish as
`needs_confirmation`, `needs_changes` or `failed`; it cannot publish an asset.

## Storage and delivery

- `publisher-url-scan-jobs`: marketplace to scanner
- `publisher-url-scan-results`: scanner to marketplace
- matching dead-letter queues for both directions
- `publisher-asset-scan-previews`: private R2 bucket
- `unconfirmed/` objects expire automatically after seven days
- inactive D1 jobs expire after 30 days through the existing daily scheduled handler

The API endpoints are `POST /api/url-scans` and owner-only `GET /api/url-scans/:id`. The POST body
is limited to 8 KiB, allows one active scan per creator, and allows ten starts per 24 hours.
