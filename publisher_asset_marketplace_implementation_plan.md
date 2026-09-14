# Implementation Plan — Publisher Asset Marketplace

> **Product thesis:** Build a marketplace where creators (vibe-coders, SaaS founders, SEOs, companies) publish embeddable calculators, charts, benchmarks, datasets, tables and mini-tools. Publishers discover and embed them. Creator value = distribution, citations, referral traffic and potentially editorial backlinks.
>
> **Bootstrap thesis:** Search is the utility; marketplace is the destination. Seed the publisher search experience with ~3,000 permitted Our World in Data (OWID) assets, measure publisher demand, then open creator submissions.

---

## 0. Non-negotiable product rules

1. **Publishers do not need an account** to search, preview, cite or copy an embed.
2. **Creators need an account only when submissions launch.**
3. **Do not host/rebuild third-party widgets in MVP.** Index and use approved canonical embeds.
4. **Do not promise backlinks.** Promise discovery, embeds, citations and referral opportunity.
5. **No hidden or keyword-rich forced links in embeds.** Attribution must be visible, source/brand based and publisher-readable.
6. **Rights are asset-level, not domain-level.** Never assume every asset on an allowed source has identical rights.
7. **Do not redistribute raw data unless separately verified.**
8. **No AI search in V1.** Start with deterministic full-text search + typo fallback; add semantic search only if query logs prove it is needed.
9. **No mass thin SEO pages.** Search utility comes before SEO.
10. **Manual moderation is acceptable in MVP.** Automate only after repeated work is understood.

---

# 1. Recommended stack

Assumption: greenfield web product. If a repo already exists, preserve the existing stack unless migration has clear value.

| Layer | Choice | Reason |
|---|---|---|
| Web app | Next.js App Router + TypeScript | One codebase; good server-rendered publisher search and dashboards |
| UI | Tailwind + small component layer | Fast, low-complexity implementation |
| DB | Supabase Postgres | Postgres + auth + storage in one system |
| Search V1 | Postgres FTS + `pg_trgm` | No extra search vendor; enough for first corpus |
| Auth | Supabase Auth | Only needed for creators/admin |
| Hosting | Vercel | Simple Next.js deployment |
| Scheduled refresh | Vercel Cron or equivalent protected job | Refresh source metadata/rights |
| Analytics | First-party event tables | Search intent is core proprietary data |
| Preview storage | Prefer source-hosted previews; Supabase Storage only when required | Avoid copying unnecessary assets |
| Monitoring | App logs + DB job/error tables | Keep MVP operationally simple |

### Next.js implementation rules

- Server Components by default.
- Client Components only for interactive search controls, copy buttons and dashboards.
- Server Actions for authenticated creator/admin mutations.
- Route Handlers for public APIs, ingestion endpoints and scheduled jobs.
- Node.js runtime by default.
- Parallelize independent server fetches; avoid request waterfalls.

---

# 2. Model-routing policy: Luna first, Sol only for real complexity

Legend:

- **[LUNA]** = deterministic implementation, CRUD, UI, tests, migrations from an approved schema, repetitive parsers, copy, documentation.
- **[SOL]** = architecture, security, rights/compliance logic, search/ranking design, cross-cutting refactors, difficult debugging, final reviews of critical systems.

## Hard routing rule

Use **Luna unless one of these is true**:

- task changes the data model across multiple domains;
- security boundary is involved (SSRF, XSS, iframe sandboxing, authz, secrets);
- rights/licensing decision logic is being designed;
- ranking/retrieval quality needs non-trivial reasoning;
- a migration can destroy or corrupt production data;
- bug crosses 3+ modules and root cause is unclear;
- performance issue requires profiling/architecture changes;
- launch-critical review of security, rights, analytics integrity or search.

## Cost-efficient handoff pattern

For complex features:

1. **[SOL] Specify** the contract/ADR/schema and edge cases.
2. **[LUNA] Implement** the approved specification.
3. **[LUNA] Add tests** and fix deterministic failures.
4. **[SOL] Review only the critical diff** if it touches security, rights, ranking or data integrity.

Do **not** ask Sol to build routine UI after it has already specified the behavior.

## Agent task packet

Every coding task should be passed with only:

```md
Goal:
Allowed files/modules:
Inputs/contracts:
Constraints:
Acceptance tests:
Output: patch + short change summary
Do not redesign unrelated code.
```

Do not feed the entire repository when 3–8 files are sufficient.

---

# 3. MVP definition

## Publisher-facing MVP

A publisher can:

1. open the site;
2. search e.g. `life expectancy germany`;
3. get ranked reusable assets;
4. see preview, title, source, freshness and clear rights badges;
5. open the canonical source;
6. copy the official embed;
7. copy a correct citation;
8. do all of this without signing in.

## Creator-facing MVP

After publisher search is working:

1. creator signs in;
2. submits a canonical URL + approved iframe/embed URL;
3. selects asset type;
4. supplies source/brand attribution;
5. declares usage conditions;
6. submission enters manual review;
7. approved asset appears in search;
8. creator sees impressions, detail views, embed copies, citation copies and outbound clicks.

## Explicitly NOT in MVP

- AI-generated widgets
- hosted widget builder
- payments
- bidding/sponsored rankings
- creator marketplace payouts
- comments/community
- WordPress plugin
- Chrome extension
- automatic backlink verification
- arbitrary JavaScript embeds
- automatic crawling of the whole web
- vector database
- public API
- multi-language UI

---

# 4. Core data model

Keep the first schema small, but preserve auditability.

## `sources`

```text
id
key                 unique, e.g. "owid"
name
base_url
policy_url
active
created_at
updated_at
```

## `assets`

```text
id
source_id           nullable for creator-owned assets
creator_id          nullable for seeded assets
external_id         nullable; source-specific stable id
slug                unique public slug
asset_type          chart | calculator | table | dataset | benchmark | widget
title
description
canonical_url
embed_url
preview_url
citation_text
attribution_name
attribution_url
published_at
source_updated_at
license_code
rights_status       safe | restricted | unknown | blocked
rights_json         JSONB
metadata_json       JSONB raw source metadata for audit
search_document     generated/searchable field
status              draft | review | published | hidden
created_at
updated_at
last_checked_at
```

## `rights_json`

Tri-state fields are intentional: `true`, `false`, `null/unknown`.

```json
{
  "embed_allowed": true,
  "commercial_use": true,
  "modification_allowed": true,
  "citation_required": true,
  "raw_data_redistribution": null,
  "share_alike": false,
  "attribution_required": true,
  "evidence_url": "...",
  "evidence_checked_at": "..."
}
```

## `profiles`

```text
id                  = auth user id
role                creator | admin
display_name
website_url
created_at
```

## `submissions`

```text
id
creator_id
canonical_url
embed_url
asset_type
title
description
attribution_name
attribution_url
declared_rights_json
review_status       pending | approved | rejected | needs_changes
review_notes
created_at
reviewed_at
reviewed_by
asset_id            nullable until approved
```

## `search_events`

```text
id
anonymous_session_id
query_raw
query_normalized
result_count
created_at
```

Do not store unnecessary personal data.

## `asset_events`

```text
id
anonymous_session_id
asset_id
event_type          impression | detail_view | embed_copy | citation_copy | source_click
search_event_id     nullable
result_position     nullable
created_at
```

## `rights_reviews`

```text
id
asset_id
decision
reason_code
notes
evidence_url
reviewed_by
created_at
```

Purpose: every public rights claim must be explainable later.

---

# 5. Rights policy

## Public status mapping

### `safe`

Show strong badges only when supported by source metadata/policy:

- Embed allowed
- Commercial publishing allowed, if verified
- Attribution/citation requirement
- Modification status

### `restricted`

Asset can be discoverable, but action must match restrictions.

Examples:

- non-commercial only;
- no derivatives;
- embed allowed but raw redistribution not allowed.

### `unknown`

Can appear only if product copy clearly says rights are unverified. Prefer excluding from default results until reviewed.

### `blocked`

Never expose copy/embed action.

## Important distinction

These are separate:

```text
Can display a preview?
Can link to the canonical source?
Can embed the source-hosted chart?
Can use commercially?
Can modify?
Must attribute?
Can redistribute raw data?
```

Never collapse them into one `reuse_allowed` boolean.

---

# 6. Milestone A — Repository + product contracts

### A1. Product ADR
**Model:** [SOL]

Write one short architecture decision record containing:

- publisher-first bootstrap;
- seed corpus ≠ marketplace supply;
- source-hosted embeds;
- rights are per asset;
- no arbitrary JS in MVP;
- first-party demand analytics;
- no backlink guarantee.

**Done when:** future agents cannot plausibly interpret the product as an OWID clone or generic dataset search engine.

### A2. Repository scaffold
**Model:** [LUNA]

Create:

```text
src/app/
  page.tsx
  search/page.tsx
  asset/[slug]/page.tsx
  submit/page.tsx
  dashboard/page.tsx
  admin/submissions/page.tsx

src/lib/
  db/
  search/
  rights/
  ingest/
  analytics/

scripts/
  ingest-owid.ts
  refresh-assets.ts
```

Add env validation, linting, formatting and CI build/test command.

**Done when:** clean checkout installs, builds and serves without manual edits.

### A3. Database schema
**Design:** [SOL]  
**Migration implementation:** [LUNA]

Implement the schema above with constraints and indexes.

Required uniqueness:

- `(source_id, external_id)` when present;
- canonical URL normalized;
- public `slug`.

Required indexes:

- asset status;
- asset type;
- source;
- rights status;
- update time;
- FTS;
- trigram title.

**Done when:** migration works from empty DB and can be rerun safely in CI test DB.

---

# 7. Milestone B — OWID seed ingestion

Goal: turn the existing ~3,000-item list into an auditable seed corpus.

### B1. Input normalizer
**Model:** [LUNA]

Accept CSV/JSON/TXT containing OWID URLs or slugs.

Normalize:

```text
URL -> slug
remove query params
dedupe exact slugs
reject malformed rows
produce import report
```

Output:

```text
accepted
duplicates
invalid
```

### B2. Source client
**Model:** [LUNA]

For each slug, fetch only documented source endpoints needed for:

- metadata;
- chart configuration/license;
- preview/embed/canonical URLs.

Requirements:

- bounded concurrency;
- timeout;
- retry with backoff;
- user agent;
- structured error logging;
- no infinite retry.

Store raw relevant JSON in `metadata_json`.

### B3. Rights-classification specification
**Model:** [SOL]

Create a deterministic decision table, not an LLM classifier.

Example shape:

```text
license + ownership/evidence + embed capability
    -> rights_status
    -> individual rights_json fields
    -> public badges
    -> permitted actions
```

Requirements:

- unknown stays unknown;
- raw-data rights never inferred from chart rights;
- restrictive licenses cannot accidentally become `safe`;
- decision records include evidence URL/date.

### B4. Rights classifier implementation
**Model:** [LUNA]

Implement the approved table as pure functions.

No network calls inside the classifier.

Tests must cover every supported license/status combination.

### B5. Import runner
**Model:** [LUNA]

Pipeline:

```text
read list
-> normalize
-> fetch metadata
-> classify rights
-> build asset
-> upsert
-> log result
```

Must be restartable/idempotent.

### B6. Import audit
**Model:** [SOL]

Review a stratified sample:

- safe;
- restricted;
- unknown;
- blocked;
- missing metadata;
- old/stale source data.

**Gate B:** do not launch public rights badges until audit shows the classifier is behaving conservatively.

### B7. Refresh job
**Model:** [LUNA]

Scheduled job:

- re-check stale assets;
- update source timestamp;
- update rights evidence;
- hide broken/deleted assets;
- preserve previous audit trail.

Do not refresh all rows on every run; use `last_checked_at`.

---

# 8. Milestone C — Publisher search

This is the first user-facing product and must work before creator marketplace features.

### C1. Search contract/ranking
**Model:** [SOL]

V1 retrieval:

1. normalized query;
2. Postgres FTS over title, description, asset type, source;
3. title/exact phrase boost;
4. `safe` + embeddable asset quality boost;
5. freshness as a modest boost, not a hard filter;
6. trigram fallback for typo/low-result queries.

Do not add embeddings yet.

Suggested weighting:

```text
title            strongest
topic/type       strong
description      medium
source           weak
```

Ranking must never promote a blocked asset because of popularity.

### C2. Search SQL/function
**Implementation:** [LUNA]  
**Ranking review:** [SOL]

Build one query/function that returns:

```text
asset
score
matched fields
```

Add deterministic fixtures for:

- exact title;
- partial phrase;
- typo;
- zero result;
- restricted vs safe tie.

### C3. Search page
**Model:** [LUNA]

UI:

```text
[ Find data, calculators and charts you can publish... ]

Filters:
Asset type
Source
Rights status
Freshness (optional)
```

Result card:

```text
Preview
Title
Short description
Source
Updated date

Embed ✓
Commercial use ✓ / Restricted / Unknown
Citation required ✓

[Preview] [Embed] [Cite] [Source]
```

No sign-in wall.

### C4. Asset detail page
**Model:** [LUNA]

Contains:

- preview;
- source;
- canonical source link;
- embed instructions;
- exact citation;
- rights breakdown;
- freshness;
- explicit distinction between chart/embed rights and raw-data rights;
- related assets.

Do not copy long third-party descriptions.

### C5. Embed action
**Model:** [LUNA]

For seeded sources, copy the approved source-hosted iframe/embed only.

Track `embed_copy`.

### C6. Citation action
**Model:** [LUNA]

One-click copy of the stored citation.

Track `citation_copy`.

### C7. Search analytics
**Model:** [LUNA]

Track:

```text
query
result count
result impressions
detail views
embed copies
citation copies
source clicks
result position
```

Use anonymous session ids; do not require publisher accounts.

### C8. Search quality review
**Model:** [SOL]

Review a fixed benchmark set of publisher-style queries.

Score each:

```text
0 = unusable
1 = somewhat relevant
2 = strong answer
```

Keep benchmark queries in repo so later ranking changes are comparable.

**Gate C:** marketplace work starts only after search/event tracking is reliable enough to create real demand data.

---

# 9. Milestone D — Demand intelligence

This is the bridge from search utility to marketplace supply.

### D1. Query normalization
**Design:** [SOL]  
**Implementation:** [LUNA]

Aggregate variants without destroying meaning:

```text
"saas churn"
"saas churn rate"
"SaaS churn rates"
```

Start rule-based. Do not use an LLM per query.

Store both raw and normalized forms.

### D2. Demand aggregation
**Model:** [LUNA]

Scheduled aggregates:

```text
query/topic
searches
unique anonymous sessions
result count distribution
asset clicks
embed copies
citation copies
no-result rate
```

### D3. Opportunity score
**Design:** [SOL]  
**Implementation:** [LUNA]

Initial transparent formula, e.g.:

```text
demand
x scarcity
x engagement intent
```

Where scarcity rises when:

- zero/low results;
- few safe assets;
- few embeddable assets.

Do not hide a complicated ML score behind fake precision.

### D4. Internal opportunity dashboard
**Model:** [LUNA]

Show:

```text
Top searches
Fastest-growing queries
No-result queries
Low-supply/high-demand topics
Top copied assets
```

This dashboard exists before any public “build this” feature.

---

# 10. Milestone E — Creator marketplace supply

Only start after publisher search events exist.

### E1. Creator auth/profile
**Model:** [LUNA]

- magic link/OAuth;
- creator profile;
- website;
- display name.

Publishers remain anonymous.

### E2. Submission security model
**Model:** [SOL]

MVP accepts:

- canonical `https://` URL;
- iframe `https://` URL;
- structured metadata.

MVP rejects:

- arbitrary script tags;
- inline JavaScript;
- executable HTML;
- `javascript:` / `data:` URLs;
- private/internal network targets.

If server-side URL fetching is later added, implement SSRF protection:

- allow only HTTP(S);
- resolve and reject private/link-local/loopback IPs;
- limit redirects;
- response size cap;
- timeout;
- content-type checks.

### E3. Submission form
**Model:** [LUNA]

Fields:

```text
Canonical URL
Asset type
Title
Short description
Embed URL
Preview URL (optional)
Brand/source name
Attribution URL
Attribution terms
Commercial use?
Modification allowed?
```

Creator must explicitly confirm they are authorized to submit the asset and declare usage terms accurately.

### E4. Manual moderation queue
**Model:** [LUNA]

Admin actions:

```text
preview
approve
reject
needs changes
edit normalized metadata
set rights status
record rights evidence
```

No creator asset becomes searchable automatically in V1.

### E5. Approved creator asset publishing
**Model:** [LUNA]

Approval creates/updates `assets`.

Creator and seeded assets use the same publisher search index.

### E6. Creator attribution/embed policy
**Model:** [SOL]

Policy:

- source attribution is visible;
- link text is source/brand, not SEO keyword;
- no hidden links;
- no forced keyword anchor;
- no claim of guaranteed dofollow/backlink;
- publisher can see exactly what will be inserted;
- creator-declared legal attribution requirements are displayed clearly.

Product language:

```text
Good:
Get discovered by publishers.
Earn embeds, citations and referral exposure.
See publisher demand.

Avoid:
Guaranteed backlinks.
Automatic SEO links.
Get X dofollow backlinks.
```

### E7. Creator dashboard
**Model:** [LUNA]

Per asset:

```text
search impressions
detail views
embed copies
citation copies
source clicks
top discovery queries
```

Do not label an `embed_copy` as a confirmed embed.

Do not label a source click as a backlink.

---

# 11. Milestone F — Marketplace flywheel

### F1. Public creator opportunity page
**Model:** [LUNA]

After enough data exists:

```text
Publisher demand

"SaaS churn calculator"
High demand
Low current supply

"AI adoption statistics"
High demand
Few publishable sources
```

Use ranges/buckets if exact counts would leak sensitive or noisy data.

### F2. “Build this” workflow
**Model:** [LUNA]

From opportunity:

```text
View demand
-> Submit existing asset
-> Create submission draft pre-tagged to topic
```

Do not build an AI widget generator yet.

### F3. Creator acquisition landing page
**Model:** [LUNA]

Core message:

> **Build useful tools. Get discovered by publishers.**

Support with actual marketplace metrics once available.

### F4. Cross-source connectors
**Connector design per source:** [SOL]  
**Parser implementation:** [LUNA]

Every new source needs a mini-spec:

```text
What may we index?
What may we preview?
What may we embed?
Commercial reuse?
Attribution?
Raw-data redistribution?
Stable IDs?
Stable embed URLs?
Refresh endpoint?
Policy evidence?
```

No source is onboarded from “the domain looks open.”

---

# 12. Post-MVP features — only when triggered by evidence

## Semantic search
**Trigger:** repeated benchmark/query logs show lexical search misses obvious intent.

**Design:** [SOL]  
**Implementation:** [LUNA]

Add pgvector/hybrid retrieval rather than replacing deterministic search.

## Chrome/WordPress integration
**Trigger:** publishers repeatedly use the site during article writing and ask for in-editor retrieval.

**Design:** [SOL]  
**UI/integration implementation:** [LUNA]

Core action:

```text
highlight text
-> Find source
-> choose asset
-> insert embed/citation
```

## Backlink/citation detection
**Trigger:** creators value confirmed publication outcomes enough to justify crawling/API cost.

**Architecture:** [SOL]  
**Implementation:** [LUNA]

Keep these metrics separate:

```text
embed copied
embed detected
citation detected
referring domain detected
link detected
```

## Automated submission extraction
**Trigger:** manual metadata entry materially blocks creator submissions.

**Security/spec:** [SOL]  
**Extractor:** [LUNA]

## Creator monetization
**Trigger:** creators repeatedly submit and demand analytics/priority tooling.

Potential paid features:

- advanced analytics;
- demand alerts;
- multiple brands/workspaces;
- historical query trends;
- API/export;
- asset monitoring;
- verified creator/source status.

Do not sell organic ranking placement as if it were editorial relevance.

---

# 13. Analytics definitions

These definitions must be fixed before launch.

```text
search
A submitted non-empty publisher query.

impression
Asset card rendered in a result set.

detail_view
Asset detail opened.

embed_copy
User clicked copy embed and clipboard action succeeded.

citation_copy
User clicked copy citation and clipboard action succeeded.

source_click
User opened the canonical source.

creator_impression
Creator-owned asset appeared in publisher results.

confirmed_embed
Only after independent detection; never infer from copy.

confirmed_citation
Only after independent detection.

confirmed_backlink
Only after independent detection.
```

Core marketplace funnel:

```text
Searches
-> useful results
-> asset interactions
-> embed/citation intent
-> creator submissions
-> approved supply
-> creator asset usage
```

---

# 14. Validation gates / falsification criteria

These are product gates, not vanity targets.

## Gate 1 — Seed corpus integrity

Proceed only if:

- ingestion is idempotent;
- every displayed rights badge has traceable evidence;
- failed/unknown assets are not silently presented as safe;
- broken assets can be hidden quickly.

## Gate 2 — Publisher utility

Run a benchmark set plus real publisher tests.

Track:

- % searches with at least one useful result;
- result interaction rate;
- embed/citation copy rate;
- no-result topics;
- repeated usage.

If users only open source pages and never copy/embed/cite, the product may be a search directory rather than a marketplace wedge.

## Gate 3 — Demand signal

Before pushing creator acquisition, require evidence that:

- searches repeat around recognizable topics;
- meaningful low-supply queries exist;
- publisher actions concentrate around certain asset types/topics.

## Gate 4 — Creator value

Creator marketplace is validated only when creator-owned assets receive real publisher impressions and actions.

A large number of creator submissions alone is not success.

---

# 15. Security checklist

Critical items get Sol design/review.

### [SOL] Security design

- iframe sandbox/CSP policy;
- embed origin policy;
- SSRF policy for any URL fetcher;
- admin authorization;
- creator ownership/authorization model;
- rate limiting;
- secrets;
- takedown workflow.

### [LUNA] Implementation/tests

- validate URL protocols;
- allowlist approved iframe origins per asset;
- sanitize user text;
- never render submitted raw HTML;
- CSRF-safe authenticated mutations;
- DB RLS/policies where used;
- rate-limit submission/search abuse;
- security headers;
- error pages do not leak secrets.

### Required tests

```text
javascript: URL rejected
data: URL rejected
localhost/private IP rejected if fetcher exists
creator cannot edit another creator's asset
non-admin cannot moderate
blocked asset cannot generate embed action
unsafe submitted HTML is displayed as text, not executed
```

---

# 16. SEO policy

Do not turn the seed corpus into 3,000 near-duplicate landing pages solely for search traffic.

Initial policy:

- homepage: index;
- useful asset detail pages: index only if they contain unique normalized rights/citation/value;
- internal search result pages: `noindex` initially;
- creator dashboards/admin: noindex;
- canonical points to our asset page only when our page has genuine standalone value;
- always link prominently to original source.

Unique value on an asset page must include:

```text
normalized rights
embed capability
citation
freshness
asset type
source transparency
related publisher-ready assets
```

SEO is downstream of utility.

---

# 17. Test strategy

## Unit — mostly [LUNA]

- URL normalizer;
- slug parser;
- license/rights decision table;
- query normalization;
- citation formatting;
- embed generation;
- event definitions.

## Integration — [LUNA]

- ingest one source fixture;
- upsert idempotency;
- search DB function;
- creator submission -> review -> publish;
- analytics events.

## Security — design/review [SOL], execution [LUNA]

- authz;
- XSS;
- iframe;
- SSRF if applicable.

## Search quality — [SOL]

Maintain `search-benchmark.json`:

```json
[
  {
    "query": "life expectancy germany",
    "expected_asset_ids": ["..."]
  }
]
```

Run automatically after ranking changes.

## Smoke/E2E — [LUNA]

Critical path:

```text
search
-> open result
-> copy citation
-> copy embed

creator login
-> submit
-> admin approve
-> asset searchable
-> creator sees events
```

---

# 18. Release order

Do not build all phases in parallel.

```text
1. ADR + schema
2. OWID import + rights audit
3. Publisher search
4. Embed/citation actions
5. Analytics
6. Demand dashboard
7. Creator auth + submission
8. Manual moderation
9. Creator analytics
10. Public demand/opportunity surface
11. New source connectors
12. Only then: extensions, semantic search, backlink detection, monetization
```

This order protects against building the supply marketplace before publisher utility exists.

---

# 19. Concrete task backlog

| ID | Task | Model | Depends on | Done condition |
|---|---|---|---|---|
| A1 | Product/architecture ADR | **SOL** | — | Product boundaries frozen |
| A2 | Next.js repo scaffold | **LUNA** | A1 | CI build green |
| A3 | DB schema design | **SOL** | A1 | Schema/constraints approved |
| A4 | DB migrations | **LUNA** | A3 | Clean migration test |
| B1 | OWID list parser/dedupe | **LUNA** | A4 | Import report produced |
| B2 | OWID API client | **LUNA** | B1 | Fixtures + bounded retries |
| B3 | Rights decision table | **SOL** | B2 | Deterministic spec |
| B4 | Rights classifier | **LUNA** | B3 | Full decision-table tests |
| B5 | Idempotent importer | **LUNA** | B2,B4 | Re-run creates no duplicates |
| B6 | Rights/import audit | **SOL** | B5 | Edge-case review passes |
| B7 | Refresh job | **LUNA** | B5 | Stale/broken assets updated |
| C1 | Search ranking spec | **SOL** | B5 | Ranking contract + benchmark |
| C2 | FTS/trigram query | **LUNA** | C1 | Search tests green |
| C3 | Search UI | **LUNA** | C2 | Useful mobile/desktop flow |
| C4 | Asset detail page | **LUNA** | C2 | Rights/embed/source visible |
| C5 | Embed/citation copy | **LUNA** | C4 | Clipboard + events work |
| C6 | First-party analytics | **LUNA** | C3 | Search/action events persisted |
| C7 | Search-quality review | **SOL** | C2,C6 | Benchmark reviewed |
| D1 | Query normalization spec | **SOL** | C6 | Aggregation rules approved |
| D2 | Demand aggregation | **LUNA** | D1 | Daily/topic aggregates work |
| D3 | Opportunity score spec | **SOL** | D2 | Transparent formula |
| D4 | Internal demand dashboard | **LUNA** | D2,D3 | Low-supply queries visible |
| E1 | Creator auth/profile | **LUNA** | C6 | Creator login works |
| E2 | Submission security design | **SOL** | E1 | Embed/fetch boundaries defined |
| E3 | Submission form | **LUNA** | E2 | Pending submission created |
| E4 | Admin moderation | **LUNA** | E3 | Approve/reject/notes |
| E5 | Creator asset publishing | **LUNA** | E4 | Approved asset searchable |
| E6 | Attribution/link policy | **SOL** | E5 | Safe visible attribution rule |
| E7 | Creator analytics | **LUNA** | E5,C6 | Per-asset funnel visible |
| F1 | Public opportunity surface | **LUNA** | D4,E7 | Demand surfaced safely |
| F2 | “Build this” flow | **LUNA** | F1 | Opportunity -> submission |
| F3 | New source connector spec | **SOL** | B6 | Rights/API contract per source |
| F4 | Connector parser | **LUNA** | F3 | Source imported through common pipeline |
| R1 | Launch security review | **SOL** | E6 | Critical issues resolved |
| R2 | E2E regression suite | **LUNA** | E7 | Critical journeys green |
| R3 | Launch search/rights review | **SOL** | R1,R2 | No known unsafe claims/ranking defects |

---

# 20. Sol budget: where it is actually worth spending

Use Sol on these tasks and avoid expanding the list casually:

1. product/architecture ADR;
2. DB/domain schema design;
3. rights classification decision table;
4. rights audit;
5. search ranking contract;
6. search-quality review;
7. query clustering/normalization design;
8. opportunity scoring formula;
9. submission/iframe/SSRF security model;
10. attribution/backlink policy;
11. new-source compliance/connectors;
12. production security review;
13. difficult cross-cutting bugs.

Everything else defaults to Luna.

---

# 21. Luna batch strategy

Batch related mechanical work to reduce context/setup tokens.

Good Luna batches:

### Batch L1 — Foundation
```text
repo scaffold
env validation
base layout
CI
```

### Batch L2 — Import mechanics
```text
input parser
source client
upsert
import logging
fixtures
```

### Batch L3 — Search UI
```text
search form
filters
result card
asset detail
copy buttons
```

### Batch L4 — Analytics
```text
event helpers
search events
asset events
creator aggregate queries
```

### Batch L5 — Marketplace CRUD
```text
auth profile
submission form
moderation UI
creator dashboard
```

Do not batch unrelated architecture work into the same Luna prompt.

---

# 22. Repository documentation required

Keep only a small set of high-value docs.

```text
/README.md
/docs/product-adr.md
/docs/rights-policy.md
/docs/search-ranking.md
/docs/analytics-events.md
/docs/security.md
/docs/source-connectors.md
```

Each source connector gets one concise section containing policy evidence and mapping rules.

Agents should read only the docs relevant to their task.

---

# 23. First implementation slice

The first end-to-end slice should be deliberately narrow:

```text
10 OWID assets
-> ingest
-> rights classify
-> save
-> search
-> asset page
-> copy official embed
-> copy citation
-> event tracking
```

Only after that path works should the importer run over all ~3,000 assets.

Reason: it validates the schema, rights model and publisher interaction before bulk data hides architecture mistakes.

---

# 24. Product north star

Do not optimize for number of indexed assets.

The marketplace becomes valuable when:

> **A publisher finds an asset they can confidently publish, and the creator gains measurable distribution from that use.**

The defensible data loop is:

```text
Publisher searches
-> search intent
-> supply gaps
-> creator opportunities
-> new creator assets
-> publisher embeds/citations
-> creator outcomes
-> more creator supply
```

**Search is the bootstrap. Marketplace liquidity is the product. Publisher intent is the data moat.**
