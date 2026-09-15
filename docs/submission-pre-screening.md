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
