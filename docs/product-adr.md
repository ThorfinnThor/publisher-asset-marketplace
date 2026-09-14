# ADR 0001: Publisher-first marketplace on Cloudflare

- Status: accepted for the first implementation slice
- Date: 2026-09-14

## Context

The product helps publishers discover assets they can confidently preview, cite, and embed. The
initial spreadsheet contains 3,000 Our World in Data URLs, but that corpus is bootstrap inventory,
not the marketplace itself. The marketplace begins only when creators can submit assets and gain
measurable distribution from publisher demand.

The implementation plan proposed Next.js, PostgreSQL, Supabase, and Vercel. The project owner has
selected GitHub and Cloudflare. The product contracts remain unchanged; only the platform mapping
changes.

## Decision

1. Build the App Router application with vinext and deploy it to Cloudflare Workers. Keep framework
   coupling shallow because vinext is currently beta.
2. Store relational data in Cloudflare D1. Use SQLite FTS5 for deterministic V1 search. A typo
   fallback will be specified separately; PostgreSQL `pg_trgm` cannot be copied into D1 unchanged.
3. Run refresh jobs with Workers Cron Triggers after the refresh contract exists. Do not enable a
   cron that performs placeholder or unreviewed work.
4. Use GitHub as the source of truth. Pull requests run formatting, lint, type, unit, migration, and
   build checks. Main-branch deployment uses Cloudflare credentials stored only as GitHub secrets.
5. Seed ten OWID assets first. Import the full spreadsheet only after ingestion, rights, search,
   asset detail, copy actions, and analytics work end to end.
6. Treat seeded assets as source inventory, not creator marketplace supply. The site is not an OWID
   clone or a generic dataset search engine.
7. Store and render only approved source-hosted embeds in the MVP. Do not accept arbitrary scripts,
   executable HTML, or rebuilt third-party widgets.
8. Make rights decisions per asset. Preserve unknown values as unknown, distinguish embed rights
   from raw-data redistribution rights, and retain evidence URL and review date for every public
   claim.
9. Collect first-party publisher demand analytics with anonymous session identifiers and no
   unnecessary personal data.
10. Promise discovery, embeds, citations, and referral opportunity. Never promise backlinks,
    dofollow links, rankings, or editorial outcomes.

## Consequences

- D1 FTS5 replaces PostgreSQL FTS. Ranking and typo fallback need a Cloudflare-specific Sol review
  before search implementation.
- Creator authentication is deferred until publisher search and analytics pass their gate. The
  external identity provider must map to stable text IDs in D1 without changing publisher access.
- No public embed or commercial-use badge is enabled from spreadsheet text alone. The future rights
  classifier must use source evidence and a deterministic decision table.
- Cloudflare resource creation and GitHub connection remain explicit deployment steps. No secrets
  or production IDs belong in the repository.
