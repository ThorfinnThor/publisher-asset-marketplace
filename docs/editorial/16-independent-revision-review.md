# Step 17 — independent substantive revision review

**Date:** 2026-09-25  
**Review role:** Sol  
**Decision record:** `data/editorial/independent-revision-review-decisions.json`  
**Publication effect:** none. All drafts remain private and non-indexable.

## Decision

The Internet article advances only within the **private rendered-review** stage. Its 701 substantive
words, fixed 175-entity cohort, equal-entity weighting, 2000–2024 endpoints, and displayed
quartiles agree with the pinned analysis. The renderer resolves the chart geometry, accessible
description, and equivalent table from the same three approved metric IDs. Regenerating its HTML
from the locked analysis produced the same SHA-256 as Step 16. Static inspection found one H1,
semantic table headers, an SVG title and description, keyboard-focusable horizontal chart region,
and `noindex,nofollow,noarchive`. These are source-code checks, **not** a visual or assistive-
technology pass.

The two Eurostat drafts meet the 500-word threshold and their selected metrics match the locked
analysis, but this review found two material methodological errors in the Step 16 text. Both were
corrected in their private drafts. As the reviewer made those changes, the new hashes require a
separate independent copy check before either draft can advance. This is not an approval for
publication or indexing.

| Brief             | Substantive words | Decision                                                                |
| ----------------- | ----------------: | ----------------------------------------------------------------------- |
| Internet adoption |               701 | Source-bound private render passes; responsive/accessibility QA pending |
| EU renewables     |               562 | Corrected privately; new hash needs independent methodological review   |
| EU HICP           |               715 | Corrected privately; new hash needs independent methodological review   |
| Burned area       |               293 | Held for unresolved source lineage and rights                           |

## Material corrections

### HICP: historical year did not mean historical classification

The Step 16 draft said its 2018–2025 observations were under the _earlier_ ECOICOP classification.
That was wrong for the pinned extract. Its JSON response uses the `coicop18=TOTAL` dimension and
identifies `PRC_HICP_AINR` as the dissemination source. [Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm)
explains that ECOICOP version 2 is applied to recalculated historical back series while the old
series is separately archived. Eurostat's [dataset mapping note](https://ec.europa.eu/eurostat/databrowser-backend/api/public/explanatory-notes/get/Info_note_HICP_COICOP18_20260128.pdf)
maps `prc_hicp_ainr` to the version 2 annual dataset and `prc_hicp_aind` to the older version.
The classification block and SEO description now describe this extract as the revised back
series, without implying that all observations were first collected in 2026. The annual-rate
reading and distinction from an index level still hold. The approved 2024 and 2025 rates are
2.6% and 2.5%, respectively; the difference is −0.1 percentage points.

### Renewables: a later draft method was misapplied to 2024

The Step 16 text asserted an all-modes transport denominator including international bunkers and
said SHARES applied multipliers to both numerator and denominator. That specificity came from a
**2026 draft** SHARES manual and was not shown to govern the selected 2024 observation.
[Eurostat's source metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm)
and [2024 transport report](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1)
identify the 2021-onward series with RED II. [The directive's Article 27](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32018L2001)
distinguishes its specified road-and-rail denominator from renewable contributions across
transport sectors. The draft now uses that narrower, year-relevant framing and removes the
unverified all-modes-denominator and both-sides-multiplier claims. Eurostat's
[2024 heating/cooling note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1)
supports the examples of renewable heat and the rule against counting heat-pump-driving
renewable electricity twice. A reporting-year-specific SHARES operational calculation and the
final rendered citation placement still need independent confirmation.

The selected 2024 EU27 shares in the draft round from pinned values of 25.241% overall, 47.503%
electricity, 11.2% transport, and 26.738% heating/cooling. The cited 2021–2024 changes round
from 9.71 and 2.149 percentage points for electricity and transport. They are within-indicator
comparisons, not parts of one total.

## Remaining release gates

- No permitted browser surface was available for the local private HTML, so mobile/tablet/desktop
  visual QA, zoom/reflow, and screen-reader behaviour were **not completed**. No alternative
  browser or local-server workaround was used.
- The Internet preview lists sources at the end; a public version should place methodological
  citations adjacent to the relevant claims. The Eurostat drafts have no full rendered preview
  yet. HICP still needs a purposeful visual bound to approved metrics.
- Fact packs record public asset routes but `asset_id: null` and
  `asset_id_resolution: public_route_only`. Exact live asset identity, freshness, and current
  asset-level reuse rights have **not** been confirmed by this review.
- Burned-area 2025 GWIS/OWID source lineage and rights remain unresolved. Do not expand or publish
  that piece merely to meet the word-count target.

## Validation

- `node --import tsx scripts/editorial/validate-drafts.ts` — all four schemas passed after the
  corrections; all remain `draft`, `indexable: false`.
- `node --import tsx scripts/editorial/check-draft-depth.ts` — Internet 701, renewables 562,
  HICP 715; wildfire reported separately as held at 293.
- `node --import tsx scripts/editorial/render-internet-preview.ts` — regenerated from pinned
  analysis SHA-256 `be9a848d8eaef59ff605ddc16e04a82010e755b0f83c78803790854aa466b991`;
  output remained SHA-256 `aa684ddb8dfb2473d93f3f6424bc649b193bb706c67c98fa035ec18042ac80fb`.
- Prettier passed on the two edited JSON drafts.

No production code, route, sitemap, asset record, commit, or deployment was changed.

## Next step

**Step 18 — Luna:** independently verify the two corrected Eurostat draft hashes against
reporting-year-applicable primary sources, then prepare private metric-bound previews with
citations beside claims. Keep wildfire held and do not publish. For Internet, arrange an
explicitly permitted browser surface for responsive and assistive-technology QA before any
release decision.
