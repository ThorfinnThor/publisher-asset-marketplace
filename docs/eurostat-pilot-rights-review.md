# Eurostat pilot rights review

Status: **historical pilot review; superseded for bulk ingestion by the automated catalogue policy gate**

The three records in this document remain the reference pilot fixtures. Bulk
Eurostat imports now use the repeatable workflow documented in
[`eurostat-catalog-automation.md`](./eurostat-catalog-automation.md), which
keeps the same EU27/2020 selector and marketplace-rendered embed restrictions.

Review owner: **SOL**  
Review date: **2026-09-17**  
Review version: **eurostat-pilot-eu27-v1**

This is an operational rights review for the marketplace release process, not
legal advice. It applies only to the exact queries and presentation rules below.

## Decision

The three pilot datasets are approved for commercial display and reuse in the
marketplace when the connector requests only `geo=EU27_2020`,
`sinceTimePeriod=2020`, and `lang=en`.

Eurostat states that statistical data and metadata published on its website may
be reused for commercial or non-commercial purposes when the source is
acknowledged. The policy implements Commission Decision 2011/833/EU. The
decision permits commercial and non-commercial reuse and permits conditions
requiring source acknowledgement, preservation of the original meaning, and a
non-liability statement.

This permission is not CC BY 4.0. The marketplace must represent it with a
dedicated `EU_COMMISSION_REUSE_2011` rights code rather than converting it to a
Creative Commons licence.

Evidence:

- [Eurostat copyright notice and free reuse policy](https://ec.europa.eu/eurostat/help/copyright-notice)
- [Commission Decision 2011/833/EU](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32011D0833)
- [Eurostat Statistics API guide](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-detailed-guidelines/api-statistics)

## Scope and exclusions

The approval covers only the statistical values, dimension labels, status flags,
dataset title, update timestamp, and dataset link returned by the reviewed API
queries. It does not cover Eurostat logos, trademarks, photographs,
illustrations, publications, page screenshots, or third-party material.

The reviewed query uses only the EU27 aggregate. It therefore does not include
the policy exception for data from countries outside the EU, EFTA, or official
EU candidate-country scope. None of the three datasets is a Comext/Prodcom or
detailed international-trade dataset, so the Switzerland, Liechtenstein, and
Austria trade-data exceptions do not apply to these selections.

Any change to geography, dataset code, policy URL, policy text, ownership
notice, dimension structure, or query parameters invalidates this approval and
returns the asset to `review`.

## Dataset decisions

| Dataset                                                    | Reviewed selection                                 | Decision | Evidence and reason                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tps00001` — Population on 1 January                       | `geo=EU27_2020`, `sinceTimePeriod=2020`, `lang=en` | Approved | Eurostat population statistics for an EU aggregate; not trade data. The related population metadata identifies national statistical offices as source data and Eurostat as the dissemination service, with no contrary item-specific commercial restriction found on 2026-09-17. |
| `nama_10_gdp` — Gross domestic product and main components | `geo=EU27_2020`, `sinceTimePeriod=2020`, `lang=en` | Approved | Eurostat annual national-accounts dataset for the EU aggregate; not Comext or a detailed commodity classification. No contrary item-specific commercial restriction found on 2026-09-17.                                                                                         |
| `une_rt_a` — Unemployment by sex and age, annual data      | `geo=EU27_2020`, `sinceTimePeriod=2020`, `lang=en` | Approved | Eurostat labour-market dataset for the EU aggregate; not trade data. Related LFS metadata identifies Eurostat as the compiling/disseminating agency, with no contrary item-specific commercial restriction found on 2026-09-17.                                                  |

Dataset and metadata evidence:

- [Population metadata](https://ec.europa.eu/eurostat/cache/metadata/EN/demo_pop_esms.htm)
- [GDP dataset product page](https://ec.europa.eu/eurostat/en/web/products-datasets/-/NAMA_10_GDP)
- [LFS main-indicator metadata](https://ec.europa.eu/eurostat/cache/metadata/en/lfsi_esms.htm)
- [Annual unemployment dataset product page](https://ec.europa.eu/eurostat/web/products-datasets/-/UNE_RT_A)

## Required rights representation

For these three reviewed slices, LUNA may set:

| Field                     | Reviewed value                                                |
| ------------------------- | ------------------------------------------------------------- |
| `chart_owner`             | `third_party`                                                 |
| `chart_license_code`      | `EU_COMMISSION_REUSE_2011`                                    |
| `chart_license_raw`       | `Eurostat reuse policy under Commission Decision 2011/833/EU` |
| `chart_license_url`       | Eurostat copyright notice                                     |
| `chart_license_explicit`  | `true`                                                        |
| `manual_review_completed` | `true`                                                        |
| `embed_available`         | `false`                                                       |
| `citation_only_allowed`   | `true`                                                        |
| `chart_reuse_prohibited`  | `false`                                                       |
| `commercial_use`          | `true`                                                        |
| `modification_allowed`    | `true`, subject to clear modification disclosure              |
| `attribution_required`    | `true`                                                        |
| `citation_required`       | `true`                                                        |
| `raw_data_redistribution` | `true` for the reviewed, bounded EU27 selection               |
| `share_alike`             | `false`                                                       |

`embed_available=false` means the marketplace must not offer iframe-copy for
these records. It does not block a citation-only dataset asset whose reviewed
sample is rendered directly by the marketplace.

This field refers to an official source-hosted iframe. A separate SOL review now
permits a tightly controlled marketplace-rendered iframe for the same three data
slices, subject to implementation and release gates. See
[`eurostat-marketplace-embed-rights-review.md`](./eurostat-marketplace-embed-rights-review.md).
Until those gates pass, the public embed action must remain disabled.

## Required public presentation

Publishing is allowed only after the asset page renders the real retained
observations. A generic chart illustration or “preview only” image is not an
acceptable representation of these datasets.

The page must show:

1. a compact table of the retained values and their dimension labels;
2. `Custom EU27 selection from 2020; not the complete Eurostat dataset`;
3. `Source: Eurostat, {dataset title} ({dataset code}), accessed {date}`;
4. when labels, units, order, or values are transformed, a clear description of
   the transformation;
5. `This presentation is not endorsed by Eurostat. Eurostat is not responsible
for this customised presentation.`;
6. a link to the canonical Eurostat Data Browser page and the reuse policy.

The marketplace must not display an Eurostat logo or imply a partnership or
endorsement.

## Refresh and revocation

The refresh adapter must compare the policy fingerprint, query, dataset code,
dimension signature, and source ownership markers. Policy or scope drift sets
the record to `review` and disables publication until a new SOL review. A 404
hides the record. Transient source failures retain the last reviewed record but
update the failed refresh audit.

## Release gate

The LUNA implementation has added the dedicated rights code, encoded this review
as `data/rights/eurostat-pilot-rights-review-v1.json`, and replaced the generic
placeholder preview with the retained observations rendered as a real table. The
GitHub release workflow now performs the live API fetch, imports the three records,
applies this manifest, and publishes only the reviewed records. Production import
remains a release action, not part of the source-code review itself.
