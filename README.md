# Publisher Asset Marketplace

A publisher-first marketplace for reusable charts, calculators, benchmarks, datasets, tables,
and mini-tools. The first release indexes a small, audited set of source-hosted Our World in
Data embeds and validates the full search-to-publish flow before importing the complete corpus.

## Stack

- Next.js App Router API surface through vinext
- Cloudflare Workers for application hosting
- Cloudflare D1 for relational data and FTS5 search
- GitHub Actions for CI and Cloudflare deployment

Cloudflare currently recommends vinext for new Next.js applications on Workers. It is beta, so
the adapter is isolated behind standard App Router files and its compatibility is checked in CI.

## Local setup

```bash
npm install
npm run cf:typegen
npm run db:migrate:local
npm run ingest:dry-run
npm run audit:import -- --local
npm run dev
```

Run all checks with:

```bash
npm run check
```

Run the isolated creator submission E2E flow against a local Worker with
`npm run e2e:submission`; setup and cleanup instructions are in
[docs/e2e-submission.md](docs/e2e-submission.md). The test is local-only by default and covers
submission, pre-screening, admin approval, publication and the creator dashboard.
The non-mutating `npm run e2e:embed-sandbox` regression uses Chrome/Chromium to verify the exact
cross-origin `allow-scripts` sandbox and runs automatically in CI.

## Deployment

The GitHub deployment workflow expects repository secrets named `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Create the production D1 database, set its ID in `wrangler.jsonc` if
automatic provisioning is not enabled for the account, then run the workflow or `npm run deploy`.

The deployment workflow applies D1 migrations before deploying the Worker. Production deployment
is intentionally not run from a local developer machine by default.

## Import rights audit

Run the read-only B6 audit against local D1 with `npm run audit:import -- --local`. Use
`--remote` explicitly for production, `--output docs/import-audit-b6.md` to save the Markdown
report, and `--enforce-gate` when a closed Gate B should return a non-zero exit code. Public
rights badges remain disabled until Gate B is open.

The reviewed ten-asset OWID evidence set is documented in
[docs/owid-seed-rights-review.md](docs/owid-seed-rights-review.md). Run
`npm run rights:review -- --local` for a fail-closed dry run. A database write requires explicit
`--apply --local|--remote`; publication additionally requires `--publish` and is limited to
classifier-approved `safe` or `restricted` assets.

The normalized 3,000-asset corpus is stored in `data/seed/owid-all-3000.csv`, derived from the
tracked master workbook. Validate its exact count without fetching or writing with
`npm run ingest:corpus -- data/seed/owid-all-3000.csv --expected-count 3000`. The manually
dispatched `Import OWID corpus to Cloudflare` GitHub workflow fetches and upserts restartable,
bounded ranges, stores only the source fields needed for audit/refresh, then rebuilds the search
index once. Imported corpus rows remain fail-closed in
`draft`/`unknown` until an asset-level rights review explicitly publishes them; the workbook's
general legal-status column is source context and is not treated as authorization.

The B7 refresh job runs daily at 03:00 UTC from the Worker cron trigger. It refreshes stale OWID
assets first and then stale World Bank assets, hides only explicit 404 sources, and records each
executed outcome in `refresh_runs` and `refresh_results`. Run `npm run refresh:assets -- --local`
for an OWID dry run; use `--apply --remote` only for an intentional production write.

## Product boundaries

Read [docs/product-adr.md](docs/product-adr.md) before changing the data model, rights behavior,
search ranking, embed handling, or analytics definitions.

The accepted V1 search contract and fixed benchmark are documented in
[docs/search-ranking-spec.md](docs/search-ranking-spec.md).
The D1 query/function implementation is documented in [docs/search-sql-c2.md](docs/search-sql-c2.md).
Run `npm run search:review` after ranking changes to execute the production search function against
the fixed SQLite FTS5 fixture corpus and refresh
[docs/search-quality-review-c8.md](docs/search-quality-review-c8.md).

Demand intelligence starts from the versioned, meaning-preserving normalization contract in
[docs/query-normalization-spec.md](docs/query-normalization-spec.md). Search normalization and
demand aggregation keys are intentionally separate.

The D2 daily demand runner is documented in
[docs/demand-aggregation-d2.md](docs/demand-aggregation-d2.md). It aggregates the previous UTC
day at 03:00 through the Worker Cron Trigger and keeps un-attributed asset actions out of query
buckets.

The transparent D3 scoring contract and fixed examples are documented in
[docs/opportunity-score-spec.md](docs/opportunity-score-spec.md). Score implementation must retain
its demand, scarcity, and engagement factors instead of exposing an unexplained number.

The D4 internal demand dashboard is documented in
[docs/demand-dashboard-d4.md](docs/demand-dashboard-d4.md). It compares complete 28-day windows
and keeps raw search events out of the UI.

Creator submission and embed trust boundaries are fixed in
[docs/submission-security-e2.md](docs/submission-security-e2.md). E3 must implement its normative
URL, required-preview, authorization, CSRF, plain-text, and embed cases without adding server-side
URL fetching. Deterministic triage rules and the manual-review boundary are documented in
[docs/submission-pre-screening.md](docs/submission-pre-screening.md).

The E3 submission flow and endpoint contract are documented in
[docs/creator-submissions-e3.md](docs/creator-submissions-e3.md).

The E4 moderation queue and review/audit contract are documented in
[docs/submission-moderation-e4.md](docs/submission-moderation-e4.md).

Approved creator submissions are promoted into the shared public asset index with the reviewed
rights evidence and embed origin captured in the same D1 batch.
See [docs/creator-asset-publishing-e5.md](docs/creator-asset-publishing-e5.md) for the E5 contract.

Creator source links and copied embed attribution follow the accepted
[E6 attribution/link policy](docs/creator-attribution-link-policy-e6.md).
Creator-hosted calculators and widgets must also satisfy the
[creator embed, preview, rights, and security standard](docs/creator-embed-rights-security-standard-v1.md)
before moderation can publish them.

Creator-owned published assets expose bounded first-party publisher signals in the dashboard.
See [docs/creator-analytics-e7.md](docs/creator-analytics-e7.md) for the E7 metric definitions,
privacy handling and ownership boundaries.

The public creator opportunity surface is available at `/opportunities` and is documented in
[docs/public-opportunity-f1.md](docs/public-opportunity-f1.md).

Opportunity cards can open a topic-tagged submission draft; see
[docs/build-this-f2.md](docs/build-this-f2.md) for the manual-review boundaries.

The F3 source connector contract and World Bank candidate policy are documented
in [docs/source-connectors.md](docs/source-connectors.md). The source remains a
candidate for production data until item-level rights review passes. The F4
parser is available through `npm run ingest:worldbank -- <indicator>` and
defaults to a dry run.

The first World Bank citation-only decision is recorded in
[docs/worldbank-population-total-rights-review.md](docs/worldbank-population-total-rights-review.md).

The final launch search/rights gate is recorded in
[docs/launch-search-rights-review-r3.md](docs/launch-search-rights-review-r3.md).
