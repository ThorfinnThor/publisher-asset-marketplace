# D3 opportunity score specification

- Status: implementation-ready contract
- Model allocation: SOL design, LUNA implementation
- Score version: `opportunity-v1`
- Required normalization version: `demand-query-v1`
- Runtime target: Cloudflare Workers and D1

## Purpose

The opportunity score ranks publisher demand that is not yet well served by reusable assets. It
is an internal prioritization aid, not a prediction, quality judgment, SEO promise, or backlink
guarantee. V1 is deterministic and explainable. It uses no LLM, trained model, hidden weighting,
or personal profile data.

The score follows the product-plan relationship:

```text
demand × scarcity × engagement intent
```

Every stored score must retain the factor values and raw aggregate inputs needed to reproduce it.

## Evaluation window

- Use the latest 28 complete UTC days, ending immediately before `scored_at`.
- Sum only `demand_daily_aggregates` rows whose `normalization_version` is
  `demand-query-v1`.
- Group by `aggregation_key`; never combine normalization versions.
- Supply is a snapshot at `scored_at`, not a historical reconstruction.
- Growth is not part of `opportunity-v1`. D4 may compare this window with the preceding 28 days
  and must label that calculation separately.

Queries suppressed by D1 never enter scoring. `query_raw` and `query_normalized` must not be
copied into an opportunity row.

## Required inputs

For each aggregation key, roll up:

```ts
type OpportunityScoreInput = {
  normalization_version: "demand-query-v1";
  aggregation_key: string;
  display_query: string;
  topic_key: string | null;
  searches: number;
  unique_anonymous_sessions: number;
  result_count_distribution: Record<string, number>;
  no_result_searches: number;
  asset_clicks: number;
  embed_copies: number;
  citation_copies: number;
  safe_asset_count: number;
  embeddable_asset_count: number;
};
```

`unique_anonymous_sessions` is distinct across the full 28-day window, not the sum of daily
unique-session counts. The D3 implementation must therefore calculate it from `search_events` for
the same keys and window. Daily unique values may be shown for diagnostics but must not be added
together.

The result-count distribution keys are non-negative integers and the counts must sum to
`searches`. The implementation calculates the lower weighted median: the smallest result count
whose cumulative observations reach `ceil(searches / 2)`.

### Supply snapshot

Run the approved C2 search contract with `aggregation_key` as the query and no UI filters. Count
only current `published` assets with rights status `safe` or `restricted` that the public search
can return.

- `safe_asset_count`: matching assets whose rights status is `safe`.
- `embeddable_asset_count`: matching assets with a non-empty source-hosted `embed_url` and
  `rights_json.embed_allowed === true`.

Counts may be capped after `3+` because V1 thresholds do not distinguish larger values. A search
or rights failure makes the score `unavailable`; it must not be converted to zero supply.

## Eligibility and status

A query needs both at least five searches and at least three distinct anonymous sessions in the
window. Otherwise:

```text
status = insufficient_data
opportunity_score = null
```

This threshold reduces single-user and repeated-refresh distortion. Eligible rows use
`status = scored`. Invalid distributions, missing required inputs, or a failed supply snapshot use
`status = unavailable` with a reason code; they do not receive a numeric score.

## Factor 1: demand points

Demand requires both breadth and volume. Select the highest row whose two thresholds are met:

| Points | Searches | Distinct sessions |
| -----: | -------: | ----------------: |
|      0 |      < 5 |               < 3 |
|      1 |      ≥ 5 |               ≥ 3 |
|      2 |     ≥ 10 |               ≥ 5 |
|      3 |     ≥ 25 |              ≥ 10 |
|      4 |     ≥ 50 |              ≥ 25 |
|      5 |    ≥ 100 |              ≥ 50 |

If only one threshold is met, use the lower qualifying point value. A query with 100 searches
from one session therefore remains ineligible.

## Factor 2: scarcity points

Start at `1.0` and add the following independent evidence, capped at `5.0`:

### Safe supply

| Current safe assets | Add |
| ------------------: | --: |
|                   0 | 2.0 |
|                 1–2 | 1.0 |
|                  3+ | 0.0 |

### Embeddable supply

| Current embeddable assets | Add |
| ------------------------: | --: |
|                         0 | 1.0 |
|                         1 | 0.5 |
|                        2+ | 0.0 |

### Observed result scarcity

| Window evidence                                            | Add |
| ---------------------------------------------------------- | --: |
| No-result rate ≥ 50% or median result count = 0            | 1.0 |
| Otherwise, no-result rate ≥ 20% or median result count ≤ 3 | 0.5 |
| Otherwise                                                  | 0.0 |

No-result rate is `no_result_searches / searches`; the stored daily rates are not averaged.

## Factor 3: engagement-intent multiplier

Engagement can strengthen an opportunity but cannot erase unmet demand. Calculate:

```text
click_rate = asset_clicks / searches
copy_rate = (embed_copies + citation_copies) / searches

engagement_intent =
  1.0
  + min(0.5, click_rate)
  + min(0.5, 2 × copy_rate)
```

The multiplier therefore stays between `1.0` and `2.0`. Only asset events with a real
`search_event_id` are used. Unattributed actions are excluded, and no-result searches retain the
neutral `1.0` baseline.

## Final score

For eligible and available inputs:

```text
raw_score = demand_points × scarcity_points × engagement_intent × 2
opportunity_score = round(min(100, raw_score))
```

The UI displays the integer together with the three factors and an explanation such as “high
demand, no safe assets, 50% no-result rate.” It must not display decimal precision or confidence
language unsupported by the sample.

Deterministic ranking ties are resolved by:

1. opportunity score descending;
2. distinct sessions descending;
3. searches descending;
4. aggregation key ascending by binary value.

## Persistence contract

D3 implementation stores one reproducible snapshot per:

```text
window end + normalization version + score version + aggregation key
```

At minimum the row stores the window bounds, `scored_at`, display and topic keys, all required
inputs, median result count, the three factors, numeric score or null, status, reason code, and a
versioned explanation JSON object. Re-running the same window and versions replaces that snapshot
instead of incrementing it.

All query-derived SQL values use prepared D1 bindings. Related writes use bounded `DB.batch()`
calls. A scoring-rule change requires a new `score_version`; historical versions are never
silently overwritten.

## Acceptance tests

The machine-readable fixture is
[`data/benchmarks/opportunity-score-v1.json`](../data/benchmarks/opportunity-score-v1.json). Luna
implementation is complete only when tests prove:

1. every fixture produces the declared status, factor values, and score;
2. insufficient breadth or volume returns `null`, including repeated searches by one session;
3. zero supply increases scarcity, while a failed supply lookup is `unavailable`;
4. the distribution is validated and its lower weighted median is deterministic;
5. unattributed actions never affect engagement;
6. no-result demand keeps a neutral engagement multiplier rather than becoming zero;
7. output is identical on repeated evaluation with identical inputs;
8. ranking tie-breakers are stable;
9. the implementation has no LLM, network, locale, or mutable-rule dependency inside the pure
   scoring function.
