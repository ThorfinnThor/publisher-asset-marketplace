# Step 2 — editorial candidate inventory

- Status: Step 2 complete; inventory only
- Generated: 2026-09-23T09:15:00.000Z
- Production mutations: none
- Articles written: none
- Indexability or sitemap changes: none
- Commit/deployment: none

## Result

The public production browse and asset-detail views expose **10,459 published assets** in the reviewed search catalogue. This inventory proposes **43 article candidates** so the next Sol review can reject weak, overlapping, or legally/data-incomplete ideas before drafting starts.

The five candidates marked for the pilot are recommendations only. They remain non-indexable and unpublished because this step does not create article records or change the application.

## Provenance and read-only boundary

The export was collected from production search views and public asset detail pages. Wrangler was checked for a direct D1 read, but the local Cloudflare authentication token had expired and could not refresh non-interactively. No D1 command, write, migration, asset update, rights update, deployment, or publication was attempted.

Production browse endpoints used:

- https://citesupply.com/search?source=source_owid
- https://citesupply.com/search?source=source_eurostat
- https://citesupply.com/search?source=source_worldbank
- https://citesupply.com/search?type=calculator (creator calculator discovery)

The counts describe the public production eligibility view, not hidden drafts, rejected submissions, or blocked assets.

## Inventory counts

### By source

| Source ID        | Published assets returned |
| ---------------- | ------------------------: |
| source_owid      |                      4254 |
| source_eurostat  |                      3602 |
| source_worldbank |                      2600 |
| creator          |                         3 |

### By asset type

| Asset type | Published assets returned |
| ---------- | ------------------------: |
| chart      |                      4254 |
| dataset    |                      6202 |
| calculator |                         3 |

### Rights badges in the production search export

| Source ID        | Commercial-use badge | Embed badge | Citation-ready badge |
| ---------------- | -------------------: | ----------: | -------------------: |
| source_owid      |                 4248 |        4254 |                 4251 |
| source_eurostat  |                 3602 |        3602 |                 3602 |
| source_worldbank |                 2600 |        2599 |                 2600 |
| creator          |                    3 |           3 |                    3 |

These badges are not a substitute for article-level rights review. Each candidate preserves the per-asset rights table read from its public detail page.

## Data completeness constraints

- OWID: metadata, attribution/licence evidence, and preview/embed references are present, but the observation series is not stored locally. Fetch and checksum the documented chart endpoint.
- Eurostat: the catalogue stores a reviewed selector/presentation sample capped at 50 non-empty observations. Fetch full dimensions and status flags.
- World Bank: the catalogue preview is capped at 25 API rows. Fetch the exact country/period scope from the official API.
- Creator assets: three reviewed calculator listings were discovered separately from the source filters. Their declarations are asset-specific; outputs are not valid factual inputs without a stable, versioned data contract.

No candidate contains factual values. Every quantitative claim is deferred to a deterministic fact pack.

## Pilot recommendations for Sol review

| Candidate                         | Question                                                                           | Source family |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------- |
| c-001-digital-adoption            | How has internet use changed across countries, and where is coverage still uneven? | owid          |
| c-003-renewable-share-eurostat    | How has renewable energy changed across EU sectors?                                | eurostat      |
| c-006-carbon-emissions-per-capita | How do per-capita carbon emissions differ across countries?                        | world_bank    |
| c-018-youth-unemployment          | Where is youth unemployment highest, and what does the measure include?            | eurostat      |
| c-027-urban-housing-adequacy      | How widespread is inadequate housing in urban populations?                         | owid          |

Before drafting, Sol should confirm a distinct thesis, a live source request, and enough compatible dimensions.

## Duplicate and overlap groups

These groups are review queues where candidates may answer similar search intent. At most one or two should survive the first batch unless their questions and evidence are materially different.

| Group                    | Candidates                                                              |
| ------------------------ | ----------------------------------------------------------------------- |
| digital-access           | c-001-digital-adoption                                                  |
| solar-energy             | c-002-solar-capacity                                                    |
| renewable-energy         | c-003-renewable-share-eurostat                                          |
| electricity-access       | c-004-electricity-access-gap, c-010-electricity-urban-rural             |
| electricity-mix          | c-005-electricity-fuel-mix                                              |
| carbon-emissions         | c-006-carbon-emissions-per-capita                                       |
| carbon-intensity         | c-007-carbon-intensity                                                  |
| economic-growth          | c-008-economic-growth                                                   |
| trade-growth             | c-009-import-growth                                                     |
| education-infrastructure | c-011-school-electricity                                                |
| fertility-labour         | c-012-fertility-and-labour                                              |
| fertility                | c-013-total-fertility-wb, c-014-total-fertility-eurostat                |
| life-expectancy          | c-015-life-expectancy-gender-gap, c-016-life-expectancy-eu              |
| labour-market            | c-017-unemployment-by-sex, c-018-youth-unemployment                     |
| gender-employment        | c-019-gender-services-employment                                        |
| employment-structure     | c-020-manufacturing-employment                                          |
| education-gender         | c-021-female-stem-graduates, c-022-preprimary-enrolment                 |
| international-education  | c-023-international-students                                            |
| tourism                  | c-024-tourism-gdp, c-025-tourism-employment, c-026-tourism-spending     |
| housing                  | c-027-urban-housing-adequacy, c-028-urban-slums, c-029-housing-benefits |
| construction             | c-030-construction-activity                                             |
| business-dynamics        | c-031-business-registration                                             |
| labour-costs             | c-032-labour-costs                                                      |
| inflation                | c-033-inflation-definition, c-034-inflation-cross-source                |
| water                    | c-035-freshwater-withdrawals, c-036-freshwater-worldbank                |
| wildfires                | c-037-wildfire-area                                                     |
| forests                  | c-038-forest-change                                                     |
| water-quality            | c-039-bathing-water                                                     |
| agriculture-emissions    | c-040-ammonia-agriculture                                               |
| material-footprint       | c-041-material-footprint                                                |
| data-centres             | c-042-data-centres-energy                                               |
| creator-tools            | c-043-creator-calculator-guide                                          |

## Risk flags

| Flag                                         | Candidate count |
| -------------------------------------------- | --------------: |
| owid_observations_not_stored_locally         |              20 |
| eurostat_dimension_and_status_flags_required |              15 |
| world_bank_scoped_api_fetch_required         |               9 |
| definition_mismatch_risk                     |               3 |

Common blockers are expected: definitions may not match, marketplace rows are bounded samples, and source updates can invalidate a fact pack. Cross-source candidates must not be drafted until a deterministic compatibility check passes.

## Candidate record contract

The machine-readable file data/editorial/article-candidates.json contains the working question, thesis, format, exact asset slugs, source families, source request templates, compatibility requirements, rights summary, completeness status, limitations, risk flags, duplicate group, and a recommendation flag only.

It contains no article body, generated HTML, fact values, publication status, or sitemap/indexability setting.

## Next decision

Use Sol for the candidate and thesis gate. Sol should select at most five calibration briefs, reject or merge semantic duplicates, and require deterministic source requests before any Luna drafting step.
