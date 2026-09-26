# Step 16 — substantive revisions and depth check

**Date:** 2026-09-25  
**Workflow role:** Luna  
**Manifest:** `data/editorial/private-revisions-manifest.json`  
**Publication effect:** none; drafts remain private and non-indexable.

## Revisions

- **Internet adoption:** expanded the article with interpretation of the interquartile spread,
  what an endpoint difference cannot show, and a practical rule for choosing an entity-weighted,
  population-weighted, or service-quality measure. Added the ITU's 2020 measurement manual for
  the recent-use definition. The draft has 701 substantive words.
- **EU renewables:** made the transport denominator and numerator explicit, including the covered
  transport fuels and the SHARES treatment of directive multipliers. Defined the separate
  heating-and-cooling denominator and its eligible renewable contributions. Added Eurostat's
  SHARES manual and retained the indicator-specific warning against adding the four ratios. The
  draft has 561 substantive words.
- **EU HICP:** extended the comparison table to all eight available annual rates for 2018–2025;
  explained how an annual-average rate compares calendar-year averages, added a practical
  geography/category/period/measure reading rule, and clarified why classification changes need
  a consistent series. The draft has 686 substantive words.
- **Burned area:** not expanded. Step 15's source-lineage and rights hold remains in force.

The counts use text in prose, finding, method, and limitation blocks. The checker excludes
headings, tables, captions, metadata, citations, asset links, and legal/attribution boilerplate.
Counts are minimum-depth checks, not a quality score; every added passage must still carry a
distinct, supported point.

## Source review

The added Internet definition follows the [ITU Manual for Measuring ICT Access and Use by
Households and Individuals](https://www.itu.int/en/ITU-D/Statistics/Documents/publications/manual/ITUManualHouseholds2020_E.pdf).
The sector boundaries and treatment described for the renewable indicators were checked against
[Eurostat's renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm)
and the [Eurostat SHARES tool manual](https://ec.europa.eu/eurostat/documents/d/energy/shares-manual).
The HICP reading explanation and classification note were checked against
[Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm)
and [annual-data description](https://ec.europa.eu/eurostat/databrowser/bookmark/74495a3b-094c-4bbe-95ef-d3183831ff4d?lang=en).

The source-specific rights, exact live Cite Supply asset IDs, and freshness still need Sol's
publication review. The public wildfire coverage discrepancy remains unresolved. Nothing in this
step approves those rights or releases any article.

## Source-bound Internet rendering

Added `scripts/editorial/render-internet-preview.ts`. It checks the pinned analysis file hash
against the draft, requires the paired-cohort gate to pass, resolves the quartiles from their
approved metric IDs, and derives the SVG positions, description, and table from those same values.
It renders the full article blocks and citations into the private HTML preview. The internal
repository file path was removed from reader-facing copy. A 500-word minimum is enforced by this
renderer.

The HTML source includes a keyboard-focusable scroll region for the chart and an equivalent
semantic table. Mobile and desktop appearance and screen-reader behaviour still need direct
browser review; no visual-browser pass is claimed in this step.

Added `scripts/editorial/check-draft-depth.ts` to make the substantive-word threshold repeatable.
It applies the 500-word gate to drafts not currently held for source lineage, and reports the
wildfire draft separately as held.

## Validation

- `node --import tsx scripts/editorial/validate-drafts.ts` — all four draft schemas pass.
- `node --import tsx scripts/editorial/render-internet-preview.ts` — generated the private preview
  from pinned analysis hash `be9a848d8eaef59ff605ddc16e04a82010e755b0f83c78803790854aa466b991`;
  rendered content count is 701 words.
- `node --import tsx scripts/editorial/check-draft-depth.ts` — Internet 701, renewables 561, and
  HICP 686 pass; burned area is reported as held for source lineage.
- Prettier check passes for the edited drafts, scripts, report, and manifests.

No production code, route, sitemap, indexability setting, asset record, commit, or deployment was
changed.

## Next step

**Step 17 — Sol:** independently recheck the revisions, counts, citations, metric bindings and
the private Internet preview. Complete real responsive and assistive-technology review only via
a permitted browser surface. Revisit source rights and live asset identity separately before
considering any publication.
