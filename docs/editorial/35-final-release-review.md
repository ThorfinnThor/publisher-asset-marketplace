# Step 36 — Final protected-preview release review

**Role:** Sol  
**Date:** 2026-09-26  
**Decision:** Approved for protected-preview deployment  
**Public article publication:** Not approved  
**Production data mutation:** None

## Outcome

The two Eurostat editorial candidates are approved only for deployment behind Cite Supply's
authenticated admin-preview boundary. They remain absent from navigation and the sitemap, carry
`noindex` and private-cache controls, and are unavailable to anonymous visitors. This approval does
not publish an article, alter a marketplace asset, change a rights decision, or make either preview
discoverable.

The final review independently rechecked the Step 32 external-source result, the Step 34 route and
security implementation, and the Step 35 responsive browser evidence. The inherited evidence is
hash-pinned in `private-eurostat-external-gate-inventory-v2.5.json`.

## Evidence refresh

The final reproducibility run refreshed source-retrieval metadata and therefore changed the hashes
of downstream fact packs, analysis, drafts, and rendered previews. The Eurostat observations,
calculations, article claims, rights basis, presentation, and route behavior did not change. Both
Eurostat datasets and the Commission reuse notice were fetched again over validated TLS; responses,
pinned payload hashes, required dimensions, freshness rules, and required reuse-policy language all
passed.

The rolling preview manifest, the route allowlist, and their tests now point to the refreshed
rendered hashes. Historical review artifacts remain unchanged so their recorded decisions continue
to be auditable rather than being silently rewritten.

## Final predeployment verification

- `npm run check` passed: Wrangler type generation, repository-wide formatting, ESLint,
  TypeScript, 67 Vitest files with 372 tests, and the production build.
- Draft schema/depth validation and static rendered-preview integrity checks passed. The two release
  candidates exceed the 500-word editorial minimum; the shorter source-lineage hold remains blocked.
- The live Eurostat external HTTP/TLS gate passed for both datasets and the reuse policy.
- Wrangler's generated-config dry run passed with the expected D1, R2, Queue, service, Analytics
  Engine, and assets bindings. `keep_vars` remains enabled; no secret values are present in source
  or generated configuration.
- Local submission and URL-scan conversion E2E tests passed against the built Worker and local D1.
- The macOS execution sandbox prevented newly spawned headless Chrome processes from exposing a
  DevTools target, so the browser submission/accessibility and embed-sandbox jobs are deliberately
  left to the same Linux CI jobs that gate deployment. Step 35's eight authenticated browser/view
  combinations remain valid evidence for the protected preview itself.
- The scoped whitespace check for authored source, configuration, tests, JSON, and non-evidence
  artifacts passed, as did the repository secret scan. Immutable upstream captures retain their
  source bytes and Markdown decision records retain intentional two-space line breaks, so those two
  categories are excluded from the whitespace-only check.

The immutable upstream HTML captures and generated, hash-bound preview HTML are excluded from
Prettier through `.prettierignore`. They remain byte-preserved evidence; all authored source,
configuration, tests, JSON, and Markdown still participate in the normal format gate.

## Operational boundary

The local shell has no Cloudflare API token, so Step 36 did not bypass CI to query or mutate remote
D1. Step 32's authenticated, hash-pinned production evidence remains the authority for production
asset identity and rights. Deployment must proceed through the repository workflow, which reruns
the full check and browser E2E suite before its production migration and Worker deployment stages.

After CI deployment, production verification must confirm both public release-smoke targets, the
production audit, the anonymous fail-closed variants of the private namespace, security headers,
robots exclusion, and sitemap absence. An authenticated production preview may be checked only with
an existing administrator session; no temporary production administrator or session may be created
for QA.

## Release decision

Proceed with one commit and the normal `main` deployment workflow. Stop if any CI gate fails. If CI
and post-deployment production checks pass, Step 36 and the 36-step editorial preparation workflow
are complete. A separate, explicit editorial approval is still required before either article may
be made public or added to the sitemap.
