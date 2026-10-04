# D1 cost guardrails

## Incident summary

The scheduled asset refresh previously rebuilt the complete `asset_search_trigrams` table after
each source refresh. Because the daily worker refreshes OWID and World Bank separately, the full
table was deleted and recreated twice per scheduled run. D1 counts affected table rows and index
maintenance as rows written, so this produced write volume unrelated to the small number of assets
being refreshed.

## Enforced controls

- Scheduled refreshes rebuild trigrams only for asset IDs whose searchable fields were refreshed.
- Incremental refreshes refuse to index more than 100 asset IDs in one run.
- Generated refresh SQL must contain an asset-ID predicate and must never contain an unbounded
  `DELETE FROM asset_search_trigrams`.
- Search analytics writes to D1 are disabled unless `D1_SEARCH_ANALYTICS_ENABLED` is exactly
  `true`. If enabled later, result impressions are limited to creator-owned assets.
- Per-load embed aggregates in D1 are disabled unless `D1_EMBED_AGGREGATES_ENABLED` is exactly
  `true`. Embed-load measurements continue to use Analytics Engine while the D1 rollup is off.

Both D1 analytics flags are committed as `false`. They must not be enabled until a reviewed,
bounded rollup design and a production write-budget test are in place.

## Release verification

Before deployment, CI must pass the refresh-runner, search-index, embed-usage, and analytics-policy
tests. After deployment, verify the production Worker version and inspect D1 row-write metrics after
the next scheduled run. Expected scheduled writes should scale with the 35 refreshed candidates,
not with the full marketplace catalogue.

The Cloudflare account should also retain a D1 budget alert. An alert is a backstop, not a substitute
for these code-level limits.

## Deferred follow-up

- [ ] Design and implement a cost-bounded daily rollup from Analytics Engine into D1 so the creator
      dashboard can again show `Embed loads (actual)` and `Publisher sites` without performing a D1
      write for every embed request.
- Keep `D1_EMBED_AGGREGATES_ENABLED` set to `false` until the rollup has explicit per-run limits,
  idempotency, write-budget tests, and production monitoring.
- Re-enable dashboard counters only after the bounded rollup has passed review and a production
  smoke test. The public website and embeds must remain independent of this reporting pipeline.
