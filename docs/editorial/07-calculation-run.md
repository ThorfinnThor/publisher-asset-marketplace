# Step 8 — deterministic calculation run

- Date: 2026-09-23
- Model role: Luna implementation
- Status: calculation artifacts generated for Sol review
- Output: `data/editorial/analysis-results.json`
- Generator: `scripts/editorial/build-analyses.ts`
- Calculation code: `src/lib/editorial/analysis.ts`
- Tests: `test/editorial-analysis.test.ts`
- Production effects: none

## Results

| Brief                     | Result                                                      | Calculation summary                                                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cb-001` Internet use     | `calculated_for_sol_review`; conditional cohort gate passed | 212 source entities map to UN M49 country-or-area codes, 12 are explicitly listed source aggregates, and `OWID_KOS` remains unresolved. The paired 2000/2024 cohort has 175 entities. The output contains one percentage-point change per paired entity and three Type 7 quantiles. |
| `cb-002` Renewable shares | `calculated_for_sol_review`                                 | Four EU27 category values for 2024 and four 2021–2024 within-category changes. Values are kept separate because categories have distinct denominators.                                                                                                                              |
| `cb-003` HICP             | `calculated_for_sol_review`                                 | Eight EU27 annual-average rates (2018–2025) and the 2024–2025 change in the rate: −0.1 percentage points.                                                                                                                                                                           |
| `cb-004` Burned area      | `calculated_for_sol_review`                                 | For four World land-cover series, early and recent five-year means, their absolute differences, and relative differences.                                                                                                                                                           |
| `cb-005` Creator guide    | `held`                                                      | No metrics. The creator verification checklist still requires live checks.                                                                                                                                                                                                          |

### Internet-use cohort

The UN M49 reference has 248 alpha-3 country-or-area entries. It was retrieved from the [UN Statistics Division M49 table](https://unstats.un.org/unsd/methodology/m49/overview) on 2026-09-23. The pinned response hash is `f82b4d5f3f18a43d54206ba841d255886f82fcb5e3f4412360eb2e02f2f0ea90`; the normalized entry hash is stored in the reference JSON. Twelve additional entity codes are explicitly classified as aggregates using a versioned override list tied to the saved OWID chart metadata. Kosovo's `OWID_KOS` code does not match the selected M49 table and remains unresolved, so it is excluded.

The cohort is a source-defined set of **country-or-area entities**, not a statement about sovereign statehood. The output reports 175 entities with non-missing 2000 and 2024 observations, above the pre-set minimum of 150. Its distribution of change has a 25th percentile of 50.9 percentage points, median of 67.9 points, and 75th percentile of 81.1 points. These use the linear-interpolated sample quantile Type 7 formula on the same paired cohort. Aggregate entities, the unresolved entity, and the sparse 2025 observations are excluded.

### Eurostat renewable shares

The values for 2024 are overall 25.2%, electricity 47.5%, transport 11.2%, and heating/cooling 26.7%. Within-category changes from 2021 through 2024 are respectively +3.3, +9.7, +2.1, and +3.7 percentage points. Each calculation links the 2021 and 2024 source fact IDs. The 2020–2021 methodology break remains in the explanation; the 2025 records are not used.

### HICP and wildfire

HICP's 2025 annual-average rate is 2.5%, compared with 2.6% in 2024. The difference is −0.1 percentage points in the **rate of change**, not a decrease in the price level.

The World burned-area calculations compare annual means for 2002–2006 and 2021–2025. At the shown precision, recent means are lower by 4.7 million hectares for forest, 38.4 million for savannas, 39.0 million for shrublands/grasslands, and 15.1 million for croplands. These categories are not summed. The source's satellite-detection limitation travels with the results.

## Integrity and verification

- The generator validated all four input fact packs against the Zod schema.
- All 13 referenced source snapshots matched their recorded SHA-256 checksums before calculation.
- The M49 reference's entry count and normalized list checksum passed before it could classify entities.
- Every calculated metric contains one or more source `fact_id` values, formula name/version, dimensions, units, and display precision. Source observations are likewise linked to their single fact ID.
- Missing facts, duplicate facts, an unclassified geography, altered Eurostat scope or flags, an incomplete wildfire window, and a non-positive relative-change denominator fail closed.
- The targeted test suite passed: 12 tests after the Step 9 review tightened the input status, value, dimension, fact-ID, and rights preconditions. TypeScript typecheck and targeted ESLint passed. Prettier passed for the changed and generated artifacts.

## Limits and handoff

These records support a calculation review. They do not settle article wording or interpretation. In particular, the Internet cohort includes M49 country-or-area entries; the later article should use that wording. Source rights in the fact packs remain candidate snapshots and require a live asset-level review before publication. Eurostat facts were still built from the verified snapshots after the local live API refresh failed certificate verification; the result is hash-reproducible but the live API was not refreshed in this run. The creator workflow article remains blocked on its live checks.

**Next: Step 9 with Sol.** Review the calculation output and claim framing, then decide whether each evidence-backed brief merits an article draft. Step 9 may draft only after that interpretation review. No article has been written, indexed, committed, or deployed in this step.
