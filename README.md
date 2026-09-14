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

The B7 refresh job runs daily at 03:00 UTC from the Worker cron trigger. It refreshes only stale
assets, hides explicit 404 sources, and records each outcome in `refresh_runs` and
`refresh_results`. Run `npm run refresh:assets -- --local` for a dry run; use `--apply --remote`
only for an intentional production write.

## Product boundaries

Read [docs/product-adr.md](docs/product-adr.md) before changing the data model, rights behavior,
search ranking, embed handling, or analytics definitions.

The accepted V1 search contract and fixed benchmark are documented in
[docs/search-ranking-spec.md](docs/search-ranking-spec.md).
The D1 query/function implementation is documented in [docs/search-sql-c2.md](docs/search-sql-c2.md).
Run `npm run search:review` after ranking changes to execute the production search function against
the fixed SQLite FTS5 fixture corpus and refresh
[docs/search-quality-review-c8.md](docs/search-quality-review-c8.md).
