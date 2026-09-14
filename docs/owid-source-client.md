# OWID source client

The B2 client in `src/lib/ingest/owid-source-client.ts` fetches the documented
Grapher source documents needed by the first ingestion pass:

- `https://ourworldindata.org/grapher/<slug>.metadata.json`
- `https://ourworldindata.org/grapher/<slug>.config.json`
- every unique `https://api.ourworldindata.org/v1/indicators/<id>.metadata.json`
  URL referenced by the chart metadata

It derives source-hosted canonical, embed, and thumbnail preview URLs without
fetching unbounded chart data. Each result keeps the chart, config, and indicator
responses under `raw`, and exposes a small normalized record for the future D1
importer. Indicator metadata provides the origin and license evidence required by B3.

Safety and reliability are explicit in the client:

- only normalized OWID grapher slugs are accepted;
- request concurrency is bounded (four by default, including endpoint requests);
- each request has a timeout and at most three attempts;
- retries are limited to transient network/HTTP failures with capped exponential backoff;
- every request sends an identifying user agent;
- failures are returned with structured slug, endpoint, code, status, and attempt data;
- no license is inferred in B2; `licenseCode` remains `null` until the B3 rights decision table.

Run a summary fetch with:

```sh
NODE_OPTIONS=--use-openssl-ca SSL_CERT_FILE=/etc/ssl/cert.pem \
  npm run ingest:fetch -- data/seed/owid-first-10.csv
```

Use `--json` when a later importer needs the normalized records and preserved
source JSON. This command does not write to D1.
