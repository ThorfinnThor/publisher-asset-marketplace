# C1 search contract and ranking specification

- Status: accepted for V1 implementation
- Model allocation: Sol
- Platform: Cloudflare D1 with SQLite FTS5
- Contract version: 1.0.0

## Purpose

Publisher search must return useful, explainable results without allowing popularity or freshness
to override rights safety. The implementation plan's PostgreSQL FTS and `pg_trgm` references are
mapped to D1 FTS5 plus a small application-maintained trigram index, as required by ADR 0001.
Embeddings are explicitly out of scope.

## Request contract

```ts
type SearchRequest = {
  query: string;
  filters?: {
    asset_types?: string[];
    source_ids?: string[];
    rights_statuses?: Array<"safe" | "restricted">;
    updated_since?: string;
  };
  limit?: number; // default 24, maximum 50
  cursor?: string;
};
```

Normalize `query` with the existing `normalizeQuery`: Unicode NFKC, trim, lowercase, and collapse
whitespace. Reject an empty normalized query from the ranked search function; the UI may handle an
empty query with a separate featured-assets query. Cap normalized input at 120 characters and at
eight tokens before building an FTS expression.

All filter values and the generated FTS expression must be bound parameters. Raw user text must
never be interpolated into SQL or passed through as FTS query syntax.

Build the FTS expression from at most eight normalized tokens. Remove the fixed stop words `a`,
`an`, `the`, `to`, `of`, `for`, `in`, `on`, `by`, `with`, `and`, and `or`; discard remaining
one-character tokens but retain meaningful two-character terms such as `PV`. Escape every token
as an FTS5 quoted string, add the prefix operator outside the quote, and join terms with `AND`, for
example `"solar"* AND "pv"*`. This provides modest inflection matching (`sequence` to
`sequencing`) without enabling user-supplied operators. Reject a query if no retrieval token
remains.

## Result contract

```ts
type SearchResult = {
  asset: Asset;
  score: number;
  matched_fields: Array<"title" | "asset_type" | "description" | "source">;
  retrieval_path: "fts" | "trigram";
};
```

`matched_fields` uses the fixed order shown above. It explains why a result matched; it is not a
source of extra ranking weight outside the formula below.

A field is included in `matched_fields` when at least one retrieval token matches its normalized
FTS value. C2 must calculate the flags inside the same query/function rather than issuing per-row
follow-up queries.

## Hard eligibility

Apply eligibility before candidate scoring and again in the final result query:

```sql
assets.status = 'published'
AND assets.rights_status IN ('safe', 'restricted')
```

`unknown`, `blocked`, `draft`, `review`, and `hidden` assets are never public search results.
Filters may narrow the eligible set but cannot widen it. Event counts, clicks, impressions, or
future popularity signals cannot restore an ineligible asset. Gate B must be open before any seed
asset can satisfy this public contract.

## Primary retrieval with FTS5

In C2, rebuild the currently empty preview FTS table with the tokenizer
`porter unicode61 remove_diacritics 2`; the Porter wrapper supplies deterministic English stemming
while Unicode61 retains normalized Unicode token handling. Query `assets_fts` and join the
matching `asset_id` to `assets` and `sources`. The FTS5 BM25 column weights are:

| Field       | Weight |
| ----------- | -----: |
| title       |     10 |
| asset type  |      6 |
| description |      4 |
| source      |      1 |

Retrieve at most 100 eligible FTS candidates. Rank BM25 ascending and assign a deterministic
one-based `fts_rank`, breaking equal BM25 values by `asset_id`. Convert rank to points with:

```text
fts_points = max(1, 61 - fts_rank)
```

This avoids depending on the unstable numeric scale of BM25 values while preserving their order.

## Additive score

Every primary FTS result receives a base score of 100, ensuring that primary results always rank
above typo-only fallback results.

```text
primary_score = 100
              + fts_points
              + title_boost
              + rights_quality_boost
              + freshness_boost
```

Title boost is mutually exclusive:

- normalized title equals normalized query: +120;
- otherwise, normalized title contains the complete normalized query phrase: +70;
- otherwise: +0 (title tokens are already strongly weighted by FTS5).

Rights quality boost:

- `safe` and `rights_json.embed_allowed = true`: +12;
- `safe` without an approved embed: +8;
- `restricted` with an approved embed: +4;
- other eligible restricted assets: +0.

Freshness is deliberately modest and uses `source_updated_at`:

- no older than 90 days: +8;
- no older than 365 days: +5;
- no older than 1,095 days: +2;
- older or missing: +0.

Future source dates are clamped into the newest bucket. A freshness filter is a user-selected hard
filter; freshness scoring alone never removes an asset.

## Typo fallback

Run fallback only when primary retrieval returns fewer than three results and the normalized query
contains at least five characters. Compare edge-padded character trigrams for the query against a
deduplicated trigram index over normalized title and asset type. Use Jaccard similarity:

```text
similarity = shared_trigrams / (query_trigrams + asset_trigrams - shared_trigrams)
```

Require similarity of at least 0.30. Exclude assets already returned by FTS, apply the same hard
eligibility and filters, and score fallback results as:

```text
fallback_score = (similarity * 60)
               + rights_quality_boost
               + freshness_boost
```

The maximum fallback score is 80, below the minimum primary score of 101. This guarantees that a
fuzzy guess cannot displace a lexical match.

## Stable ordering and pagination

Sort by:

1. score descending;
2. normalized title ascending;
3. slug ascending.

The cursor contains those three values plus the contract version and is base64url-encoded. Reject
cursors from another contract version. C2 may initially return the first page only, but its query
must already use this deterministic order.

## Benchmark and acceptance

The fixed benchmark lives in `data/benchmarks/search-ranking-v1.json`. Each query declares the
expected retrieval path, ordered top results, exclusions, and a human relevance grade:

- 0: unusable;
- 1: somewhat relevant;
- 2: strong answer.

C2 passes when exact-title, partial-phrase, typo, zero-result, and safe-versus-restricted fixtures
match the declared ordering. Later search-quality reviews append results by contract version; they
must not rewrite old expected results merely to make a changed ranking pass.
