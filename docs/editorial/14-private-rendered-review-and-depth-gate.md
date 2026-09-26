# Step 15 — private preview review and editorial depth gate

**Date:** 2026-09-25  
**Workflow role:** Sol  
**Publication effect:** none. No production code, route, sitemap, indexation or asset rights changed.

## Decision

All four drafts remain **private and unapproved for publication**. Structural draft validation
passes, and every reviewed file matches the Step 14 manifest hash, but none satisfies the newly
required 500-word substantive-narrative minimum. A numeric minimum does not waive the separate
requirements for source accuracy, distinctive analysis, useful visuals, accessibility, and rights.

The count uses Unicode word tokens in `text` fields of `prose`, `finding`, `method`, and
`limitation` blocks. It excludes title, dek, headings, tables, captions, metadata, citations,
links, and the `reuse-note` / `attribution` legal boilerplate. The count is a screening rule;
human review must still reject padded or generic text.

| Brief             | Substantive words | Gap to 500 | Editorial disposition                                                            |
| ----------------- | ----------------: | ---------: | -------------------------------------------------------------------------------- |
| Internet adoption |               359 |        141 | Return for meaningful expansion and full-article rendering.                      |
| EU renewables     |               478 |         22 | Return for precise sector denominator explanations and contextual depth.         |
| EU HICP           |               374 |        126 | Return for an evidence-backed reading path through the series.                   |
| Burned area       |               293 |        207 | Hold for source-lineage resolution before any expansion or public consideration. |

## Review findings

### Internet adoption

The fixed-cohort framing, quartiles, equal-entity weighting, and percentage-point units are
coherent. The private HTML is only a chart summary, not the full draft. Its `noindex` directive,
single H1, SVG title/description, table headers, and text equivalent are present in source. But
the chart values and SVG coordinates are hard-coded: `data-metric-refs` labels the numbers without
deriving them from the pinned analysis result. A future renderer must bind the displayed values,
table, accessible description, and plot positions to the same approved metrics. The reference to
the internal JSON path in reader-facing source copy should become a normal methodology/source
note. At narrow widths the entire 760-unit SVG scales down, so axis and data labels may become
too small; actual viewport inspection is still required. Add useful interpretation of the
distribution and cohort selection, not speculative explanations for the variation.

### EU renewables

The revision correctly treats the four shares as distinct ratios and avoids reading the
2020–2021 methodology change as an ordinary trend point. The separate electricity and overall
denominators are clearer. The transport and heating/cooling paragraph still describes scope and
accounting without giving each sector's denominator as explicitly as the article promises.
Expand those two definitions from the cited Eurostat methodology and directive, explaining what
each ratio includes and why cross-sector arithmetic is invalid. Keep citations beside those
claims. Do not add general energy-transition prose to reach the minimum.

### EU HICP

The distinction between a positive annual-average rate, an index level, and a household bill is
sound. The 2026 classification warning is important. The five-year table provides selected
checkpoints but not yet a purposeful chart or a full reading path that helps readers compare
periods without implying unobserved monthly behaviour. Expand with specific, sourced reading
rules about the series, classification continuity, and what the selected rates do _not_ allow
one to calculate. A visual must resolve approved metric references rather than invent values.

### Burned area

The revised private preview accurately exposes the unresolved disagreement among OWID's Grapher
column timespan (2002–2025), OWID's indicator-origin description (through 2024), and GWIS's
public technical page (through 2023). That transparency does not resolve provenance or prove
asset-level reuse permission. The headline and recent-window calculation must remain private
until the precise release/API lineage and rights are independently confirmed. Only then is it
worth expanding the article; useful additions would explain the source's land-cover definitions,
satellite detection limits, and why a burned-area mean is not a measure of risk or human harm.

## Visual and accessibility verification status

The available browser interface rejected opening the local `file://` preview under its URL
security policy. No alternate browser route was used. Therefore **mobile, tablet, small-desktop,
and wide-desktop visual QA; zoom/reflow; and interactive screen-reader verification are not
claimed as passed**. Static source inspection found semantic table headers, an SVG accessible
name/description, and a mobile media query, but cannot prove legibility, clipping, focus order,
or assistive-technology behaviour. The next rendered-review step needs an explicitly permitted
browser surface and a full-body private preview.

## Validation and next action

- `node --import tsx scripts/editorial/validate-drafts.ts` passed for all four draft schemas.
- All four draft SHA-256 hashes and the two changed preview hashes match the Step 14 manifest.
- No content or page was published, committed, or deployed by this review.

**Step 16 — Luna:** revise the three source-ready drafts to at least 500 substantive words each,
preferably 550–800 only where the evidence earns the extra space. Keep the four articles
structurally different. Correct the renewable denominators, develop the HICP reading path, and
expand the Internet analysis without causal speculation. Render the _full_ Internet article from
pinned metrics in private materials. Do not turn the wildfire provenance conflict into a claimed
fact or release that article. **Step 17 — Sol** should repeat the word count and evidence review,
then perform real responsive and accessibility QA only if a permitted browser route is available.
