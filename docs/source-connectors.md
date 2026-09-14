# F3 source connector contract

Status: **design complete; not onboarded**  
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

| Capability              | World Bank F4 default                            | Reason                                                                |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Search/index metadata   | Yes, after validation                            | Metadata and indicator pages are source-hosted and attributable       |
| Preview                 | Yes, link to the source indicator page           | Do not copy or re-host source visuals by default                      |
| Embed                   | No by default (`embed_url = null`)               | An iframe/export URL must be explicitly documented and tested first   |
| Commercial reuse        | Only when the item’s metadata permits it         | CC BY 4.0 is not a substitute for item-level evidence                 |
| Raw-data redistribution | No by default                                    | Third-party indicators and microdata may have additional restrictions |
| Citation copy           | Yes when the source/provider citation is present | Preserve the exact attribution text and policy URL                    |

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
| `preview_url`                          | Source-hosted indicator page or documented preview URL   |
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
