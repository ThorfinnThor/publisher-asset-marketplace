# Step 20 — private Eurostat preview revisions

**Date:** 2026-09-25  
**Workflow role:** Luna  
**Manifest:** `data/editorial/private-eurostat-preview-manifest.json`  
**Decision record:** `data/editorial/private-eurostat-preview-revision-decisions.json`  
**Publication effect:** none. Both documents remain standalone private previews with
`noindex`, `nofollow`, and `noarchive`; no public route or sitemap entry was created.

## What changed

The renewables draft now separates its transport explanation from its heating-and-cooling
explanation. The transport block links directly to Eurostat's 2024 transport release, and the
heating-and-cooling block links directly to Eurostat's 2024 explanation of renewable heat,
cooling, and heat-pump accounting. The earlier adjacent consolidated-directive citation was
removed because its revision state did not cleanly match the 2021–2024 reporting-period claim.
The draft remains an EU27 aggregate reading guide and does not add the four sector percentages.

The HICP preview now uses a single declared chart domain from x=75 to x=700 and y=0 to y=10.
All eight annual points, including 2025, are inside that domain. Y-axis tick values, point
markers, and plotted value labels make the visual readable without requiring the table; the
table remains the exact accessible equivalent. The classification block is linked to
Eurostat's direct dataset-mapping note for `PRC_HICP_AINR` and ECOICOP version 2.

## Private outputs

- [EU renewable-energy preview](/Users/schayan/Projects/backlink_marketplace/docs/editorial/previews/cb-002-renewables-private-rendered.html)
  — 591 substantive words; draft SHA-256
  `40cfab87d2c7bd8aa683cb9e699c9aeb4969d3cb56fdab78e401fec5d789e436`; preview SHA-256
  `a0cd178ee89dd23f6bfa6d9b6e72629682802458bd0dcde7ab43f28bb39cb290`.
- [EU HICP preview](/Users/schayan/Projects/backlink_marketplace/docs/editorial/previews/cb-003-hicp-private-rendered.html)
  — 715 substantive words; draft SHA-256
  `dfd79de90f9e9f5336f6e3e4ff7543ab0f07d7af94edcddbeee14ccd590f13b1`; preview SHA-256
  `e937d528758dcc5ec5e2643edeeb27fd67ed41741fd0e1ccbfe776786d0c5887`.

## Validation

- Prettier passed for the changed drafts, renderer, checker, and manifest.
- `validate-drafts.ts` passed all four drafts; all remain private/non-indexable.
- `check-draft-depth.ts` passed the 500-word gate for Internet (701), renewables (591), and
  HICP (715); wildfire remains held at 293 pending source lineage and rights.
- `render-eurostat-previews.ts` regenerated both previews from analysis SHA-256
  `be9a848d8eaef59ff605ddc16e04a82010e755b0f83c78803790854aa466b991`.
- `check-private-eurostat-previews.ts` passed private directives, single H1, SVG accessibility
  metadata, equivalent tables, approved metric bindings, required direct source links, the HICP
  chart-domain invariant, eight point markers, and eight value labels.
- The three existing editorial Vitest files passed: 3 files, 23 tests.

## Gates still closed

Browser visual and assistive-technology QA remains pending because no permitted browser surface
can open these local private files. Live asset identity (`asset_id`), freshness, asset-level
rights, and publication eligibility remain unresolved. No production code, route, sitemap,
commit, or deployment was changed.

## Next step

**Step 21 — Sol:** independently review the revised private previews and hashes, verify that the
new source adjacency and chart-domain checks are meaningful, and decide whether either article
can advance. Keep the public release gate closed until that review and the live asset identity,
freshness, rights, and permitted visual QA are complete.
