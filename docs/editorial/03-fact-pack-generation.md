# Step 4 — Fact-pack generation and verification boundary

- Status: complete; four packs are ready for Sol review
- Date: 2026-09-23
- Production changes: none
- Commit/deployment: none

This step creates source-observation packs for four quantitative briefs and a
fact-free verification checklist for the creator-tool guide. It does not write
article copy, alter marketplace assets or rights, create indexable pages, or
publish anything.

## Reproduce

Run `npm run editorial:fact-packs`. The script reads the Step 2 candidate
inventory and Step 3 calibration briefs, fetches only the explicitly configured
official endpoints, and writes:

- `data/editorial/fact-packs/`: parsed, source-row-addressable observations;
- `data/editorial/source-snapshots/`: byte-for-byte response snapshots used by
  the parser;
- `data/editorial/fact-pack-generation-status.json`: ready/blocked status for
  each brief; and
- `data/editorial/verification-packs/creator-calculator-guide.json`: a manual
  verification checklist which expressly excludes calculator outputs.

Response metadata records requested and final URLs, query parameters, status,
content type, UTC retrieval time, SHA-256 and parser version. Snapshots are
stored under a content-hash path and written create-only; reruns reuse an
identical snapshot and preserve older source versions. Fetches require
HTTPS, use the operating-system certificate store, allowlist destination and
redirect hosts, cap download size, and never disable TLS certificate checks.
Only source observations are stored in `facts`; `derived_facts` must remain
empty at this stage. Every fact retains a source row/column locator, source
period, unit, geography code, and status/missing-value marker. Entity names are
not yet classified as countries versus aggregates.

## Rights and provenance gate

The generator fails closed unless the selected Cite Supply assets have reviewed
commercial-use, modification, and raw-data-redistribution evidence. OWID
origin metadata must separately state `nonRedistributable: false`, and every
origin attached to the selected indicator must report the expected CC BY 4.0
license. Upstream provenance is carried into the pack; Cite Supply asset rights
alone do not establish source-data redistribution rights. A failure is recorded
as blocked, not worked around with an insecure request or a guessed license.

Eurostat's current [reuse notice](https://ec.europa.eu/eurostat/help/copyright-notice)
permits commercial reuse of statistical data with attribution, but identifies
exceptions for third-party material and data for countries outside the EU, EFTA,
and official acceding/candidate countries. The generator fetches and snapshots
that notice, checks that the relevant policy clauses remain present, requests
only `geo=EU27_2020`, and rejects a response if its geography dimension contains
anything beyond that exact aggregate. This is a conservative scoped data pull,
not a blanket legal clearance for every Eurostat table or geographic series.

The marketplace inventory does not expose internal asset IDs. Packs therefore
record `asset_id: null` and `asset_id_resolution: public_route_only`, retaining
the public canonical URL instead of inventing an identifier.

## Interpretation boundary

Generation is not editorial approval. A subsequent reviewer must select
comparable geographies and periods, classify aggregates, understand source
definitions and status flags, verify every derived statistic independently,
and preserve caveats. No article should be drafted from interface samples,
unreviewed output, or a creator calculator's result.

The Step 3 Eurostat brief questions still mention country comparisons, but the
rights-safe data packs intentionally contain only the EU27_2020 aggregate.
Those packs cannot answer the original country-comparison questions. Sol must
approve a narrower sector/indicator question or select a different data source
before any Eurostat article is drafted.

The initial Eurostat TLS failure was caused by the endpoint omitting the
intermediate certificate `GlobalSign Atlas R46 OV TLS CA 2026 Q3`. That
intermediate was fetched from GlobalSign's official HTTPS certificate endpoint
and verified against the already trusted macOS GlobalSign Root R46 before being
added to a temporary CA bundle alongside the system bundle. The data fetch then
used ordinary TLS verification; there is no insecure/TLS-bypass path. The
temporary bundle is not committed. For a future run, provide an equivalent
verified CA bundle through `CURL_CA_BUNDLE`; without one, failure remains closed
as `blocked_tls`.

## Verification state

The generation-status JSON is the authoritative record of which outputs were
actually produced in a run. The creator checklist starts with browser-, rights-,
and function-level checks marked `not_run`; preparing a checklist is not evidence
that those checks passed. Nothing in this step changes production state.

The verified generation run on 23 September 2026 produced four packs: internet
adoption (6,476 observations), renewable energy (31), HICP annual average rate
of change (8), and burned area by land-cover type (22,464). The two Eurostat
packs contain only the `EU27_2020` aggregate; their raw units are retained as
Eurostat's labels (“Percentage” and “Annual average rate of change”). The
creator verification pack links each Cite Supply record to its actual
PassendPlanen page and asset-specific rights evidence; its functional, accuracy,
accessibility, and live-rights checks remain `not_run`. The wildfire mapping
uses the four
OWID metadata-identified indicator IDs (1306108, 1306107, 1306106, 1306109),
not adjacent IDs guessed from a sequence. OWID CSV headers are explicitly
mapped to metadata column names and indicator IDs/short names are checked
before a pack is accepted. See the machine-readable per-brief status for the
latest run timestamp and exact output paths.
