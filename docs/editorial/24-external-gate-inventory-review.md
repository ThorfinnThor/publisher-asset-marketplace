# Step 25 — independent external-gate inventory review

**Date:** 2026-09-25  
**Workflow role:** Sol  
**Decision record:** `data/editorial/private-eurostat-external-gate-review-decisions.json`  
**Publication effect:** none.

## Decision

The Step 24 inventory needs a focused revision before the external gates can be executed. Most of
its official HTTPS sources are reachable, and both Cite Supply asset pages load in a real browser.
However, four requirements are not yet reproducible from the paths recorded in the inventory.
Treating the gates as ready would overstate what those pages prove.

## Verified paths

The live routes for `eurostat-nrg_ind_ren` and `eurostat-tec00118` display the expected Eurostat
dataset codes, published asset content, reviewed observations, marketplace-rendered embed action,
and the declared usage-rights fields. The current pages show source-hosted embedding as not
allowed, marketplace-rendered embedding as allowed, commercial use and modification as allowed,
and attribution and citation as required.

The official Eurostat dataset pages, renewable-energy metadata, HICP metadata, transport and
heating/cooling reporting notes, and [reuse notice](https://ec.europa.eu/eurostat/help/copyright-notice)
are reachable over HTTPS. The reuse notice authorises commercial and non-commercial reuse of
statistical data subject to attribution, identifies exceptions, and requires modified data or text
to be identified with a Eurostat non-responsibility disclaimer. The HICP classification-mapping
PDF also loads at its direct HTTPS URL in the browser, although the generic web reader did not
parse it.

## Required corrections

### Persistent identity is not resolved

The asset pages prove that the expected slugs currently resolve to the expected datasets, but they
do not expose the persistent database asset ID demanded by the inventory. Step 26 must add an exact
read-only production lookup or authenticated API response that maps each slug to one persistent ID
and its published status. Zero rows, duplicate rows, or a non-published state must block release.

### The rights evidence chain is incomplete

On both asset pages, “View rights evidence” currently points to the Eurostat dataset page. The
rights declarations rely on the separate Eurostat reuse notice. The revised inventory must require
and record both: the live asset rights panel plus the applicable source reuse policy. It must fail
closed when the asset does not expose or explicitly pair that policy with the declaration.

### Freshness queries are not reproducible yet

The inventory says to fetch the complete scoped Eurostat response but does not record the exact
parameterised API URL, allowed dimensions, excluded or provisional periods, status-flag policy,
or comparison procedure. Step 26 must add those values for `nrg_ind_ren` and `tec00118`; a reviewer
must be able to repeat the request without reconstructing it from prose or earlier files.

### The proposed browser route tests the wrong artifact

The production asset pages are suitable for checking the live asset and its rights panel, but they
do not render either editorial article. Responsive and assistive-technology QA therefore needs an
approved, access-controlled HTTPS preview of the exact article artifact. That preview must be
bound to the reviewed draft and rendered-preview hashes, remain non-indexable, and fail if the
served content differs. A public article route or local server is not an acceptable workaround.

## Scope and checks

This review used read-only browser navigation. It did not copy embeds, submit forms, change assets,
create a preview route, or perform the external gates themselves. The existing drafts and private
previews remain unchanged. No production code, database state, sitemap, commit, or deployment was
changed.

## Next step

**Step 26 — Luna:** revise the inventory with the exact read-only asset-identity resolution,
separate rights-policy evidence, fully parameterised Eurostat API requests, and a non-indexable
private HTTPS article-preview contract. Keep release blocked and do not commit or deploy.
