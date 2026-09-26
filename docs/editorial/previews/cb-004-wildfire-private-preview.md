# PRIVATE EDITORIAL PREVIEW — NOT PUBLISHED

**Purpose:** source-bound layout review for Step 12. This file is an internal Markdown preview only; it has no application route, canonical URL, sitemap entry, or indexable state.

# Burned-area estimates differ across four land-cover series

## Two windows, four separate comparisons

In the OWID World series, the mean annual burned area in 2021–2025 is lower than in 2002–2006 for each of the four source-defined land-cover series shown below. Each row compares one category with itself. The categories are not added into a total, and hectares burned are not a count of fires, severity, emissions, damage, or risk.

| Land-cover series         |                                                  2002–2006 mean per year |                                                   2021–2025 mean per year |                                                   Difference (later minus earlier) |
| ------------------------- | -----------------------------------------------------------------------: | ------------------------------------------------------------------------: | ---------------------------------------------------------------------------------: |
| Forest                    |                 32.5 million ha (`wildfire-mean:forest:early_2002_2006`) |                 27.9 million ha (`wildfire-mean:forest:recent_2021_2025`) |                 −4.7 million ha (`wildfire-mean-difference:forest:early-v-recent`) |
| Savannas                  |              193.2 million ha (`wildfire-mean:savannas:early_2002_2006`) |              154.8 million ha (`wildfire-mean:savannas:recent_2021_2025`) |              −38.4 million ha (`wildfire-mean-difference:savannas:early-v-recent`) |
| Shrublands and grasslands | 183.4 million ha (`wildfire-mean:shrublands_grasslands:early_2002_2006`) | 144.4 million ha (`wildfire-mean:shrublands_grasslands:recent_2021_2025`) | −39.0 million ha (`wildfire-mean-difference:shrublands_grasslands:early-v-recent`) |
| Croplands                 |              40.4 million ha (`wildfire-mean:croplands:early_2002_2006`) |              25.3 million ha (`wildfire-mean:croplands:recent_2021_2025`) |             −15.1 million ha (`wildfire-mean-difference:croplands:early-v-recent`) |

**Rounding:** means and differences are calculated from full-precision observations independently, then shown to one decimal million hectares. Therefore the visible forest endpoints (27.9 minus 32.5) do not reproduce the separately rounded −4.7 difference exactly.

**Visual treatment for future rendered article:** four small-multiple dumbbell charts, one per land-cover series. Give each panel its own visible axis and the same two labelled windows; do not visually stack or sum categories. Place the detection caveat directly under the figure.

These are arithmetic means of annual satellite-derived estimates within each five-year window. Satellite products can miss burned area and fire occurrence; the series does not explain why the estimates changed. This is a comparison of observed estimates in a particular source release—not a claim that wildfire harm or risk universally declined.

## Coverage and version discrepancy still unresolved

The pinned OWID Grapher column metadata describes a 2002–2025 timespan and records `lastUpdated: 2026-09-11`. The separate OWID indicator origin metadata describes 2002–2024, records `dateAccessed: 2026-09-11`, and says the data came through the GWIS country-profile API. These dates describe different fields; neither resolves the one-year coverage mismatch. The origin metadata also says the API may be newer than the bulk ZIP and that the ZIP had all-zero 2024 values at the time it was checked.

GWIS's public burnt-area method page still says that GWIS displays data from 2001 through 2023. That may reflect different coverage for the public display and the country-profile API, but the available metadata does not prove that explanation. Treat 2024–2025 coverage and the transformation chain as unresolved until the current API or a GWIS release record independently confirms them. Keep this article unpublished until source lineage, current values, and asset-level rights are checked.

The evidence fields are not interchangeable: Grapher column `timespan` and `lastUpdated`, indicator origin `description` and `dateAccessed`, the pinned CSV retrieval timestamp (23 September 2026), and GWIS's public-page coverage statement each describe a different artifact or check.

### Provenance and citations

- [OWID source chart](https://ourworldindata.org/grapher/area-burned-wildfires-by-type)
- [GWIS burnt-area method note](https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/burnt-areas)
- [GWIS data licence](https://gwis.jrc.ec.europa.eu/about-gwis/data-license)
- Pinned CSV SHA-256: `97704c3480477739ec1ad280ebe4bc7e392fe845b36b84b42746013dfa3657ea`.
- Pinned Grapher metadata SHA-256: `af8d91eda5a30d68e92407cc0fe69991ae3c38003616f861d0520a2078622000`.
- Snapshot paths and checksums are listed in the Step 12 private-preview manifest. The table above maps every displayed value to its approved metric ID in `data/editorial/analysis-results.json`.

**Release hold:** confirm the exact live Cite Supply asset, current source and rights, provider lineage, source notes, and final figure labels before considering publication.
