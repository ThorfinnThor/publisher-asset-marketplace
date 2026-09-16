# Submission pre-screening

Status: accepted for production implementation  
Model allocation: SOL security design, LUNA implementation

## Boundary

Pre-screening is deterministic and performs no outbound server-side fetches. Submitted URLs remain
untrusted until manual moderation. This preserves the existing SSRF boundary and avoids treating a
temporary HTTP response as rights evidence.

## Blocking requirements

The submission API rejects missing source previews, non-public or non-HTTPS URLs, credentials or
non-default ports in URLs, raw HTML in text fields, invalid field lengths, missing authorization,
duplicates, and submissions above the rolling rate limit.

The creator must load the current embed URL in the submission form using the marketplace's exact
`sandbox="allow-scripts"` profile, interact with the asset, and explicitly confirm that it remains
usable without browser storage, cookies, authentication, forms, popups, downloads, or same-origin
access. The API rejects a missing or false confirmation.

## Automated review checks

Every accepted submission stores a versioned checklist. It compares canonical, embed, preview and
attribution hosts; checks whether the preview URL looks like a direct image; flags promotional or
link-manipulation attribution language; and highlights restricted embed or commercial-use
declarations. A submission is marked `pass` only when every deterministic check passes. Otherwise it
is marked `review` with the specific checks that need attention.

## Manual approval remains authoritative

Pre-screening never proves ownership, availability, licensing, content type or factual accuracy. An
admin must still inspect the source and record rights evidence before approval. The checklist reduces
triage work; it does not auto-publish assets or weaken the safe/restricted publication boundary.

The browser regression test in `scripts/e2e-embed-sandbox.ts` runs on every CI push. It uses two
different local origins and a real headless Chromium instance to prove that the fixed sandbox allows
a storage-safe interactive embed and blocks an embed that directly requires `sessionStorage`.
