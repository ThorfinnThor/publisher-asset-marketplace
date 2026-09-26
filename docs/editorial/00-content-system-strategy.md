# Cite Supply editorial content system strategy

- Status: Step 1 complete; implementation not started
- Date: 2026-09-23
- Scope: code, SEO, asset, sitemap, and indexability review plus target strategy
- Production changes in this step: none

## Executive decision

Cite Supply should add a separate editorial layer at `/insights`, but it must not turn every asset
or every possible asset combination into an indexable page. The asset catalogue remains the source
of reviewed inventory; editorial pages are a smaller, explicitly approved set of analyses that add
interpretation, methodology, limitations, and useful links back to the exact assets used.

The initial release is capped at 30 candidate articles. Five calibration articles are produced and
reviewed first. Only pages that pass deterministic evidence checks and editorial review become
indexable. The remaining candidates stay unpublished or `noindex` until they pass the same gates.

Numerical claims are produced by code, not by a language model. A model may propose a question,
organise a narrative, and edit prose, but every displayed value, date, unit, comparison, rank, and
percentage must resolve to a versioned fact in a deterministic fact pack.

## 1. Current system inventory

### 1.1 Application and storage

- The application uses the Next.js App Router through vinext and is deployed on Cloudflare Workers.
- D1 stores sources, assets, rights evidence, submissions, search indexes, and analytics.
- The public inventory currently consists of reviewed source assets from Our World in Data,
  World Bank Open Data, Eurostat, and creator submissions.
- Assets distinguish chart reuse from raw-data redistribution in `rights_json`. This distinction is
  mandatory for editorial reuse as well.

Primary evidence:

- `migrations/0001_initial.sql`
- `src/lib/rights/contracts.ts`
- `src/lib/rights/classify-rights.ts`
- `docs/rights-classification-spec.md`

### 1.2 Existing metadata and structured data

- Root metadata defines the Cite Supply title, description, icons, Open Graph fields, Twitter card,
  and a default `index,follow` policy.
- Site JSON-LD describes an `Organization` and `WebSite`.
- Asset pages generate their own title, description, canonical URL, social image, robots metadata,
  and source-appropriate JSON-LD (`Dataset`, `SoftwareApplication`, or `CreativeWork`).
- Missing assets are explicitly non-indexable.

Primary evidence:

- `src/app/layout.tsx`
- `src/lib/seo.ts`
- `src/app/asset/[slug]/page.tsx`
- `src/lib/seo/indexability.ts`

### 1.3 Existing indexability policy

The current policy is intentionally selective:

1. Every asset starts with `search_indexable = 0`.
2. Only published, rights-safe assets with valid HTTPS canonicals and usable source-specific
   presentation evidence are eligible.
3. Migration `0027_source_aware_search_indexability.sql` builds a balanced cohort with nominal
   allocations of 200 OWID, 150 Eurostat, 100 World Bank, 25 creator, and 25 other assets.
4. The total is capped at 500 assets.
5. Migration `0028_index_quality_and_related_assets.sql` removes additional pages from the
   indexable set when visible titles are exact duplicates.
6. Unselected published assets remain available to users with `noindex,follow`.

This is a good anti-spam baseline, but it is a migration-time snapshot. There is no recurring
quality job in the inspected code that continuously rebalances the 500-page selection when assets
are added, refreshed, hidden, or materially improved. New assets therefore remain non-indexable by
default unless a later process explicitly promotes them.

### 1.4 Existing sitemap and crawl policy

- `/sitemap.xml` is currently a single URL set containing `/`, `/creator/guide`, and only published,
  rights-safe assets whose `search_indexable` value is `1`.
- The production audit and release smoke tests expect 3-502 URLs: two static pages plus at most 500
  curated asset pages.
- `/search` is `noindex,follow`; filtered and query permutations therefore do not become search
  landing pages.
- `robots.txt` permits normal pages and blocks `/api/`, `/e/`, and `/embed/` for general crawlers and
  OAI-SearchBot. It advertises the canonical Cite Supply sitemap.
- Legal, report, creator-term, authentication, dashboard, edit, and submission pages already have
  route-level noindex directives in most cases.

Primary evidence:

- `src/app/sitemap.xml/route.ts`
- `src/app/robots.txt/route.ts`
- `src/app/search/page.tsx`
- `scripts/audit-production.ts`
- `scripts/release-smoke.ts`

### 1.5 Existing discovery and internal links

- The homepage links to selected real assets and to search queries.
- Search is based on D1 FTS5 with a trigram fallback and filters by source, asset type, rights state,
  commercial permission, and freshness.
- Asset pages show up to three related records. The relation is presently based on same source,
  followed by same asset type; it is not topic-semantic.
- Search pages themselves are not intended as organic landing pages.

Primary evidence:

- `src/app/page.tsx`
- `src/lib/search/search-assets.ts`
- `src/lib/search/search-index.ts`
- `src/lib/assets/get-asset.ts`

### 1.6 Data available to editorial calculations

The data stored for marketplace display is not automatically sufficient for research articles:

- OWID asset metadata retains chart metadata, column units, citations, variable IDs, and source
  licences, but does not retain the chart's observation series. An article calculation must fetch a
  documented source-data endpoint and may not infer values from the PNG or chart shape.
- World Bank ingestion retains at most 25 rows from the API response. That sample supports a compact
  preview but must not be treated as a complete historical or cross-country research dataset.
- Eurostat ingestion uses the reviewed `EU27_2020`, `sinceTimePeriod=2020` selector and retains at
  most 50 non-empty observations. It is a bounded presentation sample, not a general-purpose full
  Eurostat extract.
- Creator assets do not automatically provide machine-readable observations. They may be linked or
  discussed as tools, but their outputs cannot become factual inputs without a separate validated
  data contract.

Primary evidence:

- `src/lib/ingest/import-runner.ts`
- `src/lib/ingest/worldbank-source-client.ts`
- `src/lib/ingest/eurostat-source-client.ts`
- `src/lib/assets/source-data-preview.ts`

## 2. Strengths to preserve

1. Asset-level rights decisions rather than source-wide assumptions.
2. Separate permissions for embedding, commercial use, modification, and raw-data redistribution.
3. A conservative, explicit `search_indexable` field and `noindex,follow` fallback.
4. Search pages excluded from indexing.
5. Canonical URLs and per-asset structured data.
6. A hard sitemap ceiling instead of publishing the complete catalogue to crawlers.
7. Production checks for sitemap size, canonical consistency, titles, robots directives, links, and
   HTML language.
8. Visible source, freshness, licence evidence, citation, and limitations on asset pages.

The editorial system must reuse these controls. It must not introduce a second, weaker rights or
indexing path.

## 3. Gaps and risks found

### 3.1 No editorial domain model

There is no article route, article schema, fact-pack format, review state, revision trail, or
article-to-asset mapping. Adding free-form generated HTML would bypass the existing security,
rights, and quality controls.

### 3.2 Display samples could be mistaken for complete datasets

World Bank and Eurostat metadata intentionally store bounded samples. Using these samples for
rankings, trends, or global conclusions could produce technically correct calculations over an
incorrect population. Full analytical extracts need a separate deterministic fetch contract.

### 3.3 OWID observations are not locally available

OWID chart metadata is adequate for attribution and discovering variable IDs, but not for
recalculating the underlying series. Screenshot reading or visual estimation is prohibited.

### 3.4 Asset index selection is not continuously maintained

The curated asset set is seeded by migrations. The editorial system needs a reusable policy
function and an explicit scheduled or release-time selection process instead of another one-off
migration.

### 3.5 Exact-title deduplication is insufficient for articles

The existing migration removes exact duplicate asset titles. Editorial content additionally needs
topic, thesis, outline, and semantic-overlap checks. Different titles can still describe the same
answer.

### 3.6 Some routes rely on the root indexing default

`/admin/demand` and the source file for `/opportunities` do not declare route metadata. The release
smoke currently expects `/opportunities` to redirect, but defensive noindex metadata should still
be required for every non-content route before the editorial launch. Future routes must be
non-indexable by default until classified.

### 3.7 Current related links are not editorially meaningful

Same-source and same-type links are useful fallbacks but do not establish topic relevance. Article
links must be based on the explicit asset mapping in the approved editorial record.

### 3.8 Existing sitemap tests encode the current architecture

Both production audit and release smoke enforce a maximum of 502 URLs and assume a single URL set.
An article sitemap cannot be added safely until those assertions are changed to validate a sitemap
index and per-sitemap limits.

## 4. Target architecture

### 4.1 Provenance pipeline

```text
reviewed asset
  -> licensed source-data fetch
  -> immutable source snapshot metadata
  -> deterministic fact pack
  -> editorial brief
  -> draft article
  -> automated evidence and duplicate checks
  -> Sol editorial review
  -> approved article
  -> indexability gate
  -> sitemap inclusion
```

No stage may skip directly from an asset title or preview image to a published article.

### 4.2 Pilot storage decision

For the first 30 articles, use version-controlled structured files rather than editable runtime HTML:

- `data/editorial/candidates.json` — Step 2 inventory and topic candidates.
- `data/editorial/fact-packs/<fact-pack-id>.json` — deterministic facts and provenance.
- `content/editorial/<article-slug>.json` — structured editorial content.
- `docs/editorial/` — strategy, review reports, and approval records.

Use a typed block renderer. Do not introduce arbitrary HTML or execute content-provided scripts.
Suggested block types are `prose`, `finding`, `asset_embed`, `data_table`, `method`, `limitation`,
`source_note`, and `related_assets`. These are evidence components, not a mandatory visual template;
articles may order and combine them differently.

This approach provides reviewable diffs, easy rollback, deterministic builds, and a clear separation
between unpublished drafts and live content. Reassess D1-backed editorial storage only after at
least 100 approved articles or when repository/build size becomes measurable operational friction.

### 4.3 Fact-pack contract

Every fact pack must contain at least:

```text
schema_version
id
topic
generated_at
source_fetched_at
method_version
input_assets[]
  asset_id, slug, source_id, canonical_url
  evidence_url, evidence_checked_at
  licence_code, commercial_use, modification_allowed
  raw_data_redistribution, attribution_required
source_requests[]
  URL, parameters, response checksum, retrieved_at
facts[]
  fact_id, value, unit, geography, period
  status/quality flag, source row references
derived_facts[]
  fact_id, formula identifier, input fact IDs
  rounding rule, missing-value policy
caveats[]
```

Raw response bodies do not need to be committed when they are large, but the request, checksum,
retrieval time, parser version, and compact cited observations must be retained. A later regeneration
must be able to explain why a fact changed.

### 4.4 Article contract

Every article record must contain:

```text
schema_version
slug
status: draft | review | approved | published | retired
language
format
title
dek
thesis
seo_title
seo_description
date_created
date_reviewed
date_published
date_modified
fact_pack_ids[]
asset_slugs[]
blocks[]
citations[]
limitations[]
review
  reviewer_model, reviewed_at, decision, notes
```

Indexability must be derived from publication state plus passing validators. It must not be a loose
boolean that a generator can set by itself.

### 4.5 Numeric integrity

- Article blocks should refer to `fact_id` values and let the renderer format numbers and units.
- Free prose containing percentages, currency values, rankings, dates used as evidence, or other
  quantitative claims must be mapped to a fact ID by validation.
- All calculations use named, unit-tested formula functions.
- Every derived fact records input fact IDs, precision, rounding, and missing-value treatment.
- No model may calculate a value that is subsequently treated as authoritative.
- Conflicting units, currencies, geographic definitions, base years, or frequency must block the
  article rather than be silently normalised.

## 5. Source-specific editorial policy

### 5.1 Our World in Data

- The current preview and embed may be used only under the asset's reviewed chart rights.
- Analytical values must be fetched from a documented OWID data endpoint discovered through the
  stored chart/variable metadata.
- Every underlying indicator origin must pass the existing raw-data rights policy.
- Charts with `raw_data_redistribution !== true` may be embedded or cited when permitted, but their
  raw values must not be republished in Cite Supply tables or used to create derivative charts.

### 5.2 World Bank Open Data

- Do not use the retained 25-row preview sample as evidence that coverage is complete.
- The fact-pack generator must issue a scoped official API request for the exact countries and
  periods needed by the article.
- Preserve indicator code, country code, period, API parameters, returned licence metadata, and
  observation status.
- Only indicators whose reviewed evidence permits the intended commercial reuse and transformation
  may feed calculations or Cite Supply-rendered tables/charts.

### 5.3 Eurostat

- Do not generalise the current `EU27_2020`, 2020+ display selection into country-level claims.
- Each fact pack must record the complete dimension selector and every Eurostat status flag used.
- Values with flags requiring qualification must display the qualification.
- Different seasonal-adjustment modes, units, populations, price bases, or frequencies may not be
  combined without an explicit tested transformation.

### 5.4 Creator submissions

- Creator tools may be featured, compared by declared functionality, or linked from guides.
- Their calculated outputs must not be harvested as data unless a separate machine-readable source,
  licence, stable version, and validation contract exists.
- Creator declarations alone do not establish an external factual claim.

## 6. Editorial formats and uniqueness

The system should support distinct formats rather than one article template:

1. **Trend analysis** — what changed over a defined period and where the series breaks or changes
   methodology.
2. **Cross-source comparison** — only when definitions and units are demonstrably compatible.
3. **Geographic comparison** — a scoped set of countries or regions with visible selection logic.
4. **Indicator explainer** — what an indicator measures, does not measure, and how publishers should
   cite it.
5. **Update note** — a material source revision or newly available period and its implications.
6. **Tool-supported guide** — a practical workflow using a reviewed calculator or widget without
   turning its unverified output into source data.

Required evidence blocks do not imply identical introductions, heading counts, conclusions, word
counts, or layouts. Each approved brief must state a distinct question and thesis. Two candidates
that would yield materially the same answer are merged before drafting.

### Editorial depth gate

Before an article can advance to publication review, it must contain at least **500 words of
substantive, reader-facing narrative**. Count the text of prose, findings, methodology, and
limitations; do not count the title, dek, headings, tables, captions, metadata, citations, asset
links, navigation, or legal/attribution boilerplate. Aim for roughly 550–800 substantive words when
the evidence supports it, but never extend an article merely to reach a target. Each added passage
must answer a distinct reader question, interpret a verified finding, explain a consequential method
or limitation, or give a source-backed practical reading rule. The minimum is necessary, not
sufficient: an editor still rejects repetition, generic background, unsupported claims, and text
that could be transplanted unchanged into another article. The rendered article must carry the
substantive body, not just a short chart summary. Word-count compliance and editorial quality are
both explicit release gates.

## 7. Topic eligibility and exclusions

### Hard eligibility requirements

- The question can be answered by available, machine-readable, reviewed source data.
- Every input asset is published and has sufficient rights for the exact intended use.
- The article adds interpretation, comparison, methodology, or a decision-useful explanation beyond
  repeating the asset title and description.
- Geographic scope, period, unit, population, and frequency are explicit.
- At least one visible Cite Supply asset is genuinely useful to the reader.
- The topic is meaningfully different from every approved and queued article.
- All important limitations can be stated clearly without making the page misleading.

### Pilot exclusions

- Personal medical guidance, treatment recommendations, or disease-risk predictions.
- Individual financial, investment, tax, or credit recommendations.
- Legal advice or regulatory compliance conclusions.
- Election forecasts, political persuasion, or claims requiring near-real-time verification.
- Rankings that mix incomparable indicators.
- Forecasts unless the upstream source explicitly supplies a forecast series and methodology.
- Articles based only on an image, preview sample, title, or description.
- Pages whose primary purpose is targeting a keyword rather than answering a defensible question.

## 8. SEO and indexation design

### 8.1 Routes

- `/insights` — editorial hub; index only after at least five approved articles exist.
- `/insights/[slug]` — article detail route.
- Draft and review content must return a 404 publicly or require admin access; it must never be a
  crawlable public preview URL.

### 8.2 Metadata

Each published article needs:

- unique title and meta description,
- self-referencing canonical URL,
- `Article` JSON-LD with real organisation publisher, dates, citations, and referenced datasets,
- Open Graph and Twitter metadata based on a real article visual or deterministic branded fallback,
- visible publication and update dates,
- visible methodology, limitations, sources, and related assets.

Do not fabricate a person author. Cite Supply may be the organisation author until a real named
editorial author and policy exist.

### 8.3 Sitemap architecture

Replace the single URL set only when implementation begins:

- `/sitemap.xml` — sitemap index.
- `/sitemaps/core.xml` — homepage, creator guide, and approved editorial hub.
- `/sitemaps/assets-1.xml` — the existing curated asset set, still capped at 500 until evidence
  supports a different limit.
- `/sitemaps/insights.xml` — only approved, published, indexable editorial pages.

Drafts, search/filter URLs, embeds, redirects, dashboards, submissions, legal utilities, and retired
articles remain outside all sitemaps. The sitemap tests must validate membership and per-type caps,
not merely a global URL count.

### 8.4 Internal links

- Every article links to the exact asset pages and source evidence used.
- Asset pages may link back to approved articles only through an explicit article-asset relation.
- The editorial hub groups articles by reader need, not by automatically generated keyword pages.
- Avoid sitewide article links and large tag archives.
- No automatically indexable tag, source, country, or year pages in the pilot.

### 8.5 Indexing gate

An article becomes indexable only when all of these are true:

1. Status is `approved` and a separate publish action has occurred.
2. All fact packs validate against the current schema.
3. Every fact and citation resolves to a live, approved source.
4. Rights evidence supports commercial publication and the exact transformation or display used.
5. No quantitative claim lacks a fact reference.
6. Definitions, units, periods, and geography are compatible.
7. Method and limitations are visible.
8. Title, thesis, and body are not materially duplicative of another indexable page.
9. Canonical, metadata, structured data, links, and responsive rendering pass.
10. Sol editorial review records an approval decision.

Failure at any later refresh changes the page to `noindex,follow` or retires it, depending on whether
the content remains safe and useful. A stale timestamp alone should not silently rewrite claims.

## 9. Review and model responsibilities

### Luna

- Asset inventory and clustering.
- Candidate extraction from approved fields.
- Schema-conforming briefs and drafts.
- Repetitiveness, missing-field, and link reports.
- Bulk regeneration after the deterministic data pipeline has passed review.

Luna may not approve rights, invent facts, set indexability, deploy, or publish.

### Sol

- Architecture and policy decisions.
- Candidate selection and thesis review.
- Calculation and pipeline code review.
- Interpretation, causality, ambiguity, and limitation review.
- Final editorial approval and indexability decision.
- Release review and production verification.

Neither model replaces deterministic validation. The model name and review time are provenance, not
proof of correctness.

## 10. Quality gates and tests required before launch

### Unit and schema tests

- Article and fact-pack schema validation.
- Source-specific parser fixtures.
- Formula, unit, rounding, missing-value, and status-flag tests.
- Fact-reference completeness.
- Rights eligibility for each source and intended presentation type.
- Duplicate title, thesis, and canonical rejection.
- Article robots metadata and JSON-LD.
- Sitemap inclusion/exclusion.

### Integration tests

- A fact pack can be regenerated from a fixed source fixture with the same output checksum.
- An unapproved article cannot render publicly or enter a sitemap.
- A rights downgrade removes index eligibility.
- A changed source snapshot marks dependent articles for review rather than silently republishing.
- Article-to-asset and asset-to-article links resolve.

### Browser and production tests

- Smartphone, tablet, small desktop, and large desktop rendering.
- Keyboard navigation, focus, headings, landmarks, contrast, and accessible tables.
- Canonical, robots, JSON-LD, and social metadata.
- Broken-link and source-link checks.
- Production sitemap index and all child sitemaps.
- Five pilot article smoke tests covering at least two sources and more than one article format.

The existing `npm run check`, release smoke, and production audit remain mandatory and must be
extended rather than replaced.

## 11. Rollout policy

1. Build the system with every article non-indexable.
2. Produce five calibration articles using different formats and at least two source families.
3. Review, test, deploy, and index only those five.
4. Wait for Search Console to confirm crawl/index behaviour, or for a defined 14-day observation
   window if Google has not yet provided enough data.
5. Release the next ten only if there are no canonical, duplication, crawl, rendering, or factual
   integrity failures.
6. Release the final fifteen under the same gate.
7. Do not increase the programme beyond 30 until the pilot has measurable search impressions,
   reader engagement, stable refresh behaviour, and an acceptable editorial maintenance cost.

Traffic is not guaranteed. A technically valid article that receives no useful demand signal may
remain available but should not automatically justify a larger batch of similar pages.

## 12. Step 2 handoff contract

Step 2 is an inventory exercise, not implementation or publication.

Luna must:

1. Read this strategy and the current asset/rights/source schemas.
2. Export or query assets read-only; do not modify D1.
3. Include only published assets with rights evidence.
4. Record separately whether each asset permits embedding, commercial use, modification, and raw
   data redistribution.
5. Mark whether complete analytical observations are currently available, fetchable through a
   documented source endpoint, or unavailable.
6. Cluster candidates by question and compatible dimensions, not by keyword alone.
7. Detect exact and likely semantic duplicates.
8. Produce `data/editorial/article-candidates.json` and
   `docs/editorial/01-candidate-inventory.md`.
9. Propose more than 30 candidates so Sol can reject weak options, but do not draft articles.
10. Leave every candidate non-indexable and perform no deployment.

Each candidate record should include:

```text
candidate_id
working_question
possible_thesis
format
asset_slugs[]
source_families[]
required_source_requests[]
compatible_dimensions
rights_summary
data_completeness
limitations[]
risk_flags[]
duplicate_group
recommended_for_pilot
```

## 13. Decisions fixed by this strategy

- No one-asset/one-article automation.
- No indexable drafts.
- No values inferred from previews or prose metadata.
- No free-form generated HTML.
- No automatic model approval or deployment.
- No country, tag, year, or source-page explosion in the pilot.
- No more than 30 pilot candidates published, and only in staged batches.
- Existing rights and asset-indexing controls remain authoritative.

## 14. Decisions deferred until after the pilot

- Moving editorial content from version-controlled files to D1 or a CMS.
- Expanding beyond 30 published articles.
- Creating indexable topic hubs.
- Raising the 500-asset sitemap/indexability ceiling.
- Supporting medically, financially, legally, or politically sensitive analyses.
- Accepting machine-readable creator data as an editorial input.

## 15. Step 1 completion record

This step added only this strategy document. It did not change application code, migrations,
content routes, D1 data, Cloudflare configuration, indexability, sitemap output, or production.
