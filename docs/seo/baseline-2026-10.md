# Cite Supply SEO baseline — October 2026

**Audit timestamp:** 2026-10-03T20:49:09Z  
**Mode:** read-only production and repository inspection  
**Plan:** V2-01 from `docs/seo/citesupply-seo-implementation-plan-v2.md`

## Executive result

The deployed technical SEO foundation is functioning in the checked scope. The live site, robots file, LLM discovery file and sitemap returned HTTP 200. All 40 public/indexable URLs in the stratified 44-URL sample returned HTTP 200, a self-referencing canonical and no `noindex`. The four control routes returned the expected exclusion state.

This is not evidence that Google has indexed all sampled pages. The current authenticated Google Search Console export could not be obtained: the available in-app Google account (`pixsatmaps@gmail.com`) reports that it does not have access to the `sc-domain:citesupply.com` property, and the connected Chrome profile was not available to computer control. Historical GSC figures are recorded below only as prior context, not as a fresh export.

One content-quality issue was visible in the real browser: `/topics/energy-and-climate` currently includes at least one nutrition asset because the broad query matches the word "energy" in its description. The topic route is technically healthy, but candidate selection needs an editorial allowlist or a more precise topic mapping before the SEO pilot expands.

## Repository and release baseline

| Field               | Value                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository          | `ThorfinnThor/publisher-asset-marketplace`                                                                                                          |
| Branch              | `main`                                                                                                                                              |
| Audited commit      | `2f65c67ad42e701fd8e6d0db22202719019cc85a`                                                                                                          |
| Commit subject      | `Update release smoke for curated SEO pages`                                                                                                        |
| Commit time         | 2026-09-27T16:48:16+02:00                                                                                                                           |
| Production workflow | `Deploy to Cloudflare`                                                                                                                              |
| Workflow run        | [36327241427](https://github.com/ThorfinnThor/publisher-asset-marketplace/actions/runs/36327241427)                                                 |
| Workflow result     | Successful; check, creator publication E2E, embed sandbox E2E, D1 migrations, scanner deploy, Worker deploy and production release smoke all passed |
| Workflow completion | 2026-09-27T14:50:41Z                                                                                                                                |

The public responses are consistent with the audited release. A build identifier is exposed in production headers, but it is not treated as a substitute for the Git/GitHub release record.

## Live catalog and discovery surfaces

| Signal                                     |                                                     Live value |
| ------------------------------------------ | -------------------------------------------------------------: |
| Published assets displayed on the homepage |                                                         10,459 |
| Sitemap URLs                               |                                                            510 |
| Selectively included asset URLs            |                                                            494 |
| Topic detail URLs                          |                                                              8 |
| Insight detail URLs                        |                                                              4 |
| Other static sitemap URLs                  |                                                              4 |
| Sitemap response                           | HTTP 200, `application/xml`, Cloudflare cache hit during audit |
| `robots.txt` response                      |                                                       HTTP 200 |
| `llms.txt` response                        |                                                       HTTP 200 |

The 494 sitemap asset URLs break down by URL shape as follows:

| URL class            | Count | Interpretation limit                                                                               |
| -------------------- | ----: | -------------------------------------------------------------------------------------------------- |
| `/asset/eurostat-*`  |   152 | Eurostat import family                                                                             |
| `/asset/worldbank-*` |   100 | World Bank import family                                                                           |
| Other asset slugs    |   242 | Predominantly OWID/legacy catalog; exact D1 source counts were not available in this read-only run |
| `/asset/creator-*`   |     0 | No creator-prefixed asset is present in the selective sitemap; this does not mean none exist in D1 |

The sitemap is intentionally much smaller than the published catalog. That is consistent with the explicit `search_indexable` gate and is not an error.

## URL sample

The full sample is in `docs/seo/url-inventory.csv`.

| Cohort                   |   URLs | Result                                                     |
| ------------------------ | -----: | ---------------------------------------------------------- |
| Static public hubs       |      4 | 4 passed                                                   |
| Topic detail pages       |      8 | 8 passed technically; energy result relevance needs review |
| Public insights          |      4 | 4 passed                                                   |
| OWID/non-prefixed assets |      8 | 8 passed                                                   |
| Eurostat assets          |      8 | 8 passed                                                   |
| World Bank assets        |      8 | 8 passed                                                   |
| Exclusion controls       |      4 | 4 passed                                                   |
| **Total**                | **44** | **44 matched the expected technical state**                |

For public pages, "passed" means HTTP 200, canonical present and no `noindex`. For controls, it means the expected `noindex` or robots-excluded state was present. It does not mean that every page is indexed, ranks, or satisfies the future pilot content standard.

The asset samples were distributed across each URL family rather than selected from the beginning of the sitemap only. The URL-shape source grouping is recorded separately from actual database source metadata.

## Technical implementation findings

### Confirmed in production

- The homepage, creator guide, insights index and topics index are canonical and indexable.
- All eight topic pages are canonical and indexable.
- All four public insights expose `Article` structured data.
- Sampled Eurostat and World Bank pages expose `Dataset` structured data.
- Sampled OWID pages expose `CreativeWork` structured data.
- `/search` returns `noindex, follow` and has no canonical.
- `/submit` and `/creator/dashboard` return `noindex, nofollow` and have no canonical.
- `/embed/worldbank-eg.elc.accs.zs` returns `noindex, nofollow`; `/embed/` is also excluded in `robots.txt`.
- `robots.txt` permits public search/reference use and points at `https://citesupply.com/sitemap.xml`.
- The live energy hub is available at `/topics/energy-and-climate`; no `/topics/energy` route is needed.

### Confirmed in repository

- Selective asset indexability requires safe rights, explicit `search_indexable`, useful title/description length and a public HTTPS canonical.
- The sitemap lists the static hubs, all eight topics, four public insights and only eligible database assets.
- Existing product analytics distinguish search/detail/source/copy intent from actual embed loads and hashed publisher-site counts.
- Existing release smoke covers robots, sitemap, `llms.txt`, representative OWID/World Bank/Eurostat assets, embed routes, auth entry and private workflow controls.
- The editorial system contains fact packs, calculation output, article validation, protected previews and release reviews for the four existing insights.

### Automated verification run during V2-01

The following focused test set passed on the audited working tree:

- `test/sitemap.test.ts`
- `test/seo.test.ts`
- `test/topics.test.ts`
- `test/llms-txt.test.ts`
- `test/creator-dashboard.test.ts`
- `test/embed-usage.test.ts`

Result: **6 test files and 23 tests passed**.

## Current gaps relevant to the pilot

1. **No fresh GSC export.** The available authenticated browser account lacks property access. A current 28-day and 90-day export remains required before scoring candidates by observed demand.
2. **No database-level source aggregation.** The local Wrangler session has no `CLOUDFLARE_API_TOKEN`; no production D1 query was attempted after that read-only authentication failure. Sitemap URL shapes were used only for a transparent provisional breakdown.
3. **Topic relevance is too broad.** The energy hub search can surface assets that merely mention nutritional energy. Pilot links should use an approved asset list or a stronger topic mapping rather than raw full-text matches alone.
4. **Asset-level editorial context is incomplete.** Current asset pages provide source, dates, rights, data previews, citation and embeds, but generally do not provide a reviewed question-specific answer, method and limitations.
5. **No pilot cohort report is present.** Product analytics exist, but a durable mapping for release cohort, content version and GSC comparison was not found.
6. **Refresh-to-editorial invalidation is incomplete.** Source refresh tools exist, but the pilot still needs an explicit rule that marks affected claims for review when their data/schema changes.

## GSC evidence and blocker

### Fresh evidence available

None. No current Search Console performance export is attached to this baseline.

### Historical context only

The original planning document records the following previous audit summary:

- 77 impressions and 0 clicks in its cited completed reporting window through 29 September 2026;
- 11 page impressions each for the fossil-reserves asset and `eurostat-tour_ce_oar`;
- three checked content pages reported as indexed;
- `/topics` reported as "Crawled — currently not indexed".

Those values are not a raw export and must not be used as the final V2-02 scoring dataset.

### Required completion action

Provide read-only access to the `sc-domain:citesupply.com` Search Console property in an accessible browser/account, or provide exported performance CSV files for:

1. the latest fully complete 28-day window; and
2. the available 90-day window.

The export must record property, search type, dates, timezone/data freshness and dimensions. Until then, V2-02 may build the mechanical inventory but Sol must not finalize search-demand scoring from the historical summary alone.

## V2-01 decision

**Repository/live technical baseline:** complete.  
**44-URL inventory:** complete.  
**Deployment record:** complete.  
**Fresh GSC export:** blocked by property access.  
**Production mutations:** none.

V2-02 may proceed only with catalog/source/content fields. Its final prioritization gate remains open until fresh GSC evidence is supplied.
