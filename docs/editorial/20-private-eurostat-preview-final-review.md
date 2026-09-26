# Step 21 — independent review of revised Eurostat previews

**Date:** 2026-09-25  
**Workflow role:** Sol  
**Decision record:** `data/editorial/private-eurostat-preview-final-review-decisions.json`  
**Publication effect:** none.

## Outcome

The revised HICP draft passes editorial logic review. Its eight plotted values remain inside the
declared chart domain, and the visual now has y-axis ticks, point markers, direct values, year
labels, an accessible description, and an equivalent table. Eurostat's
[HICP metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm) says ECOICOP
version 2 applies to the full series from the January 2026 publication, while Eurostat's
[dataset-mapping note](https://ec.europa.eu/eurostat/databrowser-backend/api/public/explanatory-notes/get/Info_note_HICP_COICOP18_20260128.pdf)
maps the annual ECOICOP version-2 table to `prc_hicp_ainr`. The HICP article remains blocked from
release by the unresolved live asset, rights, freshness, browser, and assistive-technology gates.

The renewables draft still needs one focused revision. Eurostat's
[2024 transport note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1)
defines transport as energy used in all transport activities and names renewable inputs including
qualifying biofuels, biomethane, and part of renewable electricity used mostly in road and rail.
That page does not establish the draft paragraph's specific road-and-rail denominator or its
multiplier claim. The paragraph must either be narrowed to what the page explicitly supports or
receive a directly adjacent, reporting-year-applicable official methodology source. The separate
[2024 heating-and-cooling note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1)
does support the renewable-source examples and the rule against counting renewable electricity
used by heat pumps twice.

## Checker review

The HICP chart-domain, marker, value-label, metric-binding, hash, private-directive, H1, SVG-name,
and equivalent-table checks are meaningful and pass. The required-citation check is weaker than
its error name implies: it tests whether the URL occurs anywhere in the generated HTML. Because
every citation is also listed in the final sources section, that does not prove that a source link
is adjacent to the intended block. The next revision should emit block and citation identifiers
into the rendered markup and verify the exact block-to-source pairing.

## Repeated validation

- Draft validation passed; every draft remains private and non-indexable.
- The depth check reports Internet 701 words, renewables 591, HICP 715, and wildfire held at 293.
- Both private preview hashes and the pinned analysis SHA-256 match their manifests.
- Three editorial Vitest files passed: 23 tests.
- Static preview checks passed, but they do not replace browser or assistive-technology review.

## Gates still closed

No browser visual or assistive-technology QA was claimed because the private local HTML files do
not have a permitted browser URL. The review did not start a local server or create a public route
as a workaround. Live asset identity, freshness, and asset-level rights remain unresolved. No
production code, route, sitemap, commit, or deployment changed.

## Next step

**Step 22 — Luna:** narrow or properly source the transport-method paragraph, emit explicit block
and citation identifiers in the preview HTML, make the checker validate the exact adjacency pair,
regenerate the private renewables preview, and rerun the redaction-safe static and editorial test
suite. Keep all release gates closed.
