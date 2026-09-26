# Step 5 — Fact-pack and thesis review

- Date: 2026-09-23
- Reviewer role: Sol (editorial and pipeline review)
- Inputs: Step 3 briefs, Step 4 generator, schemas, status file, four fact packs, creator checklist, and checksummed source snapshots
- Decision: **no article approved for drafting or publication yet**
- Production mutations, commit, deployment, and indexability changes: none

## Evidence checked

The four packs contain 6,476 internet, 31 renewable-energy, 8 HICP, and 22,464
burned-area source observations. All 13 snapshot paths referenced by those
packs exist and their SHA-256 digests match the recorded hashes. Each pack has
unique fact IDs, finite non-null observed values, an explicit unit, geography,
period, source-row reference, and an empty `derived_facts` array. The four
generation-status entries are `ready_for_sol_review`; that status means
**retrieval and parsing succeeded**, not that a thesis or article passed review.

The source observations are plausible against the saved response structures:
the OWID series match the metadata-identified indicator IDs and units; both
Eurostat JSON-stat dimension orders match their parsers. No numeric comparison,
ranking, trend, or article claim has been approved. Two older, immutable
Eurostat copyright-notice snapshots remain on disk but are not referenced by
the current packs; they are not evidence for this review.

## Decisions by brief

| Brief                        | Provenance verdict            | Thesis verdict                                                 | Action before a draft                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cb-001` Internet adoption   | Retain raw observations       | **Conditional**                                                | Classify countries vs aggregates, define the comparable country cohort and coverage threshold, select the last sufficiently complete year, then calculate changes with tested percentage-point formulas.                                                                                                                                                                       |
| `cb-002` EU renewable shares | Retain EU27 observations only | **Original question rejected for this pack**                   | Version the brief as an EU27 _sector_ comparison, not a country comparison. Use a year common to overall, electricity, transport, and heating/cooling; 2024 is the latest such year in this snapshot. Treat 2025 values marked `p` as provisional and do not combine them with the missing 2025 transport value. Check the 2021 methodology change before any trend narrative. |
| `cb-003` HICP                | Retain EU27 observations only | **Original country-comparison framing rejected for this pack** | Version the brief as an EU27 annual-average-rate explainer. Distinguish the annual-average rate from monthly or same-month-year-earlier inflation and from the price level. Do not imply this pack supports country or euro-area comparisons.                                                                                                                                  |
| `cb-004` Wildfire land cover | Retain raw observations       | **Conditional**                                                | Choose and document one geographic scope; separate country codes from regional aggregates, preserve zero versus absent values, and review satellite-detection limitations before calculating land-cover trends. Do not infer fire intensity, emissions, damages, or risk.                                                                                                      |
| Creator calculator guide     | Checklist only                | **On hold**                                                    | Complete live rights, browser, sandbox functionality, output-accuracy boundary, attribution, keyboard, and mobile checks. Calculator outputs remain excluded from factual inputs.                                                                                                                                                                                              |

The `cb-002` source cube has 36 possible cells but only 31 values; five absent
cells were **omitted** by the parser instead of represented as explicit missing
facts. The three 2025 values for overall, electricity, and heating/cooling
carry Eurostat's `p` (provisional) flag. The 2025 transport share is absent.
These are data-completeness constraints, not zeroes. The Step 3 `cb-002` brief
also lists `sdg_07_40`, but the Step 4 pack does not ingest it; the second asset
must not be cited as a factual input. The source's category codes include two
additional heating/cooling variants beyond the four requested categories;
the revised brief must explicitly exclude or explain them.

## Technical review findings to resolve in Step 6

1. **Fail-closed per-asset rights.** `assertRights` and `sourceAsset` inspect
   candidate-wide arrays with `.includes("Allowed")`. A future candidate with
   mixed `Allowed` and `Not allowed` entries could pass and attribute the
   aggregate permission to the wrong asset. Require an exact rights record for
   each slug, or reject any mixed/unknown array until resolved. Also require
   `published === true` at the generation gate. Re-check live asset evidence
   before publication; a Step 2 inventory timestamp is not a current grant.
2. **Sparse Eurostat cells.** Decode the full JSON-stat dimension product,
   emitting explicit `missing_value` facts for absent cells with stable IDs
   and source-index references. Preserve separate status flags and a documented
   status-code lookup, including `p = provisional`. Test all expected series
   and years against fixtures.
3. **Brief/request drift.** The generator hardcodes URLs and selections and
   does not validate them against `required_source_requests` or the Step 3
   dimension contract. That was necessary to narrow the Eurostat geography,
   but the drift must be formalized as a versioned brief and exact request
   contract before calculations. Do not silently reinterpret an old brief.
4. **Country and cohort integrity.** All `geography.classification` fields are
   still `source_entity_unclassified`. The OWID packs contain aggregate codes
   such as `WB_EAP` and `OWID_AFR`. No country ranking, distribution, or
   global conclusion can pass until entity classification and source coverage
   are tested. The 2025 internet series is sparse, so “latest available” is
   not automatically “latest comparable.”
5. **Generation status and stale outputs.** A blocked rerun currently leaves
   an older `fact-packs/*.json` file in place. A future article consumer must
   require a matching ready status, snapshot hashes, and current review record;
   it may not discover packs by filename alone. Prefer an atomic run manifest
   and fail-closed consumer gate over deleting historical evidence.
6. **Parser and transport fixtures.** Add tests for quoted/multiline CSV,
   duplicate IDs, JSON-stat sparse cells, status flags, unexpected dimensions,
   disallowed redirects, response caps, and rights downgrade. The current
   download is decoded as UTF-8 text and re-encoded before hashing; verify or
   change the implementation before claiming arbitrary response bodies are
   byte-for-byte preserved. No insecure TLS fallback is permitted.
7. **Unit/citation precision.** The internet pack's caveat saying percentage
   display scaling “has not been applied” is misleading: its source CSV already
   labels the values `% of population`. Say simply that values are copied
   without conversion. For Eurostat, the bare label “Annual average rate of
   change” needs the source's percent-rate definition at render time. A
   customized Eurostat table or chart should cite its dataset code/link and
   access date as the reuse notice requests.

These are **offline pipeline** findings. They do not imply that the live asset
marketplace, its current embed permissions, or its existing sitemap changed.
The Eurostat packs use only `EU27_2020`; this is a deliberately conservative
reading of [Eurostat's commercial-reuse notice](https://ec.europa.eu/eurostat/help/copyright-notice),
which contains exceptions for third-party content and certain non-EU data.
It is not blanket clearance for every Eurostat geography or item. The
[renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm)
and [Eurostat's 2025 release](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260723-1)
are the methodology and provisional-data checks for `cb-002`. The
[HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm),
[OWID internet data page](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet),
and [OWID wildfire data page](https://ourworldindata.org/grapher/area-burned-wildfires-by-type)
anchor the other interpretation limits.

## Next handoff

Step 6 completed this handoff; see
[`05-corrective-fact-packs.md`](./05-corrective-fact-packs.md) for the changes,
verification, source-fetch limitation, and remaining gates. The corrected packs
still require Step 7 Sol review before analysis or article drafting.
