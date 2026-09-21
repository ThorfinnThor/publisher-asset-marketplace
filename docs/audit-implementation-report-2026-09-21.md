# Audit Implementation Report

## Summary

The 13 findings in `CiteSupply_QA_Code_Audit_2026-09-19.md` were checked against the current repository rather than accepted as instructions. The audit inspected revision `ea0b0ab`; implementation started from the newer `ed1f265` revision, so every finding was revalidated against current code.

- Findings reviewed: 13
- Approved as written: 7
- Approved with modification: 6
- Rejected: 0
- Considered dangerous: 0
- Whole findings requiring a human decision: 0
- Findings implemented: 13
- Remaining human decision: 1 follow-up within CS-03 (the long-term R2 garbage-collection design)

No dependency or database-schema change was required.

## Audit Review and Implementation

### CS-01 — Rights obligations are rendered as permissions

- Verdict: ✅ YES — Makes Sense
- Risk: LOW
- Why: `attribution_required` and `citation_required` were passed through permission wording.
- Audit recommendation: Separate permission and obligation semantics.
- Changes made: Added dedicated permission/obligation labels and used obligation rows for attribution and citation.
- Files changed: `src/lib/assets/rights-labels.ts`, `src/app/asset/[slug]/page.tsx`, `test/rights-labels.test.ts`.
- Tests/verification: Unit coverage for true, false and unknown values; type check and build.

### CS-02 — Upload-shaped preview URLs are treated as verified creator uploads

- Verdict: ⚠️ YES, BUT MODIFY
- Risk: HIGH
- Why: The gap was real, but rejecting all pre-existing uploads would break valid legacy objects.
- Safer approach: Resolve internal preview URLs against R2, verify existence, creator ownership, content type, size and signature-validation metadata. Accept legacy objects only when they carry the metadata written by the previous validated upload path. Keep external preview URLs explicitly separate.
- Changes made: The shared verified pre-screen is now used by create, edit, URL-scan conversion, admin auto-publish and manual approval. R2 failures return 503 and do not publish.
- Files changed: `src/lib/submissions/marketplace-preview.ts`, `src/lib/submissions/server-pre-screen.ts`, `src/lib/submissions/pre-screen.ts`, preview upload and all publication API routes, `test/marketplace-preview.test.ts`, `test/submission-pre-screen.test.ts`.
- Tests/verification: Missing, foreign-owner, unverified and valid stored-object cases; creator and scan-conversion E2Es.

### CS-03 — Preview cleanup can remove an image still referenced by another asset

- Verdict: ⚠️ YES, BUT MODIFY
- Risk: MEDIUM
- Why: Immediate deletion is unsafe. A full reference registry and concurrent garbage collector would add schema and operational complexity beyond a targeted fix.
- Safer approach: Stop synchronous R2 deletion on edit/delete. Orphaned images are retained, preventing data loss. Design grace-period garbage collection separately.
- Changes made: Removed the destructive preview cleanup calls and helper from creator edit/delete.
- Files changed: `src/app/api/creator/assets/[slug]/route.ts`.
- Tests/verification: Existing creator ownership/deletion tests plus full suite and creator publication E2E. No R2 object is deleted by these routes now.

### CS-04 — Search discards the reviewed embed origin

- Verdict: ✅ YES — Makes Sense
- Risk: LOW
- Why: All search projections replaced a stored authorization field with `NULL`.
- Changes made: Ranked, trigram and browse projections preserve `a.embed_origin`; embed eligibility logic itself was not weakened.
- Files changed: `src/lib/search/search-assets.ts`, `scripts/lib/search-benchmark-db.ts`, `test/search-assets.test.ts`.
- Tests/verification: SQL contract tests and the search-quality SQLite suite.

### CS-05 — Search has no continuation beyond its first result page

- Verdict: ⚠️ YES, BUT MODIFY
- Risk: MEDIUM
- Why: Continuation is useful, but a ranking rewrite or total-count query was unnecessary.
- Safer approach: Preserve the existing ranked cursor and add stable keyset pagination for browse results. Preserve filters in the Next link and label the visible count as “shown” when more results exist. Legacy ranked cursors remain readable.
- Changes made: Added cursor modes, limit-plus-one detection, stable browse ordering and the search-page continuation control.
- Files changed: `src/lib/search/search-assets.ts`, `src/app/search/page.tsx`, `test/search-assets.test.ts`.
- Tests/verification: Cursor and browse query tests, type check and build.

### CS-06 — Check and internal-edit timestamps masquerade as source freshness

- Verdict: ✅ YES — Makes Sense
- Risk: MEDIUM
- Why: `last_checked_at` and internal `updated_at` do not prove source-data freshness.
- Changes made: Search/detail/related queries now return raw `source_updated_at`; freshness filters use only that field. `last_checked_at` remains separately available.
- Files changed: `src/lib/search/search-assets.ts`, `src/lib/assets/get-asset.ts`, `test/search-assets.test.ts`.
- Tests/verification: SQL contract tests, full unit suite and build.

### CS-07 — Infrastructure errors are collapsed into missing or signed-out states

- Verdict: ⚠️ YES, BUT MODIFY
- Risk: MEDIUM
- Why: The ambiguity was real, but a new application-wide result type would be disproportionate.
- Safer approach: Let page data failures reach route error boundaries; return a logged `503 authentication_unavailable` for auth-storage failures while retaining 401 for a genuine absent session and 404 for genuine absence.
- Changes made: Added asset/submit error boundaries and targeted API authentication error handling.
- Files changed: asset page/error, submit page/error, submission, preview, creator, URL-conversion and admin API routes.
- Tests/verification: URL-scan E2E explicitly distinguishes cross-owner 404 from operational failure; full type/lint/build checks.

### CS-08 — Validation errors lose field identity

- Verdict: ✅ YES — Makes Sense
- Risk: MEDIUM
- Why: The validator already knew the field, but the API discarded it.
- Changes made: Added a stable `field_errors` response, inline messages, `aria-invalid`, `aria-describedby`, an announced summary and first-invalid-field focus. Create and edit use the same contract.
- Files changed: `src/lib/submissions/validate.ts`, `src/lib/submissions/validation-errors.ts`, submission/create/edit/conversion routes, `src/components/submission-form.tsx`, `src/app/globals.css`.
- Tests/verification: Type check, lint, full unit suite and creator E2E.

### CS-09 — Every publish/edit rebuilds the entire fuzzy index in two non-atomic writes

- Verdict: ✅ YES — Makes Sense
- Risk: MEDIUM
- Why: The selected-asset query builder already existed; request paths were calling the global helper.
- Changes made: Added a selected-asset D1 `batch()` helper and switched all per-asset publication/update/review paths to it. Full rebuilds remain available for maintenance/import jobs.
- Files changed: `src/lib/search/search-index.ts`, affected publication API routes, `test/search-index.test.ts`.
- Tests/verification: Tests assert one two-statement D1 batch and a no-op for empty input; full suite passed. Cloudflare documents D1 batch execution as transactional.

### CS-10 — Commercial-use filter filters a different rights-status concept

- Verdict: ⚠️ YES, BUT MODIFY
- Risk: MEDIUM
- Why: Commercial permission and review status are independent. Promoting creator attestations to `safe` would weaken the rights model.
- Safer approach: Add an independent JSON commercial-use filter while retaining a separately and accurately named rights-review filter.
- Changes made: Added `commercial=allowed`, JSON rights filtering and renamed review-status labels.
- Files changed: `src/lib/search/ranking-contract.ts`, `src/lib/search/search-page.ts`, `src/lib/search/search-assets.ts`, `src/components/search-filter-fields.tsx`, `src/app/search/page.tsx`, search tests.
- Tests/verification: URL parsing and SQL contract tests.

### CS-11 — Production deployment does not depend on all CI end-to-end checks

- Verdict: ⚠️ YES, BUT MODIFY
- Risk: HIGH
- Why: Cross-workflow dependencies are fragile and branch protection is external to this repository.
- Safer approach: Run the release-critical E2Es inside the deployment job, before any remote migration or deployment, so the tested checkout is the deployed SHA. Retain CI and post-deploy smoke tests.
- Changes made: CI now includes creator submission E2E. Deploy applies local migrations and runs creator submission, URL conversion and sandbox E2Es before any production mutation.
- Files changed: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.
- Tests/verification: Creator submission and URL conversion passed locally. The Chrome sandbox command remains a required hosted-runner gate; local Chrome exited before producing a result.

### CS-12 — Search-result Cite control is permanently disabled

- Verdict: ✅ YES — Makes Sense
- Risk: LOW
- Why: The detail page already exposes a stable citation section.
- Changes made: Replaced the dead button with a link to `/asset/[slug]#citation-heading`.
- Files changed: `src/app/search/page.tsx`.
- Tests/verification: Type check and build confirm the target route/section contract.

### CS-13 — All asset pages use generic Asset metadata

- Verdict: ✅ YES — Makes Sense
- Risk: LOW
- Why: Eligible asset records already provide a safe title and description.
- Changes made: Added per-asset metadata generation; missing assets receive non-indexable not-found metadata. Unpublished records remain excluded by the existing published-asset query.
- Files changed: `src/app/asset/[slug]/page.tsx`.
- Tests/verification: Type check and production build.

## ❌ Rejected

None. Every finding described a real problem or justified improvement in the current code, although six proposed solutions were narrowed or changed to preserve compatibility.

## 🛑 Not Implemented Due to Risk

None as a whole finding.

## 👤 Requires Human Decision

### Long-term R2 orphan cleanup (follow-up to CS-03)

- Decision required: retention period and reference model for uploaded previews, including drafts, rejected submissions and cached public images.
- Option A: retain all uploads. Lowest data-loss risk; storage grows indefinitely.
- Option B: add a reference registry and grace-period garbage collector. Best long-term balance; requires a migration, scheduled job, concurrency rules and operational monitoring.
- Option C: synchronous reference counting. Faster cleanup, but greater mutation/concurrency risk.
- Recommendation: Option B after the retention policy is defined. The current safe behavior is retention, not deletion.

## Regression Check

- Formatting: passed (`prettier --check .`).
- Lint: passed (`eslint src scripts test worker scanner`).
- Type check: passed (`tsc --noEmit`).
- Unit/integration tests: 58 files, 324 tests passed.
- Build: completed successfully. Wrangler could not write its optional debug log under the sandboxed macOS preferences directory, but vinext completed all five build stages.
- Local D1 migrations: no pending migrations.
- Creator submission E2E: passed.
- URL-scan conversion E2E: passed, including ownership and duplicate-conversion checks.
- Embed sandbox E2E: passed on the hosted GitHub runner in both CI and the deployment gate. The local macOS Chrome process exited before returning a status, so the hosted Linux result is the release evidence.
- CI: passed for commit `a071fec6d230d0ebc6af19b30efb9f551633fc97` ([run 35659337902](https://github.com/ThorfinnThor/publisher-asset-marketplace/actions/runs/35659337902)).
- Production deployment: D1 migration, isolated scanner deployment, Worker deployment and all 19 production release-smoke checks passed for the same commit ([run 35659337934](https://github.com/ThorfinnThor/publisher-asset-marketplace/actions/runs/35659337934)).

## Changed Files

- `.github/workflows/ci.yml` — adds creator publication E2E.
- `.github/workflows/deploy.yml` — makes all release-critical E2Es pre-deploy gates.
- `scripts/e2e-submission.ts` — verifies sandbox confirmation at the API boundary without relying on streamed client-component text.
- `scripts/lib/search-benchmark-db.ts` — aligns the benchmark schema with `embed_origin`.
- `scripts/release-smoke.ts` — uses an active, rights-reviewed World Bank embed for production verification.
- `src/app/api/admin/submissions/[id]/auto-publish/route.ts` — verifies previews, distinguishes auth failures and updates only the selected search index.
- `src/app/api/admin/submissions/[id]/review/route.ts` — verifies previews before approval and uses selected index maintenance.
- `src/app/api/creator/assets/[slug]/route.ts` — safe preview lifecycle, field errors, auth distinction and selected index maintenance.
- `src/app/api/submission-previews/upload/route.ts` — records image-validation metadata and distinguishes auth failures.
- `src/app/api/submissions/route.ts` — verified previews, field errors, auth distinction and selected index maintenance.
- `src/app/api/url-scans/route.ts` — distinguishes absent authentication from auth-storage failure.
- `src/app/api/url-scans/[id]/convert/route.ts` — the same verified publication gate for scan conversion.
- `src/app/asset/[slug]/error.tsx` — recoverable asset infrastructure failure UI.
- `src/app/asset/[slug]/page.tsx` — obligation wording, dynamic metadata and correct error propagation.
- `src/app/globals.css` — accessible field-error styling.
- `src/app/search/page.tsx` — continuation UI, preserved filters and working citation links.
- `src/app/submit/error.tsx` — recoverable submit-page infrastructure failure UI.
- `src/app/submit/page.tsx` — stops presenting infrastructure failure as signed-out/missing scan state.
- `src/components/search-filter-fields.tsx` — separates commercial permission from review status.
- `src/components/submission-form.tsx` — field-level accessible server validation.
- `src/lib/assets/get-asset.ts` — keeps source freshness distinct.
- `src/lib/assets/rights-labels.ts` — distinct permission/obligation semantics.
- `src/lib/search/ranking-contract.ts` — adds the independent commercial-use filter.
- `src/lib/search/search-assets.ts` — embed origin, real freshness, filters and pagination.
- `src/lib/search/search-index.ts` — transactional selected-asset index maintenance.
- `src/lib/search/search-page.ts` — parses commercial-use filter state.
- `src/lib/submissions/marketplace-preview.ts` — R2 existence/ownership/type/size/validation verification.
- `src/lib/submissions/pre-screen.ts` — trusts internal preview URLs only after storage verification.
- `src/lib/submissions/server-pre-screen.ts` — shared async verified publication gate.
- `src/lib/submissions/validate.ts` — exports the field-aware failure contract.
- `src/lib/submissions/validation-errors.ts` — stable field-specific API messages.
- `test/marketplace-preview.test.ts` — preview integrity regression coverage.
- `test/rights-labels.test.ts` — permission/obligation regression coverage.
- `test/search-assets.test.ts` — origin, freshness, commercial filter and pagination coverage.
- `test/search-index.test.ts` — selected transactional batch coverage.
- `test/search-page.test.ts` — commercial filter parsing coverage.
- `test/submission-pre-screen.test.ts` — internal URL trust regression coverage.
- `test/validation-errors.test.ts` — stable field-specific API error coverage.

## Remaining Recommendations

1. Define the preview-retention policy and implement grace-period R2 garbage collection with a reference registry.
2. Add a browser-level accessibility test for the new inline validation states.
