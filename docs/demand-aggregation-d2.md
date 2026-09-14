# D2 demand aggregation

D2 runs from the Worker Cron Trigger at 03:00 UTC and materializes the previous complete UTC day
in `demand_daily_aggregates`. The aggregate key uses the versioned `demand-query-v1` contract from
[`query-normalization-spec.md`](query-normalization-spec.md).

Each row is keyed by `aggregate_date`, `normalization_version`, and `aggregation_key`. It stores:

- search count and unique anonymous sessions;
- deterministic result-count distribution JSON;
- no-result count and rate;
- attributed detail/source interactions (`asset_clicks`);
- attributed embed and citation copies.

The runner recomputes a day from immutable event rows, deletes that day's versioned rows, and
inserts the fresh result through prepared D1 statements and bounded `DB.batch()` calls. Re-running
the same UTC day therefore replaces the aggregate instead of incrementing it a second time.

Only events with a `search_event_id` are attributed to a query. Actions recorded without that
relationship remain unassigned rather than being guessed into a query bucket. Suppressed or empty
queries contribute to the private suppressed-search counter but never create an aggregate row or
display key.
