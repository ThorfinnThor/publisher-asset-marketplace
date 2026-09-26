# Step 10 — Private article drafts

**Status:** Drafting complete; no publication or indexing effect.  
**Workflow role:** Luna drafting stage.  
**Date:** 2026-09-24.

## Scope and source locks

Four briefs marked `approved_for_scoped_draft` in `data/editorial/draft-decisions.json` now have structured, English-language drafts under `content/editorial/drafts/`:

| Draft                                                 | Editorial angle                                                                                 | Evidence scope                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `internet-use-grew-at-different-speeds.json`          | A matched-cohort distribution of adoption changes, rather than an unpaired latest-year ranking. | 175 paired UN M49 country-or-area entities; median and interquartile range in percentage points.                                      |
| `reading-eu-renewables-by-energy-use.json`            | Why four EU27 renewable-energy percentages answer different sector questions.                   | Eurostat EU27 aggregate; four categories and within-category changes only. Includes a reuse disclaimer and methodology-break warning. |
| `what-eu-hicp-inflation-rate-means.json`              | How to distinguish a positive but slowing inflation rate from a falling price index.            | Eurostat EU27 annual-average HICP rates; no country or household comparison.                                                          |
| `world-burned-area-across-four-land-cover-types.json` | A source-limited comparison of separate land-cover series across two five-year means.           | OWID World series only; four categories kept separate; no sum, country comparison, or causal claim.                                   |

Each draft is explicitly `draft`, `indexable: false`, and `date_published: null`. The creator-guide brief `cb-005` remains held and has not been drafted because the required live calculator checks are still outstanding.

The files bind to the fact-pack, reviewed-analysis, and draft-decision SHA-256 digests. Every displayed numeric block must cite a reviewed metric or source fact; table rows identify the metric references that a future renderer must resolve. The validator also checks approved brief status, article/brief/pack identity, exact asset scope, citations, duplicate IDs, and private-only status.

## Validation added

- `src/lib/editorial/article-schema.ts`: strict Zod schema and fail-closed checks for the draft envelope and evidence references.
- `scripts/editorial/validate-drafts.ts`: validates the full approved draft set and its source digests.
- `npm run editorial:drafts:check`: repeatable command for that validation.
- `test/editorial-article-schema.test.ts`: coverage for valid drafts and rejected public status, unapproved metrics, unsupported numeric claims, wrong asset scope, and stale decision hashes.

## Important limits before any publication decision

- These documents are editorial drafts, not public routes; they are not added to navigation or any sitemap, and no indexability configuration changed.
- Their source evidence and reuse declarations are snapshots. The fact packs still identify the Cite Supply assets by public route only (`asset_id: null`); confirm the exact live asset, current source values/freshness, attribution, and asset-level rights immediately before publication.
- The Eurostat source snapshot is the recorded fetch used by the prior analysis. Any future refresh must pass the same dimension, status, and licensing checks before figures are updated.
- The validator confirms references exist and are within the approved scope; it cannot decide whether a cited metric logically substantiates each sentence. Step 11 must include a human Sol editorial review of interpretation, wording, source citations, and rendered presentation.
- Structured table rows contain metric IDs, not rendered values. A future public article implementation must resolve only those IDs against the locked analysis output and must fail closed if any reference or digest changes.

## Verification result

`npm run editorial:drafts:check` passed and reported four drafts with `private_non_indexable` status. The targeted Vitest run passed 16 tests across the draft validation and Step 8 analysis suites. TypeScript typecheck, ESLint on the changed TypeScript files, and Prettier checks on the changed artifacts passed.

No full application build, production database mutation, commit, or deployment was performed for this private editorial step.

## Next step

**Step 11 — Sol: independent editorial review of the four private drafts.** Review each claim against the fact packs and source citations, assess whether each article is sufficiently distinctive and useful, request revisions where needed, and keep publication/indexing disabled. Recheck live asset IDs, source freshness, and current rights before any later public-launch decision.
