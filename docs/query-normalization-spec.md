# D1 query normalization specification

- Status: implementation-ready contract for D2
- Model allocation: SOL design, LUNA implementation
- Contract version: `demand-query-v1`
- Runtime target: Cloudflare Workers and D1

## Purpose

Demand analytics must aggregate harmless wording variants without merging queries that represent
different publisher intent. Search retrieval and demand aggregation therefore use related but
separate normalized values.

This contract is deterministic. It must be implemented as a pure function with no LLM, network,
database, locale detection, current time, or mutable external rule set.

## Output contract

```ts
type DemandQuerySuppressionReason =
  | "empty"
  | "too_long"
  | "sensitive_email"
  | "sensitive_secret"
  | "sensitive_phone"
  | "high_entropy_identifier";

type DemandQueryNormalization = {
  version: "demand-query-v1";
  search_normalized: string;
  aggregation_key: string | null;
  display_query: string | null;
  tokens: string[];
  aggregation_eligible: boolean;
  suppression_reason: DemandQuerySuppressionReason | null;
};
```

`search_normalized` is the existing C1 value: Unicode NFKC, trim, English lowercase, and collapsed
whitespace. It stays compatible with `search_events.query_normalized` and must not be silently
rewritten into the stronger demand key.

`aggregation_key` is the stable equality key used by D2. `display_query` equals that key in V1;
later UI may format it for display without changing grouping. Both are `null` for suppressed
queries. `tokens` are the final key tokens and are empty for suppressed queries.

## Input and persistence boundary

- Input is the submitted `query_raw` string from an accepted search event.
- The existing API limit of 120 characters remains authoritative. The normalizer independently
  returns `too_long` for defensive use on historical or imported data; it never truncates.
- `search_events.query_raw` and `search_events.query_normalized` remain the immutable event record.
- D2 stores the derived key with `normalization_version = 'demand-query-v1'`; it never overwrites
  the raw event.
- A changed ruleset requires a new version. Old aggregates are not mixed with a new version.
- Raw and search-normalized queries remain internal analytics data. Public opportunity surfaces
  must never expose them directly or display a suppressed query.

## Ordered normalization algorithm

Rules run in this exact order.

### 1. Search normalization

Apply the existing `normalizeQuery`:

1. Unicode NFKC;
2. trim leading/trailing whitespace;
3. lowercase with the fixed English locale;
4. collapse every whitespace run to one ASCII space.

Return `empty` if the result is empty. Return `too_long` if its JavaScript string length exceeds 120
UTF-16 code units, matching the existing analytics endpoint. Do not percent-decode, HTML-decode,
or URL-decode a second time.

### 2. Sensitive-value suppression

Before punctuation changes, suppress a query when the full search-normalized value contains:

- a conventional email address;
- a JWT-shaped three-segment token;
- a credential-shaped token with a common key/token prefix followed by at least 16 identifier
  characters;
- a phone-shaped value containing at least ten digits, allowing spaces, parentheses, `+`, and
  hyphens;
- a single unbroken token of at least 32 characters containing both letters and digits.

Use the first matching reason in the order above. These checks are conservative analytics guards,
not a general PII detector. Ordinary years, percentages, country codes, domains, and short product
identifiers remain eligible.

Suppressed searches may still contribute to a private total-search counter, but D2 must not group
or surface their text.

### 3. Structural punctuation normalization

Build a candidate key from `search_normalized`:

- normalize curly apostrophes to ASCII and remove apostrophes between letters without inserting a
  space (`women's` becomes `womens`);
- replace `%` with the token `percent`;
- replace `&` with the token `and`;
- replace slashes, underscores, and Unicode/ASCII dashes with spaces;
- retain Unicode letters and numbers;
- retain `+` when adjacent to a letter or another plus, preserving terms such as `c++`;
- retain a decimal point only when it is between digits;
- replace every other punctuation or symbol run with a space;
- collapse whitespace and trim again.

If no letter or number remains, return `empty`.

### 4. Explicit inflection map

Apply token substitutions only from this V1 allowlist:

| Input          | Output       |
| -------------- | ------------ |
| `rates`        | `rate`       |
| `prices`       | `price`      |
| `charts`       | `chart`      |
| `datasets`     | `dataset`    |
| `benchmarks`   | `benchmark`  |
| `calculators`  | `calculator` |
| `accounts`     | `account`    |
| `users`        | `user`       |
| `countries`    | `country`    |
| `technologies` | `technology` |
| `emissions`    | `emission`   |
| `percentages`  | `percentage` |

Do not implement generic singularization or Porter stemming. Words such as `business`, `news`,
`gas`, and `series` must remain unchanged.

### 5. Exact token and phrase aliases

Apply the longest matching token sequence first, scanning left to right. A replacement may not
match inside another token.

| Input sequence           | Output sequence |
| ------------------------ | --------------- |
| `gross domestic product` | `gdp`           |
| `carbon dioxide`         | `co2`           |
| `solar photovoltaic`     | `solar pv`      |
| `year over year`         | `yoy`           |
| `saas churn rate`        | `saas churn`    |
| `percentage`             | `percent`       |

The final tokens, joined by one space in their original order, form `aggregation_key` and
`display_query`.

## Meaning-preservation rules

The normalizer must not:

- remove stop words globally (`cost of living` remains distinct from `cost living`);
- reorder or deduplicate tokens;
- translate between languages;
- remove diacritics after NFKC;
- infer synonyms outside the explicit alias table;
- discard numbers, years, geography, units, or asset-type intent;
- merge `birth` with `birth rate`, `2024` with `2025`, or `chart` with `calculator`;
- reuse FTS retrieval tokens as the demand key.

If a new alias is desirable, add it with positive convergence fixtures and negative collision
fixtures in a new review. A rule that causes an observed semantic collision ships only in a new
normalization version.

## Filter and topic semantics

V1 groups the text query independently of UI filters because current search events do not persist
filter values. Result-count distributions in D2 therefore describe the observed mix of filtered
and unfiltered executions. A later event-schema version may add a separate filter signature; it
must not concatenate filters into `aggregation_key`.

Topic is a separate nullable dimension. D1 does not infer a topic from a query. D2 may attach a
`topic_key` only from a separately versioned deterministic taxonomy or a reviewed asset mapping.
Unknown topic stays `null`; it never changes the query key.

## D2 storage handoff

The daily aggregate table should key rows by:

```text
UTC day + normalization_version + aggregation_key
```

At minimum it stores `display_query`, nullable `topic_key`, searches, unique anonymous sessions,
result-count distribution inputs, no-result searches, detail/source interactions, embed copies,
and citation copies. All SQL values derived from queries must use D1 prepared-statement bindings.
Multiple related writes in the Worker use `DB.batch()`.

D2 skips rows where `aggregation_eligible` is false. It must be idempotent for the same UTC day and
normalization version and must not double-count on retry.

## Acceptance tests

The machine-readable fixture is
[`data/benchmarks/query-normalization-v1.json`](../data/benchmarks/query-normalization-v1.json).
Luna implementation is complete only when tests prove:

1. every fixture has the declared result;
2. normalization is idempotent for every eligible fixture;
3. the three SaaS churn variants converge;
4. every `must_match` pair converges and every `must_not_match` pair remains distinct;
5. suppressed values never expose an aggregation or display key;
6. non-Latin letters, diacritics, meaningful numbers, and `c++` survive;
7. punctuation resembling FTS/SQL operators is inert data;
8. no network, LLM, database, or time dependency exists in the normalizer.
