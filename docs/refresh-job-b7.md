# B7 asset refresh job

The refresh job runs daily at 03:00 UTC through the Cloudflare Worker cron trigger. It refreshes
Our World in Data first and World Bank Open Data second so both jobs do not write D1 concurrently.
It selects at most 25 OWID records and 10 World Bank records per run.

Selection requires both conditions:

1. `last_checked_at` is at least 24 hours old (or missing).
2. The source is stale: a published `nextUpdate` date has passed, or `source_updated_at` is more
   than 730 days old when no `nextUpdate` is available.

Successful refreshes update source metadata, timestamps, raw indicator evidence, and the derived
rights classification while preserving an existing manual chart-rights review. The previous
source timestamp, rights status, and rights JSON are stored in the refresh result detail.

World Bank annual observations use a 365-day stale threshold measured from the end of a year-only
source date. A World Bank run with no stale candidates does not write D1. Manually reviewed
citation-only rights, exact citation text, and attribution are preserved. A change to the
source-provided license or provider metadata marks the asset `review`, blocks its public listing,
and records `source_policy_changed` instead of silently accepting the change.

Only an explicit HTTP 404 hides an asset. Timeouts, HTTP 5xx responses, invalid JSON, and other
transient failures leave the asset visible and update `last_checked_at` so the next interval can
retry it without hammering the source.

Every executed run is recorded in `refresh_runs`; every candidate outcome is recorded in
`refresh_results`. The job is idempotent for a given check interval and the manual CLI does not
modify remote D1 unless `--apply --remote` is explicitly requested.

## Local verification

```bash
npm run db:migrate:local
npm run refresh:assets -- --local --at 2026-09-16T12:00:00.000Z --apply --json
```

The local verification selected one stale asset, refreshed it successfully, and recorded one
successful refresh run. The production database was not written during this verification.
