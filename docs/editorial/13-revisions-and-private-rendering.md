# Step 14 — revisions and first private rendered article

**Date:** 2026-09-25  
**Workflow role:** Luna  
**Artifact manifest:** `data/editorial/private-rendered-preview-manifest.json`  
**Publication effect:** none

## Completed

- Added [a self-contained, responsive private HTML rendering for the Internet-use article](previews/cb-001-internet-use-private-rendered.html). Its interval uses only the approved 25th percentile, median, and 75th percentile, with the 175 matched-entity count, period, units, source chain, caveats, and a data-table equivalent visible beside it. The SVG carries the four metric IDs used by the figure. It has a `noindex,nofollow,noarchive` meta directive and exists only as a repository file; no public route was created.
- Removed the unreferenced “100%” expression from the renewable article's opening. Replaced the formula-heavy transport and heating/cooling paragraph with a narrower RED II-period explanation. It now cites Eurostat's [renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm), [2024 renewable heating and cooling note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1), and the [2023 consolidated Renewable Energy Directive](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02018L2001-20231120). The text explains separate sector rules and Eurostat's stated heat-pump double-counting treatment without relying on the 2026 draft SHARES manual for the claim.
- Added the approved metric reference to the HICP opening. Reworded the index explanation: annual rates alone do not identify an absolute index level without a base/reference index observation. No cumulative rate or index was invented.
- Rewrote the wildfire preview to preserve the unresolved coverage/version conflict. It keeps OWID's Grapher `timespan` and `lastUpdated`, indicator-origin description and `dateAccessed`, retrieval time, and GWIS public display range distinct. Every displayed mean and difference now maps to an approved metric ID in its row. The one-decimal values and the independent rounding of differences are explained.

## Source and editorial limits

Eurostat's metadata says its renewable share series follows RED I through 2020 and RED II from 2021, and identifies four separate indicators. The 2026 Eurostat note for 2024 states renewable electricity used to drive heat pumps is not counted again in RES-H&C to avoid double counting. Those sources support the revised explanation but do not replace checking the exact live asset and current rights.

The wildfire source discrepancy remains unresolved. OWID's pinned Grapher columns describe 2002–2025 and have `lastUpdated: 2026-09-11`; its indicator-origin text says 2002–2024 and `dateAccessed: 2026-09-11`; the GWIS technical page says its public display covers 2001–2023. The private preview now reports that inconsistency directly. This step does not claim the 2025 data or asset-level rights have been independently confirmed.

## Validation

- `node --import tsx scripts/editorial/validate-drafts.ts` — passed all four drafts; status remains `private_non_indexable`.
- `npx prettier --check` — passed for all four changed artifacts after formatting.
- SHA-256 values for updated drafts and previews are recorded in the Step 14 manifest. The Step 11 historical decision record and Step 12 manifest remain unchanged.

The rendered HTML was authored as a standalone private file; it has not been deployed or wired to an application route. It needs a visual and accessibility review at mobile and desktop breakpoints by Sol. All public release gates remain closed.

## Next step

**Step 15 — Sol:** inspect the actual HTML rendering at narrow and wide viewports, verify SVG and table accessibility, and review the revised Eurostat copy and wildfire provenance notes against their new hashes. Decide whether the two Eurostat pieces may enter a private rendered stage and whether any source-backed wildfire confirmation is available. No article may be published until live asset identity, freshness, rights, citations, and responsive review pass.
