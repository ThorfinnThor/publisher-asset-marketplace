# Step 18 — private Eurostat previews

**Date:** 2026-09-25  
**Workflow role:** Luna  
**Manifest:** `data/editorial/private-eurostat-preview-manifest.json`  
**Publication effect:** none. Both outputs are standalone private files with `noindex`,
`nofollow`, and `noarchive`; no route or sitemap entry was created.

## Source recheck

The HICP correction is supported by Eurostat's current metadata and dataset mapping. The pinned
response for `tec00118` uses `coicop18=TOTAL` and identifies `PRC_HICP_AINR`; Eurostat's official
[HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm) says the
ECOICOP version 2 classification is applied to the full series with recalculated back series, and
the [Eurostat explanatory note](https://ec.europa.eu/eurostat/databrowser-backend/api/public/explanatory-notes/get/Info_note_HICP_COICOP18_20260128.pdf)
maps `prc_hicp_ainr` to the version-2 annual dataset. The corrected draft therefore does not
describe 2018–2025 as old-classification observations. Its rates remain bound to the locked
analysis: 2024 = 2.6%, 2025 = 2.5%, change = −0.1 percentage points.

The renewables correction is deliberately narrower. Eurostat's [renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm)
confirms the four indicators, the RED I/RED II break, and the RES-E production-and-trade
denominator. Eurostat's [2024 transport release](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1)
identifies the 2024 RES-T series, while [RED II Article 27](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32018L2001)
sets out the transport accounting rules. Eurostat's [2024 heating-and-cooling note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1)
supports the renewable heat examples and the rule against counting renewable electricity used
for heat pumps twice. The corrected article no longer treats a 2026 draft SHARES manual as proof
of a 2024 operational formula.

## Private previews

- [EU renewable-energy preview](/Users/schayan/Projects/backlink_marketplace/docs/editorial/previews/cb-002-renewables-private-rendered.html)
  uses four 2024 share metrics and four 2021–2024 change metrics. The chart's accessible
  description and table explicitly say the bars are separate indicators and must not be added.
- [EU HICP preview](/Users/schayan/Projects/backlink_marketplace/docs/editorial/previews/cb-003-hicp-private-rendered.html)
  uses eight annual-rate metrics from 2018 through 2025. The chart and table label the values as
  annual-average rates, not index points. The classification, annual-average, and index-level
  method blocks each carry a source link directly beneath the text.

The renderer is `scripts/editorial/render-eurostat-previews.ts`. It fails on an analysis hash
mismatch or a missing approved metric, and it emits the metric references into each SVG. This
prevents a hand-edited number from silently replacing a locked analysis value. All citations are
HTTPS URLs already accepted by the draft schema.

## Validation

- `node --import tsx scripts/editorial/validate-drafts.ts` — all four drafts pass schema and
  remain private/non-indexable.
- `node --import tsx scripts/editorial/check-draft-depth.ts` — Internet 701, renewables 562,
  HICP 715; wildfire remains held at 293.
- `node --import tsx scripts/editorial/render-eurostat-previews.ts` — both previews generated from
  analysis SHA-256 `be9a848d8eaef59ff605ddc16e04a82010e755b0f83c78803790854aa466b991`.
- `node --import tsx scripts/editorial/check-private-eurostat-previews.ts` — both preview hashes,
  private directives, single H1, accessible SVG labels, equivalent tables, metric bindings, and
  adjacent method-source links passed.
- Prettier passes for the renderer and manifest. Static checks confirm each generated document has
  `lang="en"`, the three no-index directives, a single H1, an SVG accessible name/description,
  an equivalent table, and adjacent method-source links.

## Gates still closed

No browser visual or assistive-technology QA was claimed because the permitted browser surface
does not allow opening local preview files. The exact live asset IDs, freshness, and current
asset-level rights are still unresolved in the fact packs (`asset_id: null`). Wildfire remains
held for source lineage and rights. No production code, route, sitemap, commit, or deployment was
changed.

## Next step

**Step 19 — Sol:** review these two corrected hashes and private previews against the official
sources, check that citations are adjacent and the visuals are genuinely useful, and decide
whether either draft can advance. If a permitted browser surface becomes available, perform the
responsive and assistive-technology QA there. Keep all public release gates closed until live
asset identity, freshness, rights, and visual QA pass.
