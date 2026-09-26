# Step 11 — independent editorial review

**Date:** 2026-09-24  
**Reviewer role:** Sol  
**Decision record:** `data/editorial/article-review-decisions.json`  
**Publication effect:** none

## Decision

The four private drafts pass the evidence-reference validator after the corrections below. Two can proceed to a private preview; two return for editorial revision. This is a copy decision only. None is approved for a public route, sitemap, or indexation.

| Brief                           | Copy decision                | Reason                                                                                                                                                                                      |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet use, matched cohort    | Approved for private preview | The 175-entity paired cohort, percentage-point quartiles, source definition, and limitations now align with the reviewed facts. A distribution visual should retain the fixed cohort label. |
| EU renewable shares             | Revision required            | The metric comparison is correct, but the text should explain the four denominators and accounting rules more concretely; it currently relies heavily on a table.                           |
| EU annual-average HICP          | Revision required            | The rate interpretation is now accurate, but the series needs a purposeful visual or worked reading path to add more value than the source table.                                           |
| World burned area by land cover | Approved for private preview | The period means and forest example match the approved metrics, with categories kept separate. The later-year source lineage requires an additional check before public release.            |

The calculator guide remains held as recorded in Step 9.

## Claim and source checks

- **Internet use:** The reviewed analysis has 175 paired UN M49 country-or-area entities. All paired changes in the snapshot are positive. Its displayed quartiles are 50.9, 67.9, and 81.1 percentage points. The [OWID indicator page](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet) defines use within the last three months and credits ITU via the World Bank. The draft now describes the cohort as a selection from source observations using the UN reference rather than as a source-defined list or a global average.
- **Renewables:** The four 2024 EU27 shares and the four within-category changes from 2021 are the exact approved metrics. [Eurostat metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm) confirms four separate indicators and the RED I/RED II break between 2020 and 2021. The title now asks how to read the shares rather than suggesting a causal explanation.
- **HICP:** The reviewed EU27 annual-average rate is 2.6% for 2024 and 2.5% for 2025, a change of −0.1 percentage points in the rate. A positive annual-average rate means the average index exceeds the previous year's average; it does not establish an increase in every month. [Eurostat HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm) defines the expenditure scope and describes the revised classification from 2026.
- **Wildfire area:** The reviewed OWID World extract supports two five-year means for each of four land-cover categories, and each later mean is lower. The forest means display as 32.5 and 27.9 million hectares. [GWIS technical background](https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/burnt-areas) supports the satellite and event-interpretation caveats. Its public page still says displayed data run through 2023, while the pinned OWID metadata is updated in September 2026 and includes 2025. This may be stale GWIS web copy; the source lineage must be reconciled before publication rather than silently assumed.
- **Reuse:** The [Eurostat notice](https://ec.europa.eu/eurostat/help/copyright-notice) allows commercial reuse with attribution, subject to exceptions, and requires modified data to be identified with a non-responsibility disclaimer. Both Eurostat drafts have that notice. The [GWIS licence page](https://gwis.jrc.ec.europa.eu/about-gwis/data-license) requires appropriate credit and indication of changes. These checks do not replace a final asset-level rights review.

## Corrections made during review

1. Rewrote ambiguous SEO copy and fixed-cohort language in the Internet draft; clarified its provider chain and quantile labels.
2. Put the actual comparison years and approved values next to the renewable, HICP, and wildfire findings; corrected the renewable headline and narrowed HICP's conclusion to annual averages.
3. Added the GWIS primary method citation and corrected draft timestamps that had been midnight placeholders.
4. Closed a validator gap: a draft can cite a raw fact only if that fact contributes to an approved metric for its brief. This prevents the World-only wildfire draft from citing unrelated country observations. The validator now also requires the exact asset source URL and rejects duplicate asset slugs.

## Revisions and release checks

Luna should revise the renewable and HICP drafts against the concrete requests in the decision record. The four articles should not all render as the same sequence of introduction, finding, table, method, and caveat. The Internet analysis can lead with its distribution; the renewable page can explain category definitions; HICP can teach the annual-average interpretation; wildfire can compare the two windows with detection limits visible. The data tables currently store metric references, so any private preview renderer must resolve values and units from the locked analysis output.

Before public approval, resolve each `asset_id: null` against the live marketplace, confirm current source values and rights, review exact citation placement, and check final responsive rendering and links. The wildfire source-year discrepancy also needs a documented resolution. No creator calculator is included.

## Verification

`npm run editorial:drafts:check` passed for all four private drafts. The targeted Vitest suites passed 17 tests, including a new regression for the raw-fact scope and required source citation. Typecheck, targeted ESLint, and Prettier checks passed for the changed code and records.

No production code path was changed, and there was no commit or deployment.

## Next step

**Step 12 — Luna:** revise the renewable and HICP copy, prepare source-bound private preview layouts for the two copy-approved drafts, and resolve the wildfire metadata discrepancy through primary-source evidence. Keep all pages private and non-indexable. Return the revised artifacts to Sol for the next editorial gate.
