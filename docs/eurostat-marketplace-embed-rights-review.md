# Eurostat marketplace-rendered embed rights review

Status: **approved for the pilot and reused by the automated catalogue gate**

The pilot entries below define the embed contract. The catalogue workflow may
apply the same contract to additional Eurostat table records only after each
record passes the bounded EU27/2020 data and automated policy checks.

Review owner: **SOL**  
Review date: **2026-09-17**  
Review version: **eurostat-pilot-marketplace-embed-v1**

This is an operational rights review for the marketplace release process, not
legal advice. It applies only to the three assets and exact API selections in
`eurostat-pilot-eu27-v1`.

## Decision

The marketplace may provide its own iframe-rendered presentation of the retained
Eurostat observations for:

- `eurostat-tps00001`;
- `eurostat-nama_10_gdp`;
- `eurostat-une_rt_a`.

The permission is limited to a marketplace-rendered data table. It is not an
official Eurostat iframe and must never be labelled or presented as one.

Eurostat authorises commercial and non-commercial reuse of statistical data and
metadata published on its website when the source is acknowledged. Commission
Decision 2011/833/EU defines reuse broadly as use by a person or legal entity for
a purpose other than the purpose for which the document was produced. It also
expressly supports reuse in value-added products and services. The delivery of a
reviewed data presentation through an iframe does not create a separate category
of rights.

Evidence:

- [Eurostat copyright notice and free reuse policy](https://ec.europa.eu/eurostat/help/copyright-notice)
- [Commission Decision 2011/833/EU](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32011D0833)
- [Underlying pilot review](./eurostat-pilot-rights-review.md)

## Required distinction in the rights model

The existing `embed_available` field means that an official source-hosted iframe
is available. It must remain `false` for the three Eurostat records because
Eurostat has not supplied such an iframe.

LUNA must add a separate decision for a marketplace-rendered embed. The public
interface and audit record must preserve all three facts:

| Field                                | Reviewed value         |
| ------------------------------------ | ---------------------- |
| `source_embed_available`             | `false`                |
| `marketplace_rendered_embed_allowed` | `true`                 |
| `embed_provenance`                   | `marketplace_rendered` |
| `embed_review_version`               | this review version    |
| `commercial_use`                     | `true`                 |
| `attribution_required`               | `true`                 |
| `modification_disclosure_required`   | `true`                 |
| `eurostat_non_liability_required`    | `true`                 |

The classifier must not convert `source_embed_available` to `true` and must not
reuse this exception for any other source or dataset.

## Mandatory content inside every iframe

The following content must remain visible inside the iframe itself. The host page
outside the iframe is not a substitute.

1. Dataset title and Eurostat dataset code.
2. The retained dimension labels, time period, value, unit, and status flag.
3. `Source: Eurostat, {dataset title} ({dataset code}), accessed {date}.`
4. A direct HTTPS link to the canonical Eurostat Data Browser page.
5. `Custom EU27 selection from 2020; not the complete Eurostat dataset.`
6. `This is a customised presentation by Publisher Asset Marketplace, not an
official Eurostat embed.`
7. `Eurostat does not endorse and is not responsible for this customised
presentation.`

No query parameter, embed option, CSS mode, viewport size, or publisher setting
may remove the attribution, source link, selection notice, or disclaimer.

## Content and behaviour restrictions

- Do not display an Eurostat logo, EU emblem, trademark, or page screenshot.
- Do not imply a partnership, endorsement, certification, or official embed.
- Do not add publisher-controlled HTML, JavaScript, attribution text, or source
  URLs to the iframe document.
- Do not include observations outside the reviewed `geo=EU27_2020`,
  `sinceTimePeriod=2020`, and `lang=en` selections.
- Do not change values. Formatting, sorting, responsive layout, and accessible
  labels are allowed when they do not distort the meaning.
- Do not offer data download or export beyond the retained reviewed observations.
- Do not load arbitrary third-party scripts or resources in the iframe.

## Technical release gates

LUNA may enable the public copy-embed action only after all of these gates pass:

1. a stable HTTPS `/embed/{slug}` route renders only server-controlled content;
2. the route refuses non-Eurostat and non-allowlisted slugs;
3. the required attribution and disclaimer are always visible;
4. the iframe has a restrictive CSP and no access to authentication, cookies,
   storage, forms, popups, downloads, or top-level navigation;
5. the generated snippet uses the marketplace embed URL and clearly identifies
   the provenance as marketplace-rendered;
6. automated tests prove that all three approved assets work on a different
   origin and that an unapproved asset is rejected;
7. the existing policy-fingerprint and refresh drift gates disable the embed when
   the source policy or reviewed query changes.

## Revocation

Any change to dataset code, geography, time selector, source ownership notice,
Eurostat policy, required disclaimer, or policy fingerprint invalidates this
approval. The marketplace must disable the embed action and return the record to
review until a new SOL decision is recorded.
