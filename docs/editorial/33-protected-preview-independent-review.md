# Step 34 — Protected-preview independent review

**Role:** Sol  
**Date:** 2026-09-26  
**Decision:** Approved for Step 35 browser/accessibility/link QA  
**Publication effect:** None  
**Deployment:** Not performed

## Outcome

The corrected v2.3 identity contract and the local protected-preview implementation pass the
independent code, SEO, rights, and security review after one bounded hardening amendment. Neither
article is approved for release yet. The remaining gates are interactive QA in Step 35 and the
final release decision in Step 36.

The implementation follows the framework boundary: a Next App Router `route.ts` handler serves a
Web `Response`, awaits Promise-based dynamic params, and uses the `%5Feditorial` filesystem escape
to expose the private `/_editorial` URL segment. The Worker keeps its module handler and generated
binding types, awaits the framework handler, and wraps the response once. These choices align with
the official [Next.js Route Handler](https://nextjs.org/docs/app/api-reference/file-conventions/route),
[Next.js project-structure](https://nextjs.org/docs/app/getting-started/project-structure), and
[Cloudflare Workers best-practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
documentation reviewed on 2026-09-26.

## Review amendment S34-01

The Worker originally applied private headers only when the raw pathname matched the exact
canonical preview pattern. If the framework decoded a percent-encoded private path, an encoded
`/%5Feditorial/...` request could have missed the Worker-level private-header branch. The route
itself still failed closed, but the outer Worker could then replace its strict CSP and no-referrer
policy with the general public response policy.

The review changes `isPrivateEditorialPreviewPath` to protect the complete `/_editorial/`
namespace after up to two safe URI-decoding passes. Malformed escapes return `false` without an
exception. Tests now cover canonical, unknown, encoded, double-encoded, adjacent public, and
malformed paths. This is a defence-in-depth correction only; it changes no editorial, rights, or
production data.

## Security and privacy

- The preview resolves the existing D1-backed session and serves content only for `role=admin`.
- Missing sessions, creator sessions, unknown brief IDs, D1 lookup errors, and hash mismatches all
  fail as the same plain 404 response.
- The reviewed HTML is bundled and SHA-256 checked on every successful lookup. The two hashes still
  equal the v2.3 contract and rendered-preview manifest.
- Private responses are `private, no-store`, non-indexable, non-frameable, no-referrer, no-script,
  no-connect, no-form, and `nosniff`.
- There is no static secret in the URL, no public navigation link, and no sitemap entry.
- The route performs no outbound request and introduces no secret, binding, background task, or
  high-volume logging path.

Google documents that a crawler cannot observe `noindex` on a URL blocked by `robots.txt`. For that
reason, the review does **not** treat the robots rule or `X-Robots-Tag` as the confidentiality
boundary. The authenticated admin check and indistinguishable 404 are primary. The crawler controls
remain supplementary. See Google's [noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
and [content-control guidance](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share).

## SEO isolation

Repository inspection finds no public link to `/_editorial/preview/...`. The sitemap selects only
its explicit static paths and published `search_indexable=1` assets; it does not enumerate the
private namespace. `robots.txt` disallows `/_editorial/`, and both the route response and HTML carry
`noindex`. Because unauthenticated crawlers receive 404 rather than article content, no canonical
article URL or duplicate indexable document exists.

## Rights and content integrity

The v2.3 contract correctly separates the official Eurostat dataset URL persisted in
`assets.canonical_url` from the derived public Cite Supply asset URL. The immutable Step-32 evidence
remains authoritative for the passed production identity, asset-level rights, Eurostat reuse-policy,
and source-freshness gates. This review changed none of those records.

The rendered files remain byte-identical to their approved hashes. Static editorial checks confirm
one H1, accessible SVG title/description, equivalent data tables, adjacent method/source material,
and exact metric references. The renewables article has 586 substantive words and the HICP article
715, both above the 500-word minimum.

The v2.3 file still contains `not_run` and null values in reusable root contract/source-query slots.
Those are templates inherited from the execution contract, not the gate result. The per-preview
states and `private-eurostat-external-gate-results-step32.json` are authoritative. This is safe but
easy to misread; Step 36 must use the explicit Step-32 and Step-34 decision artifacts rather than
inferring state from the template slots.

## Verification

- Latest inspected `@cloudflare/workers-types`: `5.20260926.1`
- Targeted Vitest: 3 files, 13 tests passed
- Full Vitest: 67 files, 372 tests passed
- Wrangler generated-binding check: passed
- ESLint: passed
- TypeScript: passed
- Production build: passed; `/_editorial/preview/:briefId` detected
- Editorial static preview check: passed
- Draft schema check: passed
- Minimum-depth check: passed for both candidate articles
- `git diff --check`: passed

The repository-wide Prettier check is not used as a gate for byte-exact source snapshots: upstream
Eurostat HTML contains invalid-for-Prettier closing tags, and reformatting fetched JSON/HTML would
invalidate the recorded source hashes. The implementation and review files are checked separately.

No interactive browser, responsive, keyboard, screen-reader, console, network, or external-link
result is claimed here.

## Next gate

Step 35 (Sol): perform authenticated browser QA for both protected previews at 390×844, 768×1024,
1280×800, and 1440×900, including keyboard navigation, accessibility tree, console errors, failed
requests, and all external source links. Do not deploy.
