# OWID seed rights evidence review

- Review version: `owid-seed-v1`
- Evidence checked: 2026-09-14T14:20:04.000Z
- Model route: SOL (rights/compliance review)
- Scope: official, source-hosted OWID chart iframe and citation actions
- Result: 10 `safe`, 0 `restricted`, 0 `unknown`, 0 `blocked`
- Raw-data redistribution: 5 enabled, 5 unverified and disabled

This is an evidence-based product classification under the deterministic B3 policy, not legal
advice. It does not transfer ownership and does not grant rights beyond the linked source terms.

## Decision basis

Each row was checked at its individual OWID chart page. The page-specific reuse section or chart
notice identifies the visualization as reusable under CC BY and supplies an official embed. The
same pages expressly keep third-party source data under the original provider's terms. Therefore:

- the source-hosted OWID chart layer is `CC_BY` and `safe` for embed/citation actions;
- attribution and citation remain required;
- the chart decision never grants raw-data redistribution;
- raw-data actions are enabled only when every recorded indicator origin is permissive under B3;
- an unknown/custom, ND, or mixed origin keeps raw-data redistribution `null` and disabled.

`manual_review_completed` remains `false`: the evidence is explicit on each OWID-owned chart, so
the classifier does not rely on the human-review escape hatch reserved for third-party charts.

## Asset-level decisions

| Asset                                       | Chart/embed  | Raw data                   | Evidence                                                                                              |
| ------------------------------------------- | ------------ | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Active mobile money accounts                | safe / CC BY | unverified                 | [OWID chart](https://ourworldindata.org/grapher/active-mobile-money-accounts)                         |
| Annual professional service robots          | safe / CC BY | unverified (ND origin)     | [OWID chart](https://ourworldindata.org/grapher/annual-professional-service-robots-installed-by-area) |
| Cost of sequencing a human genome           | safe / CC BY | enabled                    | [OWID chart](https://ourworldindata.org/grapher/cost-of-sequencing-a-full-human-genome)               |
| Historical computer memory and storage cost | safe / CC BY | unverified (mixed origins) | [OWID chart](https://ourworldindata.org/grapher/historical-cost-of-computer-memory-and-storage)       |
| ICT adoption                                | safe / CC BY | enabled                    | [OWID chart](https://ourworldindata.org/grapher/ict-adoption)                                         |
| ICT adoption per 100 people                 | safe / CC BY | enabled                    | [OWID chart](https://ourworldindata.org/grapher/ict-adoption-per-100-people)                          |
| Share using the Internet                    | safe / CC BY | enabled                    | [OWID chart](https://ourworldindata.org/grapher/share-of-individuals-using-the-internet)              |
| Solar PV prices                             | safe / CC BY | unverified (mixed origins) | [OWID chart](https://ourworldindata.org/grapher/solar-pv-prices)                                      |
| Transistors per microprocessor              | safe / CC BY | enabled                    | [OWID chart](https://ourworldindata.org/grapher/transistors-per-microprocessor)                       |
| Objects launched into outer space           | safe / CC BY | unverified                 | [OWID chart](https://ourworldindata.org/grapher/yearly-number-of-objects-launched-into-outer-space)   |

The machine-readable source of truth is
[`data/rights/owid-seed-rights-review-v1.json`](../data/rights/owid-seed-rights-review-v1.json).
The general [OWID reuse FAQ](https://ourworldindata.org/faqs) is corroborating context only and
does not replace the asset-specific URLs above.

## Fail-closed controls

The review runner rejects the entire plan before writing when:

- a reviewed slug is absent from D1;
- the stored canonical URL differs from the reviewed URL;
- metadata or indicator evidence is missing/malformed;
- the deterministic classifier disagrees with an expected chart or raw-data result;
- an asset is hidden.

No write occurs without `--apply`. Publication additionally requires `--publish`, and that option
can publish only `safe` or `restricted` classifier decisions. Review history uses stable IDs and
`INSERT OR IGNORE`, so replaying the same review version is idempotent.

## Reproduce

Preview the local D1 decision without writing:

```bash
npm run rights:review -- --local
```

Preview the exact publication plan without writing:

```bash
npm run rights:review -- --local --publish --sql-out /tmp/owid-rights-review.sql
```

The production write is a separate Luna implementation step:

```bash
npm run rights:review -- --remote --apply --publish
```
