# Step 19 — independent Eurostat preview review

**Date:** 2026-09-25  
**Review role:** Sol  
**Decision record:** `data/editorial/private-eurostat-preview-review-decisions.json`  
**Publication effect:** none.

## Decision

Both Eurostat previews remain private and require targeted revision. Their data binding, hashes,
schema status, substantive word counts, no-index directives, accessible SVG names, and equivalent
tables pass the repeatable static checks. The review did not find an incorrect displayed metric.
It did find citation and chart-construction defects that prevent either artifact from advancing
to a release decision.

The renewables draft remains at 562 substantive words and the HICP draft at 715. Those counts are
adequate; the next revision must fix evidence placement and visual meaning rather than add more
text.

## Renewables findings

The four 2024 shares and four 2021–2024 within-indicator changes match the locked analysis.
[Eurostat's renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm)
supports the four separate indicators, RED I/RED II break, and RES-E denominator. Its current
[2024 transport article](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1)
confirms the 11.2% EU result and describes transport coverage and renewable inputs. The private
draft's broad caution—that RES-T is an accounting share rather than a share of journeys—is sound.

Two citation defects remain:

1. The paragraph describes the earlier RED II Article 27 denominator for the 2021–2024 series,
   but its adjacent citation is the directive consolidated on 20 November 2023 after the RED III
   amendment. The cited text and described rule are not the same legal version. The next revision
   must cite an official text that actually governed the selected 2024 series and state the
   version/date clearly.
2. The same paragraph then makes heating-and-cooling claims, but the renderer adds only the
   directive link beneath it. Eurostat's [2024 heating-and-cooling methodological note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1)
   directly supports the listed sources and heat-pump double-counting rule. That source must be
   adjacent too, or the transport and heating material should be split into separately sourced
   blocks.

The bar chart is useful as a visual comparison because every bar is labelled and its description
warns that the indicators cannot be added. Its y-axis has no tick labels, but each bar has a
numeric value and the exact table is adjacent, so this is not treated as a blocking defect. Actual
small-screen label wrapping and horizontal scrolling still require browser inspection.

## HICP findings

The 2018–2025 values, 2024/2025 comparison, units, and ECOICOP version-2 correction agree with the
locked extract and [Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm).
Eurostat's dataset description also supports the draft's explanation that the annual-average rate
compares a calendar year's average of monthly indices with the previous calendar year's average.

The private visual has two construction problems:

1. The x-axis and grid end at `x=650`, while the 2025 point and label are plotted at `x=686`.
   The final observation is therefore outside the drawn axis domain. The renderer must calculate
   the axis endpoint from the same scale used for all eight observations.
2. The chart provides only a percent symbol, year labels, and a line. It has no y-axis tick values,
   point markers, or plotted value labels. The table preserves exact values, but the chart itself
   does not yet function as the purposeful rate-reading path requested in earlier reviews. Add a
   small number of clear scale labels and bind point/value labels to the same approved metrics.

The classification block links the general HICP metadata, which supports full-series ECOICOP
version 2 back data. Because the paragraph specifically names `PRC_HICP_AINR`, it should also link
Eurostat's official dataset mapping note directly. That keeps the exact table-to-classification
claim reproducible rather than leaving the mapping only in the internal review report.

## Browser and accessibility status

The browser-verification workflow requires a permitted browser URL. These previews exist only as
local private files, and the current browser surface does not permit opening them. No local-server,
alternate-browser, or deployment workaround was used. Therefore smartphone, tablet, desktop,
zoom/reflow, focus visibility, and screen-reader behaviour remain **unverified**. Static checks do
not substitute for that review.

## Validation repeated

- Both draft and preview hashes match the Step 18 manifest.
- `node --import tsx scripts/editorial/validate-drafts.ts` passes all four draft schemas.
- `node --import tsx scripts/editorial/check-draft-depth.ts` reports 701, 562, and 715 words for
  the three source-ready drafts; wildfire remains held at 293.
- `node --import tsx scripts/editorial/check-private-eurostat-previews.ts` passes the recorded
  hashes and structural checks. This test is too broad to detect the legal-version mismatch,
  missing second adjacent source, or the HICP axis-domain defect; those were found by human
  review.

No draft, renderer, production code, route, sitemap, asset, commit, or deployment was changed in
this review.

## Next step

**Step 20 — Luna:** fix the HICP scale and labels, add the dataset-mapping citation, and split or
dual-source the renewable transport/heating block using the correct 2024-applicable official legal
text. Strengthen the static checker so it verifies the required citation IDs and chart-domain
invariants rather than merely counting source links. Regenerate both private previews and return
new exact hashes for Sol review. Do not publish.
