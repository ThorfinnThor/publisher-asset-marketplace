# V2-02 Sol pilot selection

**Review date:** 4 October 2026  
**Decision:** three pilots approved for locked briefs, not for publication  
**Production changes:** none

## Selected pilots

| Order | Asset                                | Live state                                                                                                               | Decision                                                                                   |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1     | `years-of-fossil-fuel-reserves-left` | HTTP-rendered page, self-canonical, `index, follow`, CreativeWork schema, commercial/source-hosted embed allowed         | Prepare a locked brief about what the reserves-to-production ratio does and does not mean. |
| 2     | `solar-pv-prices`                    | HTTP-rendered page, self-canonical, `index, follow`, CreativeWork schema, commercial/source-hosted embed allowed         | Prepare a locked brief with currency, inflation, unit, period and source-method context.   |
| 3     | `eurostat-nrg_ind_ren`               | HTTP-rendered page, self-canonical, `noindex, follow`, Dataset schema, commercial and marketplace-rendered embed allowed | Prepare a locked brief, but retain `noindex` until content and technical QA pass.          |

All three live pages expose a visible source, update/check dates, exact citation and reuse panel.
The two OWID assets say raw-data redistribution is unknown; the pilot may discuss and embed the
reviewed chart but must not package or promise redistribution of the underlying raw data.

## Why these three

They are the exact pilot subjects named in the approved V2 plan, their public routes exist, and
they cover three different editorial problems: interpreting a conditional ratio, explaining a
long-run price series, and distinguishing several related percentages. That makes the pilot useful
for validating the future asset-page overlay across OWID and Eurostat without creating new competing
URLs.

The Eurostat asset already supports the public insight “What four EU renewable-energy shares
actually measure.” Its asset-page overlay must therefore serve a narrower reference intent:
definition, observation coverage, provisional status and method. It must not duplicate the article.

## Seven follow-ons

1. `c-004-electricity-access-gap`
2. `c-005-electricity-fuel-mix`
3. `c-006-carbon-emissions-per-capita`
4. `c-007-carbon-intensity`
5. `c-035-freshwater-withdrawals`
6. `c-041-material-footprint`
7. `c-042-data-centres-energy`

These are inventory selections only. Their routes, rights, source contracts and freshness still
need the same live review before briefing.

## Holds and unresolved evidence

- Installed solar capacity is not a substitute for the selected module-price series.
- The OWID and World Bank rural/urban electricity candidates share one intent; only one should move
  forward until their distinct value is demonstrated.
- Wildfire area already has a public insight and is held to avoid overlapping intent.
- `eurostat-sdg_07_40` remains outside the pilot because the prior fact-pack review removed it from
  the approved renewables evidence path.
- Fresh GSC exports remain unavailable. The selection is based on scope, evidence readiness and
  distinct publisher utility, not on an invented demand score.

The machine-readable decision is
[pilot-selection-v2-02-sol.json](../../data/seo/pilot-selection-v2-02-sol.json).

## Next step

Run **V2-03 with Sol**: decide and specify the smallest durable editorial overlay for reviewed
asset-page content. Do not draft the pilot copy or change indexability in V2-03.
