# SEO candidate inventory — V2-02

**Date:** 4 October 2026  
**Workflow role:** Luna (mechanical inventory)  
**Status:** prepared for Sol selection; no candidate is approved for publication

## Scope and evidence boundary

This inventory turns the earlier read-only candidate export into a two-cohort shortlist: 20
energy/environment candidates and 10 reserve candidates. It does not create article URLs or assert
that every derived Cite Supply asset path currently exists. The prior export is the source for the
questions, slugs, source families and duplicate groups. The two pilots named explicitly by the V2
plan—solar module prices and fossil-fuel reserves—are added from the checked OWID seed catalogue.
Each selected candidate still needs a live route, canonical, rights and source-data check in the
next gate.

The local run had no direct production D1 read and no fresh Search Console export. Therefore route
presence, current source counts and GSC demand are explicitly unknown rather than inferred. No D1
write, production mutation, article draft, commit or deployment was performed for this step.

## Energy/environment cohort

| ID    | Working question                                                                     | Source     | Asset slug(s)                                                         | Fit                     | Duplicate group          |
| ----- | ------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------- | ----------------------- | ------------------------ |
| c-044 | How have inflation-adjusted solar module prices changed over the available series?   | OWID       | `solar-pv-prices`                                                     | direct                  | solar-energy             |
| c-003 | How has renewable energy changed across EU sectors?                                  | Eurostat   | `eurostat-nrg_ind_ren`, `eurostat-sdg_07_40`                          | direct                  | renewable-energy         |
| c-004 | How large is the rural–urban electricity-access gap?                                 | World Bank | `worldbank-eg.elc.accs.zs`, `.ru.zs`, `.ur.zs`                        | direct                  | electricity-access       |
| c-005 | How does the electricity mix change by fuel type?                                    | Eurostat   | `eurostat-nrg_cb_pem`                                                 | direct                  | electricity-mix          |
| c-006 | How do per-capita carbon emissions differ across countries?                          | World Bank | `worldbank-en.ghg.co2.pc.ce.ar5`                                      | direct                  | carbon-emissions         |
| c-007 | What does carbon intensity of GDP measure?                                           | World Bank | `worldbank-en.ghg.co2.rt.gdp.pp.kd`                                   | direct                  | carbon-intensity         |
| c-010 | Does electricity access differ between urban and rural populations?                  | OWID       | `access-to-electricity-urban-vs-rural`                                | direct                  | electricity-access       |
| c-011 | How widespread is electricity access in schools?                                     | OWID       | `schools-access-to-electricity`                                       | adjacent infrastructure | education-infrastructure |
| c-045 | What does the reserves-to-production ratio say about remaining fossil-fuel reserves? | OWID       | `years-of-fossil-fuel-reserves-left`                                  | direct                  | fossil-reserves          |
| c-027 | How widespread is inadequate housing in urban populations?                           | OWID       | `share-of-urban-population-living-in-inadequate-housing`              | adjacent                | housing                  |
| c-028 | How has the share of people living in urban slums changed?                           | OWID       | `share-of-urban-population-living-in-slums`                           | adjacent                | housing                  |
| c-030 | What does the EU monthly construction index show?                                    | Eurostat   | `eurostat-ei_isbu_m`                                                  | adjacent infrastructure | construction             |
| c-035 | How large are freshwater withdrawals relative to resources?                          | OWID       | `freshwater-withdrawals-as-a-share-of-internal-resources`             | direct                  | water                    |
| c-036 | How does the World Bank freshwater indicator vary?                                   | World Bank | `worldbank-er.h2o.fwtl.zs`                                            | direct                  | water                    |
| c-037 | How has wildfire area changed by land-cover type?                                    | OWID       | `area-burned-wildfires-by-type`                                       | direct                  | wildfires                |
| c-038 | Where is forest area changing fastest?                                               | OWID       | `forest-area-net-change-rate`                                         | direct                  | forests                  |
| c-039 | Which EU locations report excellent bathing-water quality?                           | Eurostat   | `eurostat-sdg_14_40`                                                  | direct                  | water-quality            |
| c-040 | How important is agriculture in national ammonia emissions?                          | Eurostat   | `eurostat-sdg_02_60`                                                  | direct                  | agriculture-emissions    |
| c-041 | How does material footprint change per person and per GDP?                           | OWID       | `material-footprint-per-capita`, `material-footprint-per-unit-of-gdp` | direct                  | material-footprint       |
| c-042 | How much electricity demand is associated with data centres?                         | OWID       | `data-centers-share-electricity-demand`                               | direct                  | data-centres             |

The cohort contains 16 direct-fit ideas and four adjacent ideas. Sol should remove adjacent ideas
if the energy hub cannot give them a distinct user question and internal-link context.

## Reserve cohort

| ID    | Working question                                                                   | Source     | Asset slug(s)                                    | Fit        | Duplicate group  |
| ----- | ---------------------------------------------------------------------------------- | ---------- | ------------------------------------------------ | ---------- | ---------------- |
| c-001 | How has internet use changed across countries, and where is coverage still uneven? | OWID       | `share-of-individuals-using-the-internet`        | technology | digital-access   |
| c-008 | Which countries experienced the largest changes in annual GDP growth?              | OWID       | `annual-gdp-growth`                              | economy    | economic-growth  |
| c-009 | How has import growth varied across countries and time?                            | OWID       | `annual-growth-of-imports-of-goods-and-services` | economy    | trade-growth     |
| c-012 | What relationship appears between fertility and female labour participation?       | OWID       | `fertility-and-female-labor-force-participation` | society    | fertility-labour |
| c-013 | How has total fertility changed across countries?                                  | World Bank | `worldbank-sp.dyn.tfrt.in`                       | society    | fertility        |
| c-014 | How does total fertility vary across EU countries?                                 | Eurostat   | `eurostat-tps00199`                              | society    | fertility        |
| c-015 | How large is the female–male life-expectancy gap?                                  | World Bank | `worldbank-sp.dyn.le00.fe.in`, `.ma.in`          | health     | life-expectancy  |
| c-016 | What does Eurostat life expectancy at birth measure?                               | Eurostat   | `eurostat-tps00208`                              | health     | life-expectancy  |
| c-017 | How does unemployment differ by sex across EU countries?                           | Eurostat   | `eurostat-teilm010`                              | work       | labour-market    |
| c-018 | Where is youth unemployment highest, and what does the measure include?            | Eurostat   | `eurostat-teilm011`                              | work       | labour-market    |

## Required Sol gate

Sol must select three pilots only after checking the live Cite Supply route and canonical, rights
evidence, source freshness/schema, internal-link fit and duplicate groups. Every numerical article
claim must use a pinned source-specific fetch; marketplace preview samples are not sufficient. The
missing GSC export remains a demand-scoring blocker, not a reason to invent a priority score.

The machine-readable record is [candidate-inventory-v2-02.json](../../data/seo/candidate-inventory-v2-02.json).
The original questions and source-request URLs remain in
[`data/editorial/article-candidates.json`](../../data/editorial/article-candidates.json).
