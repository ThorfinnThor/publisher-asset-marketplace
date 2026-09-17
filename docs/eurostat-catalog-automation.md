# Eurostat catalogue automation

The marketplace can import a bounded batch of Eurostat statistical tables from
the official English table-of-contents API and publish at least 1,000 records
when that many candidates pass the gates.

## Automated gates

The workflow considers catalogue entries of type `table` or `dataset`. It excludes
catalogue categories that may contain third-party material or separate reuse
conditions, including Comext, Prodcom, microdata, confidential material, logos,
trademarks, photographs and images. Each candidate is then fetched through the
Statistics API with `lang=en`, `geo=EU27_2020` and `sinceTimePeriod=2020`.

The importer rejects responses that do not expose the EU27 aggregate and time
dimension, contain observations before 2020, return malformed JSON-stat data,
or exceed the bounded response size. It retains only a small reviewed sample
for the marketplace table, plus the source metadata and citation.

The rights manifest records an `automated_review_completed` decision and its
version. That is deliberately separate from `manual_review_completed`: it is a
repeatable policy screen based on Eurostat's published reuse notice, not a
human legal opinion. Individual Eurostat notices remain authoritative. The
marketplace-rendered iframe is a customised presentation and is never labelled
as an official Eurostat embed.

## Run manually

The GitHub Actions workflow **Import and publish reviewed Eurostat catalogue**
defaults to a target of 1,000 published records. It fetches in batches,
upserts idempotently into D1, generates a rights manifest, applies that
manifest, publishes only `safe` decisions, and samples live embed routes with
the same CSP and citation checks used by the release smoke test.

The target and candidate ceiling are workflow inputs so a smaller dry run can
be used before a larger production batch. Re-running the workflow is safe: the
asset slug and canonical URL remain stable and the import uses idempotent
upserts.

## Official sources

- [Eurostat table-of-contents catalogue API](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/catalogue-api)
- [Eurostat Statistics API](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api)
- [Eurostat copyright notice and reuse policy](https://ec.europa.eu/eurostat/help/copyright-notice)
