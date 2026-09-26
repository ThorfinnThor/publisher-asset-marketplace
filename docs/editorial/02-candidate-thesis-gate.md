# Step 3 — candidate and thesis gate

- Status: complete; no articles created
- Date: 2026-09-23
- Reviewer role: Sol
- Input: `data/editorial/article-candidates.json`
- Output: `data/editorial/calibration-briefs.json`
- Production mutations: none
- Commit/deployment: none

## Outcome

Sol reviewed all 43 Step 2 candidates against the rights, data-completeness, uniqueness, and
methodology rules in the content-system strategy. Five briefs advance conditionally to fact-pack or
verification work. Selection does not approve an article, make a page indexable, or authorise
publication.

| Decision                                         |  Count |
| ------------------------------------------------ | -----: |
| Selected for fact-pack or fact-free verification |      5 |
| Rights-safe reserve                              |     10 |
| Held for rights or data evidence                 |     23 |
| Merge into another candidate                     |      2 |
| Rejected on methodology                          |      2 |
| Rework required                                  |      1 |
| **Total**                                        | **43** |

The five selected briefs cover Our World in Data, Eurostat, and creator assets across trend
analysis, geographic comparison, indicator explainer, and tool-supported guide formats.

## Material corrections from the preliminary inventory

Step 2 recommendations were deliberately provisional. The gate found three reasons to change the
five-candidate set:

1. `c-006-carbon-emissions-per-capita` has `raw_data_redistribution = Unknown`. Commercial use and
   an approved marketplace embed do not independently authorise republishing or transforming the
   source values.
2. `c-027-urban-housing-adequacy` has the same unresolved raw-data condition.
3. `c-018-youth-unemployment` does not match its source. Live Eurostat metadata for `teilm011`
   identifies a monthly, seasonally adjusted series for unemployed people under 25 in **thousand
   persons**. It is not an unemployment-rate series. Its question and thesis must be rebuilt around
   the actual measure or a different reviewed asset.

These candidates remain in the inventory, but none may proceed as originally framed.

## Selected calibration briefs

### 1. Internet adoption gap

- Candidate: `c-001-digital-adoption`
- Format: trend analysis
- Source: Our World in Data
- Question: How has internet adoption changed since 2000, and where does the latest complete
  country distribution remain uneven?
- Thesis: The useful story is the distribution and pace of adoption, not one global average.
- Rights: commercial use, modification, and raw-data redistribution are Allowed; citation is
  Required.
- Gate: conditional on checksummed CSV and metadata snapshots, explicit country-versus-aggregate
  classification, comparable endpoint coverage, and fact IDs for every value.

The CSV and metadata endpoints returned successfully during this review. No values were copied
into an article and no calculation was performed.

### 2. EU renewable-energy patterns

- Candidate: `c-003-renewable-share-eurostat`
- Format: geographic comparison
- Source: Eurostat
- Question: How do renewable-energy shares differ among EU countries and end-use sectors in the
  latest common year?
- Thesis: An EU-wide average can hide both cross-country differences and the gap between
  electricity, transport, and heating and cooling.
- Rights: commercial use, modification, marketplace-rendered embed, and raw-data redistribution
  are Allowed; citation is Required. Source-hosted embedding is Not allowed.
- Gate: conditional on a verified TLS fetch, complete dimension selection, explicit member-country
  cohort, status-flag retention, and proof before using the second dataset as more than a
  definition cross-check.

Live metadata showed annual percentage data with dimensions `freq`, `nrg_bal`, `unit`, `geo`, and
`time`. The endpoint returned JSON in a transport-liveness probe, but the local CA store could not
verify Eurostat's certificate. That is an environment limitation, not evidence that the source is
invalid; the fact-pack step must repeat the request with normal certificate verification.

### 3. HICP inflation explainer

- Candidate: `c-033-inflation-definition`
- Format: indicator explainer
- Source: Eurostat
- Question: How should publishers interpret the annual HICP inflation rate when comparing
  European countries?
- Thesis: HICP is a harmonised annual-average rate of consumer-price change; it is not the price
  level and not every household's personal cost-of-living change.
- Rights: commercial use, modification, marketplace-rendered embed, and raw-data redistribution
  are Allowed; citation is Required. Source-hosted embedding is Not allowed.
- Gate: conditional on a verified TLS fetch and strict use of annual frequency, annual-average rate
  of change, COICOP total, explicit geography classes, and status flags.

Live metadata identified `A`, `RCH_A_AVG`, and `TOTAL` as the relevant frequency, unit, and COICOP
selection. Monthly or year-on-year monthly inflation must not be silently substituted.

### 4. Wildfire area by land cover

- Candidate: `c-037-wildfire-area`
- Format: trend analysis
- Source: Our World in Data
- Question: How has annual burned area changed across forests, savannas, shrublands and
  grasslands, and croplands?
- Thesis: A single burned-area total can conceal different land-cover patterns and is not a measure
  of fire intensity, emissions, damage, or risk.
- Rights: commercial use, modification, and raw-data redistribution are Allowed; citation is
  Required.
- Gate: conditional on checksummed CSV and metadata snapshots, explicit source units, a declared
  geographic scope, and preservation of the difference between zero and missing observations.

The CSV and metadata endpoints returned successfully and exposed four land-cover columns. No trend
was calculated during this step.

### 5. Embedding reviewed calculators

- Candidate: `c-043-creator-calculator-guide`
- Format: tool-supported guide
- Source: creator assets
- Question: What must a publisher check before embedding a creator-hosted calculator from Cite
  Supply?
- Thesis: Embed permission, attribution, calculator functionality, and factual data rights are
  separate questions; a working calculator does not automatically become a reusable dataset.
- Rights: commercial use and source-hosted embedding are Allowed; modification is Not allowed;
  raw-data redistribution is Unknown and will not be used.
- Gate: fact-free. It requires current asset-rights checks, embed sandbox tests, source attribution,
  and keyboard/mobile verification. Calculator outputs may not become article evidence.

All three selected Cite Supply asset pages and their corresponding creator source pages returned
HTTP 200 during this review. That confirms reachability only, not result accuracy.

## Candidate disposition

### Rights-safe reserve

These ten candidates have reviewed commercial, modification, and raw-data reuse permissions but
were not selected because the calibration batch is capped at five:

- `c-005-electricity-fuel-mix`
- `c-014-total-fertility-eurostat`
- `c-016-life-expectancy-eu`
- `c-017-unemployment-by-sex`
- `c-029-housing-benefits`
- `c-030-construction-activity`
- `c-031-business-registration`
- `c-032-labour-costs`
- `c-039-bathing-water`
- `c-040-ammonia-agriculture`

They still need source-schema validation and deterministic fact packs before drafting.

### Held for rights or data evidence

Twenty-three candidates are held because raw-data redistribution is Unknown, or because a
cross-source input has unresolved rights or definition compatibility:

- `c-002`, `c-004`, `c-006`–`c-009`, `c-011`, `c-013`, `c-015`, `c-019`–`c-028`, `c-034`,
  `c-035`, `c-038`, and `c-042`.

This is not a statement that the sources are unusable. It means the current asset-level evidence
does not authorise the proposed factual transformation with sufficient certainty.

### Merge queue

- Merge `c-010-electricity-urban-rural` into the broader electricity-access question in `c-004`.
- Merge `c-036-freshwater-worldbank` into the freshwater-withdrawal review in `c-035`.

The merged questions remain held until the relevant raw-data rights and compatible definitions are
established.

### Rejected or returned for rework

- Reject `c-012-fertility-and-labour` in its current form. It invites a relationship or causal
  reading without a defensible method and lacks confirmed raw-data rights.
- Reject `c-041-material-footprint` in its current form. Per-person and per-GDP measures use
  different denominators and cannot support the proposed comparison without a substantially more
  explicit method; rights are also unresolved.
- Return `c-018-youth-unemployment` for rework because the source measure is a person count, not a
  rate.

## Source-request verification boundary

This step performed only read-only liveness and schema checks:

- OWID CSV and metadata endpoints: normal HTTPS checks succeeded.
- Creator and Cite Supply asset pages: normal HTTPS checks succeeded.
- Eurostat endpoints: JSON and expected dimensions were observed, but only through an insecure
  liveness probe after the local certificate store rejected the chain. The probe is not acceptable
  provenance for a fact pack. A verified HTTPS fetch remains a hard blocker.

No response bodies, factual observations, calculated values, screenshots, or article prose were
committed by this step.

## Gate decision

The five briefs are approved only to proceed to deterministic fact-pack or fact-free verification
work. They remain unpublished, non-indexable, and outside every sitemap. Article drafting is still
blocked.

## Next step

Step 4 should use Luna to implement the fact-pack schema and deterministic source snapshot
generation for the four quantitative briefs, plus a structured verification pack for the creator
guide. Luna must not draft articles, approve rights, set indexability, commit, deploy, or publish.
The resulting fact packs then return to Sol for calculation, provenance, and limitation review.
