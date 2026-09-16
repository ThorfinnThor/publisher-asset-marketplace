# G4 — confirmation conversion gate and final security review

Status: complete  
Critical review owner: **SOL**  
Contract version: **1**

## Conversion gate

`POST /api/url-scans/:id/convert` converts exactly one owned, unexpired
`needs_confirmation` scan into the existing pending submission model. It never creates a public
asset. The endpoint applies the same CSRF, bounded-body, strict-field, URL, metadata, rights,
sandbox, duplicate and rolling submission-limit validation as a manual submission.

The creator must explicitly confirm all of the following:

- source or brand identity;
- attribution URL and terms for the exact asset;
- marketplace display of the submitted public preview image;
- every usage-rights boolean;
- fixed `sandbox="allow-scripts"` compatibility; and
- authorization to submit the asset.

Scanner and manifest rights candidates remain unverified and are never copied into declared rights.
The confirmed rights JSON records the source scan ID for audit provenance.
New submissions use authorization version `2`; existing version-1 rows retain their legacy manual
review gate so the rollout does not strand an already pending canonical URL.

## Atomicity and ownership

The D1 conversion uses a conditional submission insert and scan update in one `DB.batch()`
transaction. Both statements require the same creator, scan ID, contract version, state, expiry and
empty `submission_id`. Concurrent or repeated conversions therefore cannot create a second
submission. Another creator receives the same `404` as a missing scan.

The submitted canonical URL must equal the requested URL, final URL or canonical candidate from the
stored scan packet after normal validation. Switching to an unrelated canonical URL requires a new
scan.

## Remediation and rescan

A `needs_changes` scan cannot convert. The creator can explicitly rescan after correcting the URL
or source page. Rescans create a new row, expire the replaced row and count toward the existing
ten-scans-per-24-hours limit.

## Preview boundary

The private R2 screenshot is a temporary review aid and is never written into a public submission.
The creator must provide a direct public HTTPS PNG/JPG-style preview URL and separately authorize
its display. Admin review shows URL-scan provenance but still requires independent rights evidence
and a fresh sandbox interaction before approval.

## Adversarial coverage

The benchmark and automated tests cover:

- cross-owner conversion;
- missing confirmations;
- canonical swapping;
- `needs_changes` conversion attempts;
- malformed scan result JSON;
- repeated/concurrent conversion;
- rejected rescans leaving no hidden queue row;
- private scanner-preview publication attempts; and
- preservation of `auto_publish: false`.

`npm run e2e:url-scan-conversion` runs the complete conversion gate against local D1 and refuses
remote URLs. The existing admin moderation remains the only path that can publish an asset.

## Final scanner hardening

The final review added Cloudflare Browser Run session guardrails for the submitted host, its
subdomains and the maintained `common-cdns` set. The provider-side allowlist complements DNS
validation and request interception; popup and dialog surfaces are closed immediately. The scanner
still has no D1, OAuth/session secrets or marketplace authentication access.
