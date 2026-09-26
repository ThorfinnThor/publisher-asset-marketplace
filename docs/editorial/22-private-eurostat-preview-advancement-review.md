# Step 23 — independent Eurostat preview advancement review

**Date:** 2026-09-25  
**Workflow role:** Sol  
**Decision record:** `data/editorial/private-eurostat-preview-advancement-decisions.json`  
**Publication effect:** none.

## Decision

Both private Eurostat previews pass the independent editorial and source-logic review. They may
advance to the external identity, rights, freshness, responsive-browser, and
assistive-technology gates. This is not approval to publish: both previews remain private,
non-indexable, absent from the sitemap, and without a public route.

The renewable-energy draft has 586 substantive words. Its revised transport paragraph now stays
within Eurostat's
[2024 transport note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1):
the 11.2% value concerns energy used in all transport activities, and the note identifies
qualifying liquid biofuels, biomethane, and part of renewable electricity used mostly in road and
rail. The text no longer claims a road-and-rail denominator or an unsupported multiplier. Its
practical warning—that RES-T is not a share of vehicles, trips, or distance—is an appropriately
labelled interpretation of that defined energy measure. The separate
[2024 heating-and-cooling note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1)
continues to support the source examples and the rule against double-counting renewable
electricity used by heat pumps.

The HICP draft has 715 substantive words and retains the Step 21 editorial pass. The annual-rate
explanation, rate-versus-index distinction, and classification discussion remain bound to their
intended Eurostat sources. Eurostat's
[HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm) supports the
measure and classification context. Its chart values remain inside the declared domain and have
axis ticks, point markers, direct values, year labels, an accessible description, and an
equivalent table.

## Exact source-binding review

The strengthened checker is meaningful. It requires each named narrative block to carry the
expected citation ID and requires a matching source element inside that exact block wrapper. A
URL appearing only in the final sources section can no longer pass this gate. The five reviewed
pairs—transport, heating and cooling, annual-average HICP, rate versus index, and HICP
classification—are present and pass.

This check proves structural adjacency in the generated HTML. It does not prove how a browser or
screen reader presents that relationship, so responsive visual and assistive-technology QA remain
separate release gates.

## Repeated validation

- Draft schema validation passed; all drafts remain private and non-indexable.
- The depth check passed Internet (701 words), renewables (586), and HICP (715). Wildfire remains
  held at 293 words pending source lineage, rights, and substantive expansion.
- Both reviewed draft and preview SHA-256 values match the Step 22 manifest.
- Exact block-to-citation pairs, approved metrics, HICP chart invariants, private directives,
  accessible chart metadata, and equivalent tables passed.
- Three editorial Vitest files passed: 23 tests.

## Gates still closed

Live asset identity, asset-level reuse rights, and release-time freshness have not been resolved.
Responsive browser and assistive-technology QA were not performed because the private local files
do not have a permitted browser surface; no local server or public route was created as a
workaround. The wildfire brief remains held independently. No production code, route, sitemap,
commit, or deployment changed.

## Next step

**Step 24 — Luna:** create a read-only external-gate resolution inventory for both advanced
Eurostat previews. Map the exact live asset identity, rights evidence, freshness check, and a
permitted browser/assistive-technology QA path required before release. Do not publish, commit, or
deploy.
