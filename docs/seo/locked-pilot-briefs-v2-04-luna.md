# V2-04 locked pilot briefs

**Date:** 4 October 2026  
**Model role:** Luna first pass  
**Status:** drafted for Sol review; not approved for publication  
**Production changes:** none

## 1. Scope

This step translates the three assets selected in V2-02 into structured page briefs for the future editorial overlay. It does not write article prose, create overlay records, change rights or indexability, read or write production D1, commit, or deploy.

The machine-readable briefs are in [locked-pilot-briefs-v2-04-luna.json](../../data/seo/locked-pilot-briefs-v2-04-luna.json). They intentionally distinguish evidence that is actually pinned from evidence that still has to be fetched and asserted in V2-06.

## 2. Shared brief contract

Every brief contains:

- one exact user question;
- an answer boundary that says what the page may and may not claim;
- unit, period, geography and frequency scope;
- an explicit transformation rule;
- material limitations;
- rights and publisher actions, kept separate from data interpretation;
- the additional value Cite Supply should add beyond a source link;
- contextual internal-link targets;
- source evidence and blockers.

The OWID briefs do not invent values. Their source-specific response, definition, unit and period are still missing from the repository evidence. They are therefore blocked for overlay approval even though their live route and selected rights state are recorded.

The Eurostat brief can use the pinned `cb-002-eu-renewable-share-patterns` fact pack. Its page-level answer remains narrower than the existing public insight: it explains the dataset's scope and dimensions rather than becoming a second article about the broader EU renewable-energy story.

## 3. Pilot summaries

| Brief                              | Asset                                | Evidence state                                                                          | Sol decision needed                                                                     |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ab-001-fossil-reserves`           | `years-of-fossil-fuel-reserves-left` | Route and selection record only; no source-specific data fixture or local rights record | Resolve source definition, unit, period, entity scope and chart-specific reuse evidence |
| `ab-002-solar-module-prices`       | `solar-pv-prices`                    | OWID route, seed entry and chart rights record; no locked source-data fixture           | Resolve currency/inflation basis, unit, period and mixed-source redistribution boundary |
| `ab-003-eurostat-renewable-energy` | `eurostat-nrg_ind_ren`               | Pinned API snapshot and fact pack available                                             | Confirm dimensions, approved metrics, rights path and noindex gate                      |

### Fossil reserves

The page should answer what a reserves-to-production ratio means and, most importantly, what it does not mean. It must not turn a conditional ratio into a depletion countdown. Any number requires a source-specific fixture with the exact indicator definition, unit, geography and observation window.

Commercial use and source-hosted embedding were observed in the Sol selection record, but the brief keeps raw-data redistribution unknown. No download or raw-data promise is authorized.

### Solar module prices

The page should explain the price basis before describing movement: currency, inflation treatment, unit per watt, series period and source method. It must not substitute installed-system cost, generation cost or electricity prices for module prices. The existing OWID rights record allows commercial use and source-hosted embedding but leaves raw-data redistribution unverified because of mixed underlying terms.

### Eurostat renewable-energy indicators

The page may explain separate annual percentage indicators for the EU27 energy-balance categories in the pinned 2020–2024 scope. Different denominators mean the indicators must not be added. The 2020–2021 methodology break and the exclusion of provisional 2025 comparisons remain visible constraints. Only the marketplace-rendered embed path is allowed in the selected rights record; a source-hosted embed must stay disabled.

## 4. Sol review gate

Sol must resolve the two OWID evidence blockers before V2-05 can implement reviewed sections. For all three assets, Sol must also:

1. confirm the stable `asset_id` against the live asset record;
2. approve the source contract and fingerprint inputs;
3. approve every numerical claim and transformation;
4. confirm the rights/action distinction;
5. confirm internal links do not create duplicate article intent;
6. retain `noindex, follow` for the Eurostat asset until the full pilot QA gate.

Until that review completes, none of the three briefs is an approved editorial overlay and no public page behavior should change.

## 5. V2-04 result

The brief package is complete as a bounded first pass. It records the intended questions and all required review dimensions while leaving unsupported values explicit. Two briefs are blocked on missing source-specific fixtures; the Eurostat brief is ready for Sol's source and rights review. No article or production change was made.
