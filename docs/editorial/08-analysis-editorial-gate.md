# Step 9 — calculation and interpretation review

- Date: 2026-09-23
- Reviewer role: Sol
- Input: `data/editorial/analysis-results.json` (SHA-256 `be9a848d8eaef59ff605ddc16e04a82010e755b0f83c78803790854aa466b991`), four fact packs, Step 7 decisions, and the Step 8 generator
- Decision record: `data/editorial/draft-decisions.json`
- Result: four narrowly scoped briefs may proceed to **private article drafts**; the creator guide remains held
- Production, indexing, and publication effect: none

## Review of calculations

The regenerated Step 8 output passed all 13 source snapshot checksum checks. A separate lineage pass resolved the input fact IDs for all 211 emitted metrics against the matching source pack and found no duplicate metric IDs. These checks support the calculations in the pinned snapshots. They do not establish current source freshness or final reuse permission.

| Brief                    | What the reviewed result supports                                                                                                                    | Editorial decision                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet use             | 175 matched UN M49 country-or-area entities with values in both 2000 and 2024; change distribution p25 50.9, median 67.9, p75 81.1 percentage points | Draft a paired-cohort trend analysis. Reframe the old question about the “latest country distribution”: Step 8 calculated a distribution of **changes**, not of 2024 levels. Do not call the cohort 175 sovereign countries. |
| EU renewable shares      | Four separate EU27 shares in 2024: overall 25.2%, electricity 47.5%, transport 11.2%, heating/cooling 26.7%; changes within each category since 2021 | Draft an EU indicator comparison. The initial member-country comparison and `geographic_comparison` format remain unsupported. The source documents a 2020/2021 RED I/RED II break and distinct indicator definitions.       |
| EU HICP                  | EU27 annual-average rates in 2018–2025; 2024 2.6%, 2025 2.5%, a −0.1 percentage-point change in the **rate**                                         | Draft an indicator explainer. A positive but lower inflation rate does not show falling prices. The pack has no country, euro-area, monthly, or household-specific observations.                                             |
| World burned area        | Four land-cover series, each comparing mean annual area in 2002–2006 with 2021–2025                                                                  | Draft a comparison of the source's four World series. Keep categories separate; all four recent means are lower in this snapshot, but the estimates do not measure fire harm or establish causes.                            |
| Creator calculator guide | Verification checklist only; no computed metrics                                                                                                     | Hold until the live checks are performed and recorded.                                                                                                                                                                       |

The internet source defines the measure as use in the preceding three months and attributes the indicator to ITU via World Bank, with OWID processing. It is not an access-quality measure. The [OWID data page](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet) supports this framing. The M49 reference classifies **countries or areas**, which includes territories; the source's aggregates and unresolved Kosovo code are excluded from the paired cohort. The cohort median describes equally weighted entities, not a population-weighted global share.

[Eurostat's renewable-energy methodology](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm) identifies the four indicators and the RED I/RED II break. [Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm) distinguishes index levels and rates, describes the household-consumption coverage, and notes the classification and base-period change from 2026. The wildfire pack preserves the [GWIS source licence](https://gwis.jrc.ec.europa.eu/about-gwis/data-license) and the source's satellite-detection caveat. No causal explanation follows from the period means alone.

## Code review correction

Step 8 initially used internet observations without checking their source status, possible percentage range, or alignment of source entity fields. The shared pack gate also accepted a changed rights declaration or duplicate fact ID. Step 9 added fail-closed checks for those cases and for invalid selected World burned-area values and dimensions. The 12 targeted regression tests, TypeScript typecheck, targeted ESLint, and Prettier now pass. The regenerated analysis output and its checksum remain the reviewed artifact.

## Draft boundaries

The decision JSON names the allowed metrics, revised questions and theses, required labels, and blocked claims for each brief. A draft may refer to a source fact directly when it uses the fact ID. A new quantitative summary needs a deterministic metric before it appears in an article. For example, the reviewed Internet distribution is about changes between two years; a claim about the distribution of 2024 levels needs its own calculation and review.

Every draft needs the source link, precise unit, geography, period, method, and limitation near its findings. Eurostat says that modified data must be identified as such and accompanied by a non-responsibility disclaimer; its commercial reuse policy also lists exceptions. See the [Eurostat reuse notice](https://ec.europa.eu/eurostat/help/copyright-notice). The OWID and GWIS drafts must credit the underlying providers as well as the presentation source.

All four fact packs still have `asset_id: null` with `asset_id_resolution: public_route_only`. Their rights information is a reviewed candidate snapshot. Before public release, resolve each exact Cite Supply asset, verify it is still published, check its current rights and the source licence, and confirm source freshness. The Eurostat facts were generated from verified, checksummed snapshots after the local live API refresh failed certificate verification; there is no fresh live Eurostat retrieval in this review.

The pilot aimed for five calibration articles across multiple formats. Four briefs are ready for private drafts; the fifth remains held. Do not fill that slot with a generic article merely to meet the count.

## Next step and model

**Step 10 — Luna:** write four distinct private article drafts from the approved metrics and source facts, with explicit fact-ID references and the limitations above. Keep the creator guide held. Add the draft schema and claim-reference checks before any route or indexability work. Return drafts to Sol for editorial review in Step 11. No commit, deployment, or publication in Step 10.
