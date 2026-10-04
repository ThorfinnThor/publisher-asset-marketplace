# Cite Supply SEO implementation plan v2

**Plan date:** 3 October 2026  
**Repository baseline:** `main` at `2f65c67`  
**Purpose:** Convert the original 90-day Luna/Sol plan into a current-state delta plan. This document changes no production behavior and authorizes no deployment.

## 1. Decision

Keep the original plan's pilot-first strategy, source discipline, rights controls, quality gates and measurement logic. Do not execute the original backlog linearly: several proposed foundations are already live, while the remaining work is concentrated in asset-level editorial context, pilot selection, reproducible source validation and cohort reporting.

The first release remains deliberately small:

1. improve three existing energy assets without creating competing URLs;
2. validate their factual, rights, technical and product behavior;
3. expand to ten assets only after the three-page gate passes;
4. observe the cohort before expanding to twenty or adding another subject cluster.

The existing `/topics/energy-and-climate` route is canonical for the energy hub. Do not add `/topics/energy`.

## 2. Model responsibilities

The original Luna/Sol split is adjusted to the models' practical strengths.

| Model    | Primary responsibility                                                                                                                                                         | Must not approve alone                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Sol**  | Architecture, current-state reconciliation, search-intent decisions, source interpretation, data model, calculations, implementation, final factual review, tests and releases | A claim whose source or reuse permission remains unresolved                                          |
| **Luna** | Deterministic inventory work, data extraction, candidate preparation, first-pass structured briefs, formatting, repetitive QA and report assembly from approved facts          | Rights conclusions, ambiguous source interpretations, final analytical claims or production releases |

Luna may draft from a locked fact pack. Sol must review any substantive claim, comparison, calculation, rights decision or code change before publication.

## 3. Current implementation baseline

| Area                          | Current evidence                                                                                                                                         |       State | Consequence for this plan                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------: | -------------------------------------------------------------------------------------------------------------------------------- |
| Public topic architecture     | Eight definitions in `src/lib/topics.ts`, dynamic `/topics/[slug]`, crawlable links and topic metadata                                                   | Implemented | Audit and improve; do not rebuild.                                                                                               |
| Energy hub                    | `/topics/energy-and-climate` exists with explanatory copy, source guidance and reviewed asset results                                                    |     Partial | Strengthen around the selected pilot questions and assets.                                                                       |
| Editorial insights            | Four public, source-backed articles in `src/lib/editorial/public-articles.ts`, each tied to calculated analysis output                                   | Implemented | Existing articles count toward the lower end of the original four-to-six target. Add only when a distinct question justifies it. |
| Editorial production controls | Fact packs, calculation output, draft validation, protected preview and release reviews under `docs/editorial`, `data/editorial` and `scripts/editorial` | Implemented | Reuse the workflow; do not create a parallel CMS for the pilot.                                                                  |
| Asset indexability            | Explicit `search_indexable`, safe-rights gate, title/description checks and HTTPS canonical checks                                                       | Implemented | Preserve the conservative opt-in gate.                                                                                           |
| Sitemap                       | Static public hubs, all topic pages, public insights and only eligible database assets                                                                   | Implemented | Audit representative output; no mass inclusion.                                                                                  |
| Robots and AI discovery       | `robots.txt`, private/API/embed exclusions, sitemap declaration and `/llms.txt`                                                                          | Implemented | Regression-test only unless evidence shows a defect.                                                                             |
| Asset metadata and schema     | Per-asset metadata, canonical, Open Graph/Twitter and typed JSON-LD                                                                                      | Implemented | Validate accuracy on pilot pages; do not add schema solely for ranking.                                                          |
| Asset data presentation       | Eurostat samples, official World Bank observations, source previews, OWID images and labelled fallback state                                             |     Partial | Pilot pages still need question-specific answers, method and limitations in visible HTML.                                        |
| Rights and publisher actions  | Rights evidence, commercial/modification/attribution/raw-data distinctions, exact citation and gated embed actions                                       | Implemented | Preserve source-hosted versus marketplace-rendered distinctions.                                                                 |
| Product analytics             | Search/detail/source/copy intent events plus actual iframe loads and hashed publisher-origin counts                                                      | Implemented | Map existing events into the pilot measurement contract; avoid renaming stable events.                                           |
| SEO cohorts and GSC reporting | No repository-backed pilot cohort/reporting contract found                                                                                               |     Missing | Add release cohort metadata or an external mapping and reproducible GSC report.                                                  |
| Refresh and source checks     | Source-specific imports, refresh runners, rights review scripts and tests exist                                                                          |     Partial | Add editorial invalidation and explicit handling for source schema/data changes used by pilot claims.                            |
| Publisher education           | Homepage flows, creator guide, citation/embed instructions and asset actions exist                                                                       |     Partial | Add two or three real publisher examples only after the pilot pages are approved.                                                |
| Release verification          | Unit tests, build checks, production audit and release smoke coverage exist                                                                              | Implemented | Extend existing checks for the pilot; do not create a separate release system.                                                   |

## 4. Original task disposition

`Implemented` means the original outcome exists and should only be audited. `Partial` means a useful foundation exists but the named pilot deliverable does not. `Missing` means the specific deliverable was not found. `Deferred` means the task is intentionally gated on pilot evidence.

| Original task                     |       State | Revised action                                                                                                                       |
| --------------------------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| SOL-01 technical baseline         |     Partial | Produce a dated repo/production/GSC baseline and 30–50 URL sample. Do not repeat general architecture discovery already documented.  |
| LUNA-01 audience and positioning  |     Partial | Consolidate existing positioning into a short publisher-task document and remove unsupported promises.                               |
| LUNA-02 intent and URL backlog    |     Missing | Build a 20-energy/10-reserve inventory, then let Sol approve the first ten and three pilots.                                         |
| LUNA-03 content/source standard   |     Partial | Reuse the editorial and rights standards; add the asset-page fields and freshness rules that are genuinely missing.                  |
| SOL-02 editorial asset model      |     Missing | Decide between a small editorial overlay keyed by asset slug and additive asset fields. Do not let imports overwrite reviewed copy.  |
| LUNA-04 three pilot briefs        |     Missing | Create briefs for fossil reserves, solar-module prices and one EU-renewables asset using locked source evidence.                     |
| SOL-03 asset template             |     Partial | Add direct answer, method, limitations and observation context only when reviewed values exist. Preserve current fallbacks.          |
| SOL-04 reproducible pilot data    |     Partial | Reuse source clients and tests; add fixed assertions and versioned inputs for the three pilots.                                      |
| SOL-05 metadata/schema            | Implemented | Audit the three pilots for visible-content consistency and correct `Dataset`/`CreativeWork` typing.                                  |
| SOL-06 product measurement        |     Partial | Keep existing event names. Add pilot cohort/version mapping and internal/test traffic handling where measurable.                     |
| SOL-07 indexation/sitemap         | Implemented | Write the policy and add representative regression cases; preserve `/search` as `noindex`.                                           |
| LUNA-05 first ten assets          |     Missing | Render-review three first, then prepare seven more only after approval.                                                              |
| SOL-08 staged release             |     Partial | Use the existing deployment and smoke workflow; create pilot-specific release evidence and rollback reference.                       |
| LUNA-06 energy hub plan           |     Partial | Improve `/topics/energy-and-climate`; create a deliberate link map for the approved cohort.                                          |
| SOL-09 hub publication            |     Partial | Route and template exist. Implement only the approved content/link deltas.                                                           |
| LUNA-07 publisher workflow        |     Partial | Select real examples and identify remaining publication barriers; avoid generic FAQs.                                                |
| SOL-10 publisher examples/actions |     Partial | Existing actions are functional. Add tested examples and clearer state feedback only where the pilot exposes a gap.                  |
| LUNA-08 expand to twenty          |    Deferred | Two five-page waves after the ten-page release and quality review.                                                                   |
| SOL-11 reproducible calculations  |     Partial | Existing insight calculations provide a pattern. Add versioned calculation fixtures for new pilot claims.                            |
| LUNA-09 four-to-six insights      |     Partial | Four are live. Improve the EU-renewables article first; add at most two genuinely distinct analyses.                                 |
| SOL-12 source-change controls     |     Partial | Connect source/schema changes to editorial review status; simulate one outage and one schema change.                                 |
| SOL-13 weekly reporting           |     Missing | Combine GSC cohort results with existing product events and actual embed-load metrics in a reproducible report.                      |
| LUNA-10 chart packs/outreach      |    Deferred | Begin only after ten approved pages and tested publisher actions. Any outreach requires a separately approved communication process. |
| LUNA-11 day-60 decision           |    Deferred | Retain as a formal evidence gate.                                                                                                    |
| LUNA-12 tourism pilot             |    Deferred | Do not start unless the day-60 gate explicitly approves it.                                                                          |
| LUNA-13 day-90 decision           |    Deferred | Retain as the final pilot decision record.                                                                                           |

## 5. Revised execution sequence

### Phase 0 — Reconcile and select, working days 1–3

#### V2-01 — Reproducible baseline

**Model:** Sol  
**Outputs:**

- `docs/seo/baseline-2026-10.md`;
- `docs/seo/url-inventory.csv` with a stratified 30–50 URL sample;
- dated GSC exports for the latest complete 28-day window and available 90-day window;
- a recorded production release SHA and sitemap URL count;
- explicit unknowns rather than inferred totals.

**Gate:** Repository behavior, live behavior and GSC status are reported separately. No configuration changes.

#### V2-02 — Candidate inventory

**Model:** Luna for deterministic collection; Sol for selection  
**Outputs:**

- 20 energy candidates and up to 10 reserve candidates;
- current canonical URL, source family, rights state, data availability, existing internal links, GSC evidence and likely user question;
- duplicate/cannibalization flags;
- three approved pilot assets and seven approved follow-ons.

**Gate:** Every selected URL already exists, or a new URL has a documented distinct purpose. The energy hub remains `/topics/energy-and-climate`.

### Phase 1 — Define reviewed content, working days 4–8

#### V2-03 — Asset editorial overlay decision

**Model:** Sol  
Choose the smallest durable representation for direct answer, methodology, limitations, observation coverage, source version, review state, content version and related links. Prefer a separate overlay keyed by stable asset ID/slug if it better protects reviewed text from import refreshes.

**Gate:** Imports cannot silently replace reviewed editorial content; legacy assets render unchanged.

#### V2-04 — Three locked pilot briefs

**Model:** Luna drafts from evidence; Sol performs source/factual/rights approval  
Each brief must contain the exact question, supported answer, unit, period, source ID, transformation, limitation, approved actions, additional Cite Supply value and internal-link targets.

**Gate:** Unresolved evidence blocks only the affected claim or action. It is never filled by model inference.

### Phase 2 — Implement and verify three pilots, working days 9–15

#### V2-05 — Asset-page delta

**Model:** Sol  
Add reviewed direct-answer, method, limitation and time-context sections. Keep meaningful source data in HTML and preserve the existing chart/table fallbacks, rights panel, citation and embed behavior.

#### V2-06 — Reproducible source assertions

**Model:** Sol  
For each pilot, test known values before presentation rounding, missing observations, time boundaries and source/schema changes. Chart and table must derive from the same approved snapshot or documented live source contract.

#### V2-07 — Full pilot QA

**Model:** Luna runs the checklist; Sol resolves and approves  
Run formatting, typecheck, lint, unit tests, build, responsive browser QA, keyboard/accessibility checks, link checks, metadata/schema checks and the production smoke extension on a preview deployment.

**Release gate:** All three pages pass factual, rights, technical and product-action review. No production release is implied by completing the documents.

### Phase 3 — Release three, then ten, working days 16–30

1. Release the three pilots using the existing deployment process.
2. Record commit, release time, cohort and rollback reference.
3. Verify live HTML, actions, events, canonical, robots, schema and source links.
4. Request GSC recrawl only for the canonical pilot pages where appropriate.
5. Prepare and release the next seven only if no P0/P1 pilot defect remains.
6. Improve `/topics/energy-and-climate` and its contextual links for the approved ten-page cohort.

### Phase 4 — Observe, improve and decide, days 31–60

Produce weekly reproducible reports, but make no ranking claim from immature data. Report:

- page and query impressions/clicks from GSC;
- index status checks for the cohort;
- measured asset views and successful copy actions;
- actual embed loads and hashed publisher-site counts;
- source/check failures and editorial maintenance cost;
- page age, release date, denominators and missing data.

At day 60 choose one action: improve the ten pages, expand energy in two five-page waves, or pause. Tourism remains out of scope unless the gate explicitly approves it.

### Phase 5 — Validate use and decide, days 61–90

Only after the ten-page flow works:

- create two or three coherent chart packs from approved assets;
- test two or three real publisher examples;
- collect qualitative barriers and confirmed public uses separately from copy/load signals;
- improve the existing EU-renewables insight before adding further articles;
- publish no more than two additional insights unless each answers a distinct supported question.

The day-90 review may expand, revise, consolidate or pause the pilot. Low early clicks alone are not grounds for mass deletion or deindexing.

## 6. Measurement mapping

Do not rename stable production events solely to match the original proposal.

| Pilot concept          | Existing Cite Supply signal                             | Interpretation                                                   |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Asset view             | `detail_view`                                           | Measured detail-page request/event, not a unique person          |
| Citation copy success  | `citation_copy`                                         | Publisher intent after the existing successful-copy path         |
| Embed copy success     | `embed_copy`                                            | Publisher intent, not confirmed publication                      |
| Source open            | `source_click`                                          | Navigation to the canonical provider                             |
| Actual embed use       | `embed_usage_daily.load_count` / Analytics Engine       | Successful approved iframe delivery, not a unique reader         |
| Publisher sites        | distinct hashed origins in `embed_publisher_daily`      | Lower bound because referrers can be suppressed                  |
| Confirmed external use | separately reviewed public URL or explicit confirmation | Strongest use evidence; never inferred from a copy or load alone |

Add `release_cohort`, `content_version` and publication date through a durable mapping if changing the high-volume event schema would add unnecessary risk.

## 7. Non-negotiable quality and safety rules

- Preserve the selective sitemap and explicit asset indexability gate.
- Do not create country/year/filter landing pages at scale.
- Do not publish a direct answer without unit, period and material limitation.
- Do not present current check dates as observation dates.
- Do not merge incompatible denominators, geographies or units.
- Do not enable downloads, embeds or modification rights without documented evidence.
- Do not claim Cite Supply created third-party source data.
- Do not require keyword-rich backlinks in embeds.
- Do not interpret schema markup, indexing or an embed copy as proof of search or publisher success.
- Do not let a refresh silently change an approved editorial claim.

## 8. Definition of done for each pilot release

- The page adds a named value beyond a source link or generic description.
- Every material number is traceable to source, version, unit, period and transformation.
- Rights and available actions match the reviewed evidence.
- Canonical, robots, sitemap eligibility and visible content agree.
- Chart, table, fallback and source link remain understandable on narrow screens and by keyboard.
- Product events preserve their documented meaning.
- Automated checks and a real-browser preview pass.
- Commit, release cohort, release time and rollback reference are recorded.
- Live verification passes before the release is considered complete.

## 9. Immediate next step

Run **V2-01 with Sol**. It is read-only with respect to production and must finish before content candidates are scored. After V2-01, use **Luna for the mechanical portion of V2-02**, then return to **Sol for final candidate selection**.
