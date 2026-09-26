# Step 6 — Corrected offline fact packs

- Date: 2026-09-23
- Status: complete for deterministic parsing and scoped observation packs
- Production writes, asset-rights changes, commit, and deployment: none
- Article drafts and indexability changes: none

## What changed

The historical Step 3 briefs remain intact. `data/editorial/brief-revisions.json`
records revision 2 for the two Eurostat briefs and the generator checks each
revision against the original revision before applying it:

- Renewable energy now asks about four EU27 consumption categories, not country
  differences. The pack retains 2020–2024 observations for `REN`, `REN_ELC`,
  `REN_TRA`, and `REN_HEAT_CL`. The 2021 methodology change is explicit;
  2025 is excluded because three values are provisional and transport is
  missing. The secondary `sdg_07_40` asset has been removed from the brief's
  inputs because compatibility was not established.
- HICP now concerns the EU27 annual-average rate only. Its scope explicitly
  distinguishes the rate from index levels, monthly measures, country
  comparisons, and a household's spending basket.

`src/lib/editorial/source-parsers.ts` now contains the pure CSV and Eurostat
JSON-stat parsers. Eurostat parsing walks the full dimension product, including
sparse absent values as `value: null` plus `missing_value: true`, keeps
Eurostat status codes, and rejects out-of-range indices or geography drift.
The fact-pack schema records each brief revision, its scope note, explicit
missing-value state, and Eurostat status-code labels. The OWID unit caveat now
states that source values are copied without conversion.

The rights check now fails closed unless the candidate is published and each
rights dimension has one unambiguous status: commercial use, modification, and
raw-data redistribution must each be `Allowed`, with citation `Required`.
Mixed or unknown candidate-wide summaries cannot pass. The generator also
checks that required source hosts and paths match its configured requests.

The optional `--from-verified-snapshots` mode reads only a prior
`ready_for_sol_review` pack's HTTPS-allowlisted snapshot paths, verifies every
SHA-256, validates UTF-8, and labels the run `verified_snapshots`. It does not
turn TLS off or silently replace a live fetch. Normal generation remains
`live_https`. Source downloads are now hashed and stored as original response
bytes before UTF-8 parsing.

## Rebuilt outputs

The current generation manifest records `source_mode: verified_snapshots`.
Four packs validate with 6,476 internet facts, 20 revised renewable-energy
facts, 8 HICP facts, and 22,464 burned-area facts. The renewable pack contains
exactly four categories for each period 2020–2024; the source `p` status label
remains recorded as `provisional`. Its filtered pack has no absent cells; the
parser test exercises a sparse cell and preserves it as missing. All packs
retain zero derived facts and remain `ready_for_sol_review`, not approved for
article publication.

The first attempted refresh in live mode failed Eurostat TLS certificate
validation while OWID refreshes succeeded. No TLS-bypass request was made.
The successful offline rebuild used previously fetched Eurostat responses
whose HTTPS requests, retrieval timestamps, and hashes had already been
recorded; every referenced snapshot hash was rechecked. These values are from
that recorded retrieval, not a fresh Eurostat response.

The [Eurostat reuse notice](https://ec.europa.eu/eurostat/help/copyright-notice)
continues to govern permitted reuse and its exceptions. The
[renewable-energy metadata](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_share_esmsip2.htm)
notes that the methodology changes from 2021, and the
[2025 Eurostat release](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260723-1)
labels those data provisional. The HICP meaning remains grounded in
[Eurostat's HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm).

## Verification

- `npx vitest run test/editorial-source-parsers.test.ts`: 6 tests passed.
- `npm test`: all 346 tests in 63 files passed.
- `npm run typecheck`: passed.
- Targeted ESLint on the changed TypeScript files: passed.
- Prettier on changed source, tests, revision data, and review document: passed.
- All four current fact packs, the generation manifest, and creator checklist
  validate against their schemas.
- All 13 referenced source snapshot hashes match; all pack fact IDs are unique;
  `derived_facts` is empty in every pack.
- The generator has not been run in normal live mode to refresh Eurostat because
  the current environment cannot verify its TLS chain. Historical verified
  snapshots were used as described above.

## Remaining review gates

Sol must review the four revised packs and decide the analytical cohorts,
definitions, period rules, formulas, and displayed precision before any
article is drafted. The OWID geography fields remain explicitly
`source_entity_unclassified`; internet coverage is sparse in the latest year,
and wildfire entities mix countries and aggregates. The creator checklist still
has all live rights, calculator, attribution, accessibility, and mobile checks
marked `not_run`. Candidate rights summaries came from the read-only Step 2
inventory and were not refreshed from production during this step.

The generation manifest prevents a blocked run from claiming readiness, but
there is not yet an article consumer that enforces manifest-to-pack matching.
When that consumer is built, it must require a ready manifest entry, matching
brief revision, and verified snapshot hashes; a leftover JSON file alone is
never proof that a current run passed.

## Next step

**Step 7 — Sol fact-pack review.** Review these revised packs and confirm which
questions can support deterministic analysis. Keep the creator guide on hold
until its manual checks pass. Only after that review should a later Luna step
calculate named metrics or draft calibration articles.
