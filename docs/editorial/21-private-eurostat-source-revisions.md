# Step 22 — source-scoped private Eurostat revisions

**Date:** 2026-09-25  
**Workflow role:** Luna  
**Manifest:** `data/editorial/private-eurostat-preview-manifest.json`  
**Decision record:** `data/editorial/private-eurostat-preview-source-revision-decisions.json`  
**Publication effect:** none. The previews remain private, non-indexable standalone files.

## Renewables source correction

The transport paragraph was narrowed to the claims made by Eurostat's [2024 transport
release](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1): transport is
energy used in all transport activities, and listed renewable inputs include qualifying liquid
biofuels, biomethane, and part of renewable electricity used mostly in road and rail. The revised
paragraph no longer asserts a specific road-and-rail denominator or unspecified multipliers. It
still explains that RES-T is not a percentage of vehicles, trips, or distance. The article now
has 586 substantive words and remains bound to the same approved metrics.

## Exact source adjacency

The renderer now wraps each narrative block in an `editorial-block` carrying its block ID and the
expected citation IDs. Each rendered method-source element also carries its citation ID. The
checker validates the exact wrapper pair for transport, heating/cooling, HICP annual-average
method, HICP index distinction, and HICP classification. A URL appearing only in the final source
list can no longer satisfy those adjacency gates.

## Private outputs

- [EU renewable-energy preview](/Users/schayan/Projects/backlink_marketplace/docs/editorial/previews/cb-002-renewables-private-rendered.html)
  — draft SHA-256 `297519e9b1e754432f5db6d1d4041730911d7c3244b91b8587d1095ddde6f4f8`; preview
  SHA-256 `15f5560b8617a0edb6349ec23f973f80811cec4fa5106261dfb66cdf55a6e1a9`.
- [EU HICP preview](/Users/schayan/Projects/backlink_marketplace/docs/editorial/previews/cb-003-hicp-private-rendered.html)
  — draft SHA-256 `dfd79de90f9e9f5336f6e3e4ff7543ab0f07d7af94edcddbeee14ccd590f13b1`; preview
  SHA-256 `7a1d1c17e842b9fdd178cf3bd2c94c46c9f326430fbbf10d6ff35722c2ffadce`.

## Validation

- Draft schema validation passed; all drafts remain private/non-indexable.
- The depth check passed Internet (701), renewables (586), and HICP (715); wildfire remains held
  at 293 pending source lineage and rights.
- Preview rendering and manifest hashes passed.
- The strengthened private-preview checker passed exact block-to-citation pairs, approved metric
  bindings, HICP chart-domain invariants, private directives, accessibility metadata, and tables.
- Three editorial Vitest files passed: 23 tests.

## Gates still closed

No browser visual or assistive-technology QA was claimed because the local private files have no
permitted browser URL. Live asset identity, freshness, and asset-level rights remain unresolved.
No production code, route, sitemap, commit, or deployment changed.

## Next step

**Step 23 — Sol:** independently review the narrowed transport wording and exact block-level
source checks, then decide whether the two private previews can advance to the external rights,
identity, and permitted browser-QA gates. Keep release closed until those gates pass.
