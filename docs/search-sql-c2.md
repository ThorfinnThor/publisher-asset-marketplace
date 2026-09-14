# C2 search SQL/function implementation

The implementation is in `src/lib/search/search-assets.ts` and uses prepared D1 statements only.
`buildPrimarySearchSql` retrieves up to 100 eligible FTS5 candidates with BM25 column weights;
`buildFallbackSearchSql` uses the indexed character trigrams when the primary result set is small.
The public `searchAssets` function applies deterministic scoring, matched-field reporting, filters,
and versioned cursors.

Migration `0003_search_index.sql` rebuilds the FTS table with Porter stemming, populates the
initial trigram index, and installs FTS synchronization triggers. Import and refresh writes rebuild
the trigram index after their asset batches so later searches see current titles and types.

The function is intentionally independent of the current preview page. C3 will connect this
contract to the user-facing search UI after Sol's ranking review.
