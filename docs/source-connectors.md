# F3 source connector contract

Status: **World Bank F4 implemented; Eurostat F3 approved; no Eurostat production records onboarded**

Design owner: **SOL**  
Implementation owner: **LUNA (F4)**

This document defines the contract for adding a second public source without
weakening the existing rights, attribution, freshness, or import boundaries.
The first candidate is **World Bank Open Data**. It is a source candidate, not
a partnership or endorsement.

## Source candidate: World Bank Open Data

| Field                | Contract decision                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registry key         | `worldbank`                                                                                                                                            |
| D1 source id         | `source_worldbank`                                                                                                                                     |
| Display name         | `World Bank Open Data`                                                                                                                                 |
| Base URL             | `https://data.worldbank.org`                                                                                                                           |
| Policy evidence      | [World Bank summary terms](https://data.worldbank.org/summary-terms-of-use) and [dataset licensing](https://datacatalog.worldbank.org/public-licenses) |
| Candidate API        | `https://api.worldbank.org/v2/country/all/indicator/{indicator}?format=json`                                                                           |
| Candidate asset type | `dataset` or `table`; do not label an indicator as a chart unless a source-hosted chart URL and rights evidence are both present                       |

The World Bank terms describe API access and a default CC BY 4.0 path for data
unless an indicator or dataset says otherwise. They also require attribution,
prohibit implying endorsement, and warn that third-party data may have extra
restrictions. The connector therefore never converts a domain-level policy into
an automatic `safe` classification.

## What may be indexed

An item is indexable only when all of the following are available from the
source metadata or API response:

- a stable indicator code and a human-readable title;
- a source-hosted metadata or indicator page;
- an explicit update or observation date, when the source supplies one;
- the original provider/source attribution;
- a machine-readable license or a clearly linked policy statement;
- a bounded response that can be parsed without downloading an unbounded series;
- no flag indicating restricted, confidential, microdata, or third-party-only
  reuse.

The initial F4 parser must reject records with missing IDs, missing titles,
malformed JSON, non-HTTPS source URLs, or ambiguous rights. It must retain the
raw metadata needed for a later audit and create a `draft` asset until the
rights review has completed.

## Preview, embed, and reuse boundaries

| Capability              | World Bank F4 default                             | Reason                                                                |
| ----------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Search/index metadata   | Yes, after validation                             | Metadata and indicator pages are source-hosted and attributable       |
| Preview                 | Interface placeholder only (`preview_url = null`) | Do not copy or re-host source visuals by default                      |
| Embed                   | No by default (`embed_url = null`)                | An iframe/export URL must be explicitly documented and tested first   |
| Commercial reuse        | Only when the item’s metadata permits it          | CC BY 4.0 is not a substitute for item-level evidence                 |
| Raw-data redistribution | No by default                                     | Third-party indicators and microdata may have additional restrictions |
| Citation copy           | Yes when the source/provider citation is present  | Preserve the exact attribution text and policy URL                    |

The marketplace must not show “Commercial use” or “Safe to reuse” from a
source-level default. The existing per-field rights badge rules continue to
apply. An item with no explicit commercial-use evidence remains `unknown` or
`restricted` and is not publicly publishable.

## Stable identifiers and URLs

The indicator code is the preferred `external_id` (for example,
`SP.POP.TOTL`). The parser must validate that the code contains only the
documented identifier characters before interpolating it into a URL. The
canonical URL is the source-hosted indicator page, and the normalized canonical
URL is used for the existing unique asset constraint.

The API URL is an evidence/fetch URL, not the canonical public URL. Query
parameters must be normalized before persistence. The parser must not invent a
stable embed URL; a missing embed capability is represented as `null`.

## Refresh and reliability contract

F4 must use the same operational envelope as the OWID connector:

- HTTPS allow-list for `api.worldbank.org` and `data.worldbank.org` only;
- bounded concurrency (four requests maximum by default);
- request timeout and at most three attempts;
- retries only for network errors, timeouts, 408, 425, 429, and transient 5xx;
- capped exponential backoff and an identifying user agent;
- pagination/series limits so one indicator cannot create an unbounded job;
- structured failures containing source key, external ID, endpoint, status, and
  attempts;
- explicit 404 handling for hiding a removed source record; transient failures
  must leave the previous asset visible.

The refresh runner must preserve a manual rights decision when metadata is
refreshed. A changed license, provider, canonical URL, or restriction flag
creates a review-needed result instead of silently upgrading rights.

## Common-pipeline mapping

The adapter must produce the existing `ImportAssetRecord` shape (or the
explicitly widened nullable `embed_url` shape in F4):

| Common field                           | World Bank mapping                                       |
| -------------------------------------- | -------------------------------------------------------- |
| `source_id`                            | `source_worldbank`                                       |
| `external_id`                          | Indicator code                                           |
| `slug`                                 | `worldbank-{normalized indicator code}`                  |
| `asset_type`                           | `dataset` or `table`                                     |
| `title` / `description`                | Indicator metadata, bounded and plain text               |
| `canonical_url`                        | Source-hosted indicator page                             |
| `embed_url`                            | `null` until an official, tested embed contract exists   |
| `preview_url`                          | `null` until a documented source-hosted image exists     |
| `citation_text`                        | Provider/source citation from metadata                   |
| `attribution_name` / `attribution_url` | Original provider and source metadata                    |
| `source_updated_at`                    | Latest source update/observation timestamp when valid    |
| `license_code`                         | Only an explicitly recognized item-level license         |
| `rights_json`                          | Raw policy/metadata evidence plus derived classification |
| `metadata_json`                        | Preserved bounded API and metadata responses             |
| `status`                               | `draft` until the rights audit allows publication        |

The parser must reuse the existing idempotent import, refresh, search-index,
and audit paths. It must not add a second persistence model or bypass the
`sources` registry.

## F4 acceptance gates

LUNA may implement the connector only after these checks are encoded in tests:

1. valid indicator fixture maps deterministically to the common record;
2. malformed, restricted, third-party-only, and missing-license fixtures fail
   closed;
3. URL allow-list and identifier validation reject SSRF-shaped input;
4. pagination and retry limits are enforced;
5. duplicate imports remain idempotent;
6. no item is published without the existing rights audit and attribution
   invariants;
7. the production smoke suite confirms that a non-embeddable World Bank item
   cannot expose an embed-copy action.

No production World Bank records should be imported until the F4 tests pass and
the source policy evidence has been rechecked against the live item metadata.

## F4 implementation

The parser is implemented in:

- `src/lib/ingest/worldbank-source-client.ts` — allow-listed API client with
  bounded rows, retries, timeout, concurrency, structured failures, and raw
  evidence preservation;
- `src/lib/ingest/worldbank-import-runner.ts` — mapping into the common
  idempotent D1 import pipeline;
- `src/lib/ingest/worldbank-refresh-runner.ts` — annual staleness selection,
  rights-preserving refresh, 404 hiding, and policy-drift review fallback;
- `scripts/import-worldbank.ts` — explicit dry-run/SQL/apply entry point;
- `migrations/0013_worldbank_source.sql` — source registry row only.

Run a dry run for one or more indicator codes:

```sh
npm run ingest:worldbank -- SP.POP.TOTL
```

Applying data remains explicit and should only happen after item-level rights
review:

```sh
npm run ingest:worldbank -- SP.POP.TOTL --apply --remote
```

The parser currently imports records as `draft`, uses `embed_url = null`, and
keeps rights `unknown` until the evidence is manually reviewed. The F4 fixture
suite covers the acceptance gates above; no production World Bank records have
been imported by this change.

The first item-level citation-only review is documented in
[`docs/worldbank-population-total-rights-review.md`](worldbank-population-total-rights-review.md).
It does not authorize an embed or raw-data redistribution.

## Source candidate: Eurostat

This section is the SOL-owned F3 contract for the next connector. Parser and
fixture implementation belong to LUNA under F4. Eurostat is an official data
source candidate, not a partnership or endorsement.

| Field                | Contract decision                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry key         | `eurostat`                                                                                                                                                                |
| D1 source id         | `source_eurostat`                                                                                                                                                         |
| Display name         | `Eurostat`                                                                                                                                                                |
| Base URL             | `https://ec.europa.eu/eurostat`                                                                                                                                           |
| Policy evidence      | [Eurostat copyright notice and free re-use policy](https://ec.europa.eu/eurostat/help/copyright-notice)                                                                   |
| Candidate API        | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{datasetCode}`                                                                                       |
| API documentation    | [Eurostat dissemination API guide](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started)                                        |
| Candidate asset type | `dataset`; do not label a Data Browser table as a chart or create an embed URL unless Eurostat documents a stable iframe contract and the marketplace sandbox test passes |
| Initial pilot        | `tps00001`, `nama_10_gdp`, and `une_rt_a`, subject to the item-level checks below                                                                                         |

Eurostat authorizes commercial and non-commercial reuse of its statistical
data and metadata when the source is acknowledged, but its policy has material
exceptions. Third-party material, some data for countries outside the EU,
EFTA, and candidate-country scope, and specified detailed trade data are not
covered by the general commercial-reuse permission. Individual notices may
also override the general rule. The connector must therefore treat the policy
as evidence to review, not as an unconditional dataset-level CC BY grant.

### What may be indexed

F4 may fetch only dataset codes present in a reviewed seed manifest. A dataset
is eligible for a draft record when all of these conditions hold:

- the dataset code matches `^[a-z0-9][a-z0-9_]{1,63}$` and appears in the
  reviewed manifest;
- the response is a JSON-stat `dataset` with a non-empty title, dimensions,
  update timestamp, and at least one observation;
- the canonical URL remains on `ec.europa.eu/eurostat/databrowser` and the API
  URL remains on `ec.europa.eu/eurostat/api/dissemination`;
- the reviewed query is restricted to EU, EFTA, or official candidate-country
  geography when commercial reuse is intended;
- neither the dataset metadata nor the review manifest identifies a third-party
  owner, restrictive notice, confidential/microdata content, or a trade-data
  exception;
- the response and the persisted sample stay within the bounds below.

The connector must reject arbitrary URLs, `DS-`/Comext/Prodcom identifiers,
unreviewed query parameters, malformed JSON-stat shapes, empty datasets, and
responses that exceed the byte or observation limit. Rejected items create a
structured import failure and no asset record.

### Preview, embed, and reuse boundaries

| Capability              | Eurostat F4 default              | Reason                                                                                                   |
| ----------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Search/index metadata   | Yes, as a draft after validation | Dataset code, title, update time, and canonical Data Browser URL are stable evidence                     |
| Preview                 | `null`                           | Do not screenshot, copy, or re-host a Eurostat visualization by default                                  |
| Embed                   | `null`                           | The Statistics API is a data endpoint, not a documented iframe contract                                  |
| Commercial reuse        | `null` until item review         | Source-level permission has third-party, geography, trade, and individual-notice exceptions              |
| Raw-data redistribution | `null` until item review         | The connector stores only a bounded audit sample; public redistribution needs dataset-level confirmation |
| Citation copy           | Yes after validation             | Use Eurostat, the dataset title/code, canonical URL, and access date                                     |
| Initial publication     | No; import as `draft`            | Dataset discovery must not bypass the existing rights audit                                              |

The initial parser records `CUSTOM_OR_UNKNOWN` rather than converting the
general Eurostat policy to `CC_BY`. A later item review may confirm commercial
reuse for a specific reviewed query while retaining attribution and
modification-disclosure requirements.

### Stable identifiers, queries, and bounded responses

The lowercase Eurostat dataset code is the `external_id`. The canonical public
URL is:

```text
https://ec.europa.eu/eurostat/databrowser/view/{datasetCode}/default/table?lang=en
```

The API query is evidence, not the canonical URL. The pilot manifest supplies
an explicit, normalized selector per dataset. The first manifest uses
`lang=en`, `geo=EU27_2020`, and `sinceTimePeriod=2020`; F4 must not accept
caller-controlled parameter names or values. A manifest entry can add a
dataset-specific selector only after review.

Operational limits:

- HTTPS allow-list for `ec.europa.eu` with the exact API and Data Browser path
  prefixes above;
- maximum compressed or decoded response size: 512 KiB;
- maximum persisted observations: 50, selected deterministically from the
  response while retaining dimension labels and status flags;
- request timeout: 10 seconds;
- at most three attempts, retrying only network errors, timeouts, 408, 425,
  429, and transient 5xx responses;
- capped exponential backoff and maximum concurrency of three requests;
- bounded streaming read before JSON parsing; never call `response.json()` on
  an unbounded body;
- structured logs and failures containing source key, dataset code, endpoint,
  HTTP status, attempt count, and reason code.

The full JSON-stat response must not be copied into D1. Persist only the title,
update timestamp, ordered dimension IDs, dimension labels/codes needed to
interpret the retained sample, observation count, up to 50 sample values, the
normalized query, and a policy fingerprint.

### Common-pipeline mapping

| Common field                           | Eurostat mapping                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `source_id`                            | `source_eurostat`                                                                |
| `external_id`                          | Lowercase dataset code                                                           |
| `slug`                                 | `eurostat-{datasetCode}`                                                         |
| `asset_type`                           | `dataset`                                                                        |
| `title`                                | JSON-stat top-level `label`                                                      |
| `description`                          | `Eurostat dataset {code}; updated {updated}.` plus reviewed subject labels       |
| `canonical_url`                        | Source-hosted Data Browser table                                                 |
| `embed_url` / `preview_url`            | `null`                                                                           |
| `citation_text`                        | `Eurostat: {title} ({code}), accessed {YYYY-MM-DD}.`                             |
| `attribution_name` / `attribution_url` | `Eurostat` and canonical Data Browser URL                                        |
| `source_updated_at`                    | Valid normalized top-level `updated` timestamp                                   |
| `license_code`                         | `null` until item-level review                                                   |
| `rights_json`                          | Unknown-by-default classification plus policy and manifest evidence              |
| `metadata_json`                        | Bounded JSON-stat structure/sample, normalized query, policy URL and fingerprint |
| `status`                               | `draft`                                                                          |

Refresh uses the same manifest selector and compares the update timestamp,
dimension signature, normalized query, and policy fingerprint. A changed
dimension structure, selector, ownership marker, policy URL, or restriction
flag forces `review`; a 404 hides the record; transient failures preserve the
previous record.

### Eurostat F4 acceptance gates

LUNA may implement the parser after encoding these checks:

1. each pilot fixture maps deterministically into the common draft record;
2. malformed IDs, arbitrary URLs/parameters, oversized responses, invalid
   JSON-stat, empty data, and `DS-` trade identifiers fail closed;
3. the client uses bounded streaming reads, timeout, retry, and concurrency
   limits;
4. no API response can create an embed or preview URL;
5. no dataset receives a supported license or commercial-use approval solely
   from the domain-level policy;
6. metadata persistence contains at most 50 observations and no full response;
7. duplicate imports are idempotent and refresh policy drift returns the asset
   to review;
8. a dry run of all three pilot codes succeeds before any remote D1 write;
9. production import remains an explicit separate command after item-level
   rights review.

No Eurostat production records may be imported by F3. The next task is the
LUNA-owned F4 parser, fixtures, migration row, CLI dry-run, and refresh adapter.
