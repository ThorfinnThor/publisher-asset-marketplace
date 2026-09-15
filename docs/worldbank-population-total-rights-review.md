# World Bank population indicator rights review

- Review version: `worldbank-population-total-v1`
- Evidence checked: 2026-09-15T10:17:50.000Z
- Model route: SOL (rights/compliance review)
- Indicator: `SP.POP.TOTL` — Population, total
- Result: `safe` for citation/source-link use after manual review
- Embed: unavailable and disabled
- Raw-data redistribution: unverified and disabled

This is an evidence-based product classification under the marketplace rights
policy, not legal advice. It grants no rights beyond the linked source terms.

## Evidence and decision

The asset-specific [World Bank indicator page](https://data.worldbank.org/indicator/SP.POP.TOTL)
labels the record `CC BY-4.0` and identifies the UN Population Division,
National Statistical Offices, Eurostat, and the UN Statistics Division as
original sources. The [World Bank summary terms](https://data.worldbank.org/summary-terms-of-use)
require attribution, prohibit implying endorsement, and warn that original
provider terms may apply.

The approved marketplace capability is therefore deliberately narrower than
the page-level license:

- publishers may copy the reviewed citation and follow the source link;
- commercial-use status reflects the explicit item-level CC BY label;
- no iframe or embed action is exposed;
- no raw dataset is redistributed or offered for download;
- the exact original-provider attribution is retained in the citation;
- the marketplace must not present World Bank or any provider as a partner.

The machine-readable decision is
[`data/rights/worldbank-population-total-v1.json`](../data/rights/worldbank-population-total-v1.json).

## Reproduce

Import the record as an unpublished draft:

```sh
npm run ingest:worldbank -- SP.POP.TOTL --apply --remote
```

Preview the rights decision without writing:

```sh
npm run rights:review -- --remote --source source_worldbank \
  --manifest data/rights/worldbank-population-total-v1.json --publish
```

Apply and publish only after the preview matches this document:

```sh
npm run rights:review -- --remote --source source_worldbank \
  --manifest data/rights/worldbank-population-total-v1.json --apply --publish
```
