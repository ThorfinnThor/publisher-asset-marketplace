# V2-06 reproducible source assertions

**Step:** V2-06  
**Model:** Sol  
**Completed:** 4 October 2026  
**Scope:** Three approved SEO pilots; local repository and official public sources only  
**Production D1 reads/writes:** None  
**Deployment:** None

## Outcome

The three pilot overlays now have offline, deterministic source assertions. Tests lock the unrounded values, display rounding, approved time boundaries, known missing observations, source schemas, source hashes and source-specific reuse behavior.

The fixtures are stored in `data/seo/source-assertions-v2-06/`. Their schema and calculation helpers are in `src/lib/assets/editorial/source-assertion-fixture.ts`; the complete assertions are in `test/source-assertions-v2-06.test.ts`.

## Rights-aware storage decision

The two Our World in Data pilots include upstream datasets with provider-specific terms. V2-04 did not approve raw-data redistribution for those assets. Their repository fixtures therefore contain only the minimal reviewed observations needed to reproduce the published claims, plus the SHA-256 hashes and URLs of the official CSV and metadata files. The complete OWID downloads are not stored in the repository.

Eurostat raw-data redistribution is approved with attribution and policy exceptions. Its existing pinned JSON-stat response remains the repository snapshot. V2-06 verifies that file byte-for-byte before reading its dimensions and observations.

## Source verification

The official OWID files were retrieved again on 4 October 2026. All hashes matched the V2-04 Sol review:

| Pilot                     | Source file               | SHA-256                                                            |
| ------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Fossil reserves           | CSV                       | `235136205893e6a03713ce5ad13f66e13a6672df865a29550b361021424ee730` |
| Fossil reserves           | Grapher metadata          | `ba3c93f2c6001496069d9ef9d0f8a585b0f7ace800374eb9bbd139907e9a0d96` |
| Solar module prices       | CSV                       | `26941d3ff4f7bb11916bf6e36937064fe9f65f91c281d2f5250cb6e24da589dc` |
| Solar module prices       | Grapher metadata          | `3ac71f2696a67a413182c50d6c650be51c8b0d9546b9dfd5b780fb1fde85863b` |
| Eurostat renewable shares | Pinned JSON-stat response | `251b43bc21bf7aae2049c0c20e4641e068a9d3f73d91db58aa296d75339e51d7` |

## Locked assertions

### Fossil-fuel reserves-to-production ratios

- The CSV schema is exactly `Entity, Code, Year, Gas, Coal, Oil`.
- Gas and oil cover 1980–2020; coal contains only a 2020 observation.
- The unrounded 2020 values are 48.503418 years for gas, 140.34598 for coal and 56.391872 for oil.
- Coal in 2019 is explicitly missing. A test prevents the single coal value from becoming an apparent trend.
- The display values reproduce 48.5, 140.3 and 56.4 at one decimal place.

### Solar photovoltaic module prices

- The CSV schema and constant-2025-US-dollar-per-watt unit are locked.
- The approved period is 1975–2024; 1974 and 2025 are explicit out-of-range assertions.
- The unrounded endpoints are 132.3757 and 0.26518628.
- The percentage decrease is recalculated from those endpoints as 99.79967148049076% and displayed as 99.8%.

### Eurostat renewable-energy shares

- The pinned file hash, update timestamp, dimension order and dimension sizes are tested.
- The four unrounded 2024 observations are read from the JSON-stat indices: 25.241, 11.2, 47.503 and 26.738.
- `REN_TRA` for 2025 is verified as missing.
- The available 2025 observations for `REN`, `REN_ELC` and `REN_HEAT_CL` are verified as provisional and remain outside the approved 2020–2024 boundary.

## Presentation contract

The OWID pages retain source-hosted chart previews and source-hosted embeds. Their reviewed text is gated by the expected source update and the recorded source hashes. The Eurostat page retains its D1-imported table and Cite Supply-rendered embed; its editorial overlay is gated by the same source update represented by the pinned repository snapshot.

No fixture or overlay changes `assets.search_indexable`, sitemap inclusion, citation behavior or embed rights. No validation or render path writes to D1.

## Gate result

V2-06 passes locally. Known values are asserted before rounding, missing observations and time boundaries are explicit, schema drift causes test failure, and the Eurostat snapshot is cryptographically verified. The three pilots are ready for V2-07 full pilot QA, but no release is authorized by this step.
