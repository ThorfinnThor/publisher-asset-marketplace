# Step 24 — external-gate resolution inventory

**Date:** 2026-09-25  
**Workflow role:** Luna  
**Decision record:** `data/editorial/private-eurostat-external-gate-inventory.json`  
**Publication effect:** none. This is a read-only planning and evidence map.

## Result

The two Eurostat previews are editorially ready to enter external checks, but neither is
publishable yet. Both fact packs still have `asset_id: null` and
`asset_id_resolution: public_route_only`. A canonical URL written in a draft is not evidence that
the exact live record still exists, is published, or contains the metrics used by the article.

The current rights fields are also candidate evidence from the inventory. They are not a current
grant. Before release, the exact live asset rights panel and the linked Eurostat reuse notice must
be read again. The official source pages are retained in the inventory so the check can be
reproduced over HTTPS.

## Required gates

### 1. Resolve the exact live asset

For `eurostat-nrg_ind_ren`, resolve the published asset behind
`https://citesupply.com/asset/eurostat-nrg_ind_ren`. For `eurostat-tec00118`, do the same for
`https://citesupply.com/asset/eurostat-tec00118`. Record the persistent live identifier, published
status, canonical URL, source dataset, and check time. The source dataset must match the pinned
metric IDs: `nrg_ind_ren` with the four approved `nrg_bal` values for the renewables article, and
`tec00118`/`PRC_HICP_AINR` with EU27_2020, annual-average rate, TOTAL for HICP.

If a route is missing, duplicated, pending, deleted, or points to another dataset, stop. Do not
silently substitute a similarly named asset.

### 2. Reconfirm asset-level rights

Read the live asset rights panel and record commercial use, modification, marketplace-rendered
embed, citation, and raw-data redistribution separately. Re-open the linked [Eurostat reuse
notice](https://ec.europa.eu/eurostat/help/copyright-notice) and retain its current response
status and checksum. The article may only be released when the current rights cover the proposed
modified chart/article presentation and the required attribution remains visible.

### 3. Recheck source freshness and dimensions

Fetch the complete scoped official Eurostat response again; do not calculate from Cite Supply's
bounded presentation sample. Record the response checksum, retrieval time, source update time,
dimensions, status flags, and latest period. Compare those values with the pinned metric IDs and
the article's stated period. For HICP, explicitly verify the annual-average unit, EU27_2020,
TOTAL classification, and the current latest year against [Eurostat's HICP
metadata](https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm). Any changed value,
classification, status flag, or methodology requires a new editorial review.

For the renewables article, the reporting-year interpretation must remain consistent with
Eurostat's [2024 transport note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260121-1)
and [2024 heating-and-cooling note](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260126-1).

### 4. Perform permitted browser and accessibility QA

The private HTML files cannot be treated as browser QA evidence. After the live asset is resolved,
use an approved HTTPS production or staging URL with the browser-verification workflow. Test
390×844, 768×1024, 1280×800, and 1440×900. Verify the chart and equivalent table communicate the
same values, intentional table scrolling is usable, there is no accidental page overflow, labels
remain legible, focus order is logical, keyboard activation works, headings are ordered, SVG
names/descriptions are announced, and source links are understandable. Save the URL, viewport,
screenshots, console errors, and failed requests. If no permitted HTTPS URL exists, this gate
remains open; do not start a local server as a workaround.

## Current status by preview

| Preview                    | Live identity                | Rights                           | Freshness | Browser/AT | Release |
| -------------------------- | ---------------------------- | -------------------------------- | --------- | ---------- | ------- |
| EU renewable-energy shares | Not run; asset ID unresolved | Not run; candidate evidence only | Not run   | Not run    | Blocked |
| EU annual HICP rate        | Not run; asset ID unresolved | Not run; candidate evidence only | Not run   | Not run    | Blocked |

The complete machine-readable mapping, URLs, fail-closed conditions, and hashes are in the
[decision record](../data/editorial/private-eurostat-external-gate-inventory.json).

## Validation and scope

This step does not alter drafts, metrics, rights, routes, sitemap entries, or production data. It
only records the evidence required for the next reviews. No browser or assistive-technology test
was claimed, because a permitted HTTPS preview surface is not currently available.

## Next step

**Step 25 — Sol:** independently review this inventory for completeness, confirm that every gate
has a reproducible HTTPS evidence path, and identify any missing fail-closed condition. Keep both
articles private and do not commit or deploy.
