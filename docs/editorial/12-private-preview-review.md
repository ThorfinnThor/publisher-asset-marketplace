# Step 13 — independent private-preview editorial review

**Date:** 2026-09-25  
**Reviewer role:** Sol  
**Decision record:** `data/editorial/private-preview-review-decisions.json`  
**Publication effect:** none

## Decision

One of the four artifacts may advance to an actual **private rendered-review** stage. The other three have specific revisions to complete first. None is approved for publication, indexing, a public preview route, or a sitemap entry.

| Artifact                                | Step 13 decision                                  | Main reason                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet-use draft and Markdown preview | Approved for **private rendered review only**     | The fixed 175-entity cohort, 2000–2024 period, and 50.9/67.9/81.1 percentage-point quartiles match the locked analysis. The preview correctly rejects a population-weighted interpretation.                                                                                   |
| EU renewable-shares revised draft       | Revision required                                 | Its opening contains “100%” without a claim reference and fails the article validator. The 2024 transport/heating-and-cooling formula wording also needs a reporting-year-specific source rather than reliance on a linked 2026 draft manual.                                 |
| EU HICP revised draft                   | Revision required                                 | Its opening contains “2.5%” without a claim reference and fails the article validator. “Cannot be used to reconstruct an index level” should be narrowed: rates alone do not give an absolute index level without a base/index observation.                                   |
| Wildfire draft and Markdown preview     | Preview revision and source verification required | The arithmetic agrees with the locked analysis, but the preview calls the 2025 lineage reconciled too strongly. The pinned OWID indicator says 2002–2025 while its own origin description still says 2002–2024; the public GWIS method page says displayed data through 2023. |

The Step 11 copy decisions remain historical decisions for their exact draft hashes. This review does not overwrite them. The Internet and wildfire previews are Markdown layout specifications, **not rendered charts**; the private-rendered approval for Internet is permission to build and inspect one, not an approval of an unseen visual.

## Evidence and required corrections

### Internet use — advance only to private rendering

The preview's three displayed quantiles round from the approved analysis values (50.914596965, 67.92761, and 81.0649854 percentage points). The analysis records 175 paired entities. The preview labels those observations as a matched country-or-area cohort, not as a global average, and carries the source definition and coverage caveat. In the actual private visual, resolve each displayed value from the four approved IDs listed in the preview; keep the cohort count, units, time window, and OWID/ITU/World Bank attribution adjacent to the figure. Review that rendered result at mobile and desktop sizes before any later publication decision.

### Renewables — return for precise source and schema repair

The four reported EU27 2024 shares and the cited 2021–2024 within-indicator changes agree with the locked analysis. [Eurostat's renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm) confirms four different indicators, the electricity formula, and the RED I/RED II break at 2020–2021. The text now has a useful indicator-by-indicator structure. However:

1. Attach an approved claim reference to the opening's “100%” comparison, or remove the numerical expression. Do not weaken the validator.
2. Anchor the specific RES-T and RES-H&C denominator/accounting explanation to a source applicable to **2024 / RED II**. The linked current SHARES manual is marked a 2026 draft; the draft's generic disclaimer is not enough to make a later formula automatically valid for 2024. Clarify that the heating-and-cooling denominator excludes electricity where applicable, and avoid presenting every eligible component as a simple unadjusted sum.
3. Keep direct source/method citations close to those explanations in the eventual rendered article. The present JSON citation list alone does not determine visible placement.

### HICP — return for schema and interpretation repair

The 2024 and 2025 rates (2.6% and 2.5%) and the −0.1 percentage-point rate change match the locked analysis. The distinction between an annual-average rate, monthly changes, and household expenses is useful. [Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm) confirms that the 1996–2025 ECOICOP series is frozen except for corrections, while 2026 uses ECOICOP version 2 with recalculated back series. However:

1. Attach `hicp-rate:2025` to the opening containing “2.5%”; then rerun the draft validator.
2. Replace the categorical reconstruction claim with a precise one: these annual rates **alone** cannot supply an absolute index level or a personal cost-of-living estimate; an index base/reference observation would be needed for a level. Do not infer an unapproved cumulative inflation number.
3. At rendering, turn the checkpoint table into a genuinely annotated rate-reading path, with year, rate units, and the 2024–2025 interpretation visibly connected. Five rows without that treatment would not satisfy the Step 11 request for a purposeful visual.

### Wildfire — retain the draft's copy approval, return the preview

The four earlier/later means and rounded differences in the preview match the locked analysis. The separate category treatment and satellite-detection caveat are appropriate. The source-lineage language is not yet safe to promote:

1. The pinned OWID Grapher metadata gives the four columns a **2002–2025** timespan and a **2026-09-11** `lastUpdated` value. The pinned OWID indicator metadata gives its origin a **2002–2024** description and `dateAccessed: 2026-09-11`. Those fields have different meanings and disagree on coverage; do not merge them into “access/update date” or call the mismatch reconciled.
2. The [GWIS burnt-area technical page](https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/burnt-areas) still states that GWIS displays data through **2023**. Its public scope could differ from the country-profile API; it does not establish that the page is simply stale. OWID's origin text says it fetched from that API, but that is not independent confirmation of the 2025 API values or OWID processing.
3. Reword the preview's source section as an **unresolved coverage/version discrepancy**, preserving the exact OWID metadata fields, provenance hashes, and acquisition date. Verify the current API/release notes and asset-level rights independently before any public article decision. The [GWIS licence](https://gwis.jrc.ec.europa.eu/about-gwis/data-license) states CC BY 4.0 for EU-owned website content unless otherwise indicated and warns about third-party material; do not treat the general licence as an automatic asset-level clearance.
4. Add an explicit row-to-metric-reference mapping for the twelve displayed values. The current preview claims that every mapping is in the Step 12 report/manifest, but neither document contains that row-level mapping. Keep rounding rules visible, especially the forest row where the displayed endpoint subtraction differs from the independently rounded difference.

## Validation and scope

The targeted schema validation was run with `node --import tsx` because the repository's `tsx` CLI could not create its IPC socket in this sandbox (`EPERM`); this execution workaround did not change application code. Results: Internet **pass**, wildfire **pass**, renewables **fail** on `numeric_block_requires_claim_reference:opening`, HICP **fail** on the same error. The full `npm run editorial:drafts:check` therefore does **not** pass. File hashes match the Step 12 manifest, and the Step 11 decision record was not modified.

This step only records independent editorial decisions. It does not correct the drafts itself, render charts, alter production code or assets, commit, deploy, create routes, or change sitemap/indexing.

## Next step

**Step 14 — Luna:** make the two Eurostat revisions, correct the wildfire preview/provenance and metric mapping, and prepare an actual source-bound **private** Internet rendering. Then run the targeted validator and return the new exact hashes for Sol review. Public release gates—live asset IDs, freshness, rights, wildfire source confirmation, responsive/accessibility review, and final citation placement—remain closed.
