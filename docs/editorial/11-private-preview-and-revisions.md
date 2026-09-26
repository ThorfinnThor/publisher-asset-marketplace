# Step 12 — revisions and private source-bound previews

**Date:** 2026-09-24  
**Workflow role:** Luna  
**Publication effect:** none  
**Artifact manifest:** data/editorial/private-preview-manifest.json

## Completed

The two drafts returned in Step 11 were revised for another Sol review:

- **EU renewable shares:** reorganised as an indicator-reading guide. It now explains the different sector scopes, gives the electricity denominator, describes the transport and heating/cooling accounting scopes, and distinguishes the whole-system denominator. The 2026 SHARES manual is explicitly identified as a draft where formula detail needs current-year confirmation. Four within-indicator percentage-point changes remain separate; the 2020–2021 RED I/RED II break remains qualified.
- **EU HICP:** changed from an eight-value data dump to a worked reading path. It interprets the 2025 annual-average rate against 2024, distinguishes the rate from an index level and household bill, uses selected checkpoints, and explains that the pre-2026 ECOICOP series is frozen while ECOICOP v2 applies from 2026. No cumulative inflation calculation or monthly claim was added.

Private source-bound Markdown previews were prepared for the two Step 11 copy approvals:

- docs/editorial/previews/cb-001-internet-use-private-preview.md resolves the cohort count and three quantiles into a compact distribution preview, with the fixed-cohort label adjacent to the visual specification.
- docs/editorial/previews/cb-004-wildfire-private-preview.md resolves the approved five-year means into a four-row small-multiples specification, keeps land-cover types separate, and puts the satellite detection caveat next to the proposed figure.

Both previews are repository documents only. There is no preview route, canonical URL, sitemap entry, or indexable state.

## GWIS / OWID source-lineage finding

The earlier discrepancy is partly resolved, but the distinction must remain visible:

1. The public GWIS burnt-area explanation page currently says its displayed data run through 2023.
2. The pinned OWID chart metadata (SHA-256 af8d91…2000, retrieved 23 September 2026) identifies GWIS as provider, cites GWIS (2026), gives an 11 September 2026 access date, describes a 2002–2025 span, and lists CC BY 4.0.
3. That metadata says the series was fetched from the GWIS country-profile API and warns that the GWIS bulk ZIP was less current and had all-zero 2024 values at that time.

So the 2025 observations have a stated newer API-based lineage; the public explainer page is stale relative to that snapshot. This is not independent confirmation of the API observations or every OWID transformation. Do not present the discrepancy as definitively verified: before publication, confirm the current API lineage, values, and asset-level rights. The preview says so plainly.

The relevant primary references are [Eurostat's renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm), the linked [SHARES manual](https://ec.europa.eu/eurostat/web/energy/database/additional-data) (the current manual is marked draft), [Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm), [GWIS burnt-area technical background](https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/burnt-areas), and the [GWIS data licence](https://gwis.jrc.ec.europa.eu/about-gwis/data-license).

## Audit trail and remaining gates

The Step 11 decision record is intentionally preserved as the historical review of the exact earlier draft hashes. The updated hashes and preview hashes are in data/editorial/private-preview-manifest.json; no historic review decision has been silently rewritten. In particular, both revised Eurostat articles are submitted back to Sol for a new copy decision, not self-approved by this drafting step.

Still required before any public release:

- Sol re-review of the two revised drafts and the source-bound previews.
- Resolve all four asset slugs to current live asset IDs and re-check source freshness, attribution, and asset-level rights.
- Independently confirm the current GWIS API/provider chain and 2025 series.
- Review final rendered pages at responsive breakpoints, including citation and caveat placement.

No production code, public route, sitemap, indexing policy, live data, rights record, commit, or deployment was changed. No test suite was run in this drafting step; the reported SHA-256 values identify the files but are not validation results.

## Next step

**Step 13 — Sol:** independently review both revised Eurostat articles and both private previews; decide whether to approve only for a later private rendered-review stage or return specific changes. Keep every article unpublished and non-indexable.
