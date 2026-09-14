# C8 search-quality review

- Review version: 1.0.0
- Ranking contract: 1.0.0
- Review model: Sol
- Review time: 2026-09-14T12:00:00.000Z
- Deterministic benchmark: **PASS**

## Summary

- Contract cases passed: 6/6
- Strong answers among answerable queries: 5/5 (100%)
- The intentionally out-of-corpus query is graded 0 but passes the retrieval contract by returning no result.

## Results

| Query                 | Grade | Contract | Retrieval | Top results                                      |
| --------------------- | ----: | -------- | --------- | ------------------------------------------------ |
| exact-title           |     2 | pass     | fts       | active-mobile-money-accounts                     |
| partial-phrase        |     2 | pass     | fts       | internet-use-share                               |
| typo-fallback         |     2 | pass     | trigram   | solar-pv-prices-safe, solar-pv-prices-restricted |
| zero-result           |     0 | pass     | none      | —                                                |
| safe-restricted-tie   |     2 | pass     | fts       | solar-pv-prices-safe, solar-pv-prices-restricted |
| publisher-style-topic |     2 | pass     | fts       | genome-sequencing-cost                           |

## Human review rationale

- `exact-title` — The exact named asset is the first result and is clearly publisher-ready.
- `partial-phrase` — The Internet-use chart is the first result while the draft unknown-rights asset is excluded.
- `typo-fallback` — The typo fallback recovers the solar-price intent and prefers the safe asset.
- `zero-result` — The fixture corpus has no relevant asset; returning no result is safer than an unrelated answer.
- `safe-restricted-tie` — Both exact matches are relevant and the safe embeddable asset wins the tie.
- `publisher-style-topic` — The natural-language publisher query retrieves the genome-cost chart first.

## Production corpus finding

The Cloudflare production D1 database contained zero assets at review time. This is consistent
with the closed Gate B rights audit: the ten fetched OWID seed assets are still `unknown` and
`draft`, so none may be exposed by public search. The ranking implementation passes against the
versioned fixture corpus, but Gate C remains closed until chart-specific rights evidence is
reviewed and at least a useful seed set is safely published.

## Failures

None.

## Reproduce

```bash
npm run search:review
```

The command runs the production search function and SQL against an isolated in-memory SQLite FTS5
database populated from `data/benchmarks/search-ranking-v1.json`. It does not write to Cloudflare.
