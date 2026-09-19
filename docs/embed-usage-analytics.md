# Embed usage analytics

Status: implemented

Cite Supply distinguishes embed intent from actual iframe use.

## Signals

- **Embed copy** remains an intent event recorded when a publisher copies reviewed markup.
- **Embed load** is recorded only when the browser requests an approved embed with
  `Sec-Fetch-Dest: iframe`.
- **Publisher sites** counts distinct referring origins in the selected window. Referrers are
  normalized to their origin and SHA-256 hashed before storage; Cite Supply does not store the
  referring article URL in D1 or Analytics Engine.
- Loads with a missing or suppressed referrer still count as embed loads, but they do not increase
  the publisher-site count.

## Delivery paths

Marketplace-rendered World Bank and Eurostat charts continue to load directly from
`/embed/<slug>`. The Worker records the successful iframe request after the application response
is known to be valid.

Source-hosted and creator-hosted embeds use `https://citesupply.com/e/<slug>`. The Worker resolves
the slug against the published, rights-approved asset record, records the load, and returns a
temporary redirect to the reviewed `embed_url`. The redirect never accepts a destination from the
request, so it cannot be used as an arbitrary open redirect.

## Storage

Workers Analytics Engine receives one non-blocking data point per counted iframe load:

- `blob1`: asset slug
- `blob2`: hashed publisher origin or `unknown`
- `blob3`: embed provenance
- `double1`: load count (`1`)
- `index1`: stable hash of the asset slug

D1 stores compact daily aggregates in `embed_usage_daily` and one row per
asset/publisher/day in `embed_publisher_daily`. This keeps raw request events out of D1 while
allowing creator dashboards to show exact load totals and distinct publisher-site counts for the
current rolling 28-day window, including the current UTC day.

Analytics Engine retains raw data for three months. D1 daily aggregates are the durable product
metric.

## Privacy and interpretation

The browser's referrer policy may suppress the publisher origin. Therefore publisher-site counts
are a lower bound. Embed-load counts measure successful iframe requests to Cite Supply's approved
delivery paths; they should not be described as unique readers, unique people, citations, or
backlinks.
