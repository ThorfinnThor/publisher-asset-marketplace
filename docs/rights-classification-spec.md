# Rights classification specification (B3)

Status: implementation-ready contract for B4  
Evidence reviewed: 2026-09-14  
Scope: source-hosted OWID chart embeds and citations in the publisher marketplace

This is a deterministic policy specification, not legal advice and not an LLM
classification prompt. B4 must implement it as pure functions with no network calls.

## Source policy facts

The classifier is based on three distinct evidence layers:

1. The chart-specific license/ownership notice is authoritative for the chart itself.
2. Each indicator's `origins[].license` and `nonRedistributable` value are authoritative
   for underlying data. A chart license never grants raw-data redistribution rights.
3. The general OWID FAQ is fallback context only. It says OWID-made charts bearing its
   logo and CC BY notice may be reused with citation, while third-party charts and most
   third-party data remain subject to the original provider's terms.

References:

- [OWID FAQs and reuse guidance](https://ourworldindata.org/faqs)
- [OWID Grapher Chart API](https://docs.owid.io/projects/etl/api/chart-api/)
- [OWID metadata reference](https://docs.owid.io/projects/etl/architecture/metadata/reference/)
- [Creative Commons license conditions](https://creativecommons.org/share-your-work/use-remix/cc-licenses/)

Chart-specific evidence overrides a general policy. Conflicting evidence blocks the
asset pending human review.

## Classifier input

All nullable fields are tri-state evidence. `null` means unknown; it must never be
treated as `false` or `true`.

```ts
type RightsEvidence = {
  chart_owner: "owid" | "third_party" | null;
  chart_license_code: SupportedLicense | null;
  chart_license_raw: string | null;
  chart_license_url: string | null;
  chart_license_explicit: boolean;
  manual_review_completed: boolean;
  embed_available: boolean | null;
  chart_reuse_prohibited: boolean | null;
  evidence_conflict: boolean;
  indicator_evidence: Array<{
    indicator_url: string;
    non_redistributable: boolean | null;
    origins: Array<{
      license_code: SupportedLicense | null;
      license_raw: string | null;
      license_url: string | null;
    }>;
  }>;
  evidence_url: string | null;
  evidence_checked_at: string | null;
};
```

`chart_license_explicit` is true only when the license was found on the individual
chart/page or recorded by a human reviewer. The general OWID FAQ alone does not make
it true. `embed_available` means an official source-hosted iframe URL exists; it does
not mean arbitrary HTML or JavaScript is permitted.

## Exact license normalization

B4 may normalize case, whitespace, punctuation around version numbers, and the word
`International`. It must not use substring or semantic matching. An unlisted label is
`CUSTOM_OR_UNKNOWN` until reviewed.

| Canonical code        | Accepted exact families                                    |
| --------------------- | ---------------------------------------------------------- |
| `CC0_1_0`             | CC0, CC0 1.0                                               |
| `PUBLIC_DOMAIN`       | Public domain, Public Domain Mark, PDM                     |
| `CC_BY`               | CC BY 2.0, 2.5, 3.0, 4.0, CC BY 3.0 DEED, or unversioned   |
| `CC_BY_SA`            | CC BY-SA 2.0, 2.5, 3.0, 4.0, or CC BY-SA without a version |
| `CC_BY_ND`            | CC BY-ND 2.0, 2.5, 3.0, 4.0, or CC BY-ND without a version |
| `CC_BY_NC`            | CC BY-NC with or without a supported version               |
| `CC_BY_NC_SA`         | CC BY-NC-SA with or without a supported version            |
| `CC_BY_NC_ND`         | CC BY-NC-ND with or without a supported version            |
| `ALL_RIGHTS_RESERVED` | All rights reserved                                        |
| `CUSTOM_OR_UNKNOWN`   | Every other value, including a missing value               |

A license URL does not replace a license name. A generic Creative Commons homepage
is insufficient evidence for a non-unknown decision.

## Chart rights mapping

This table maps the chart/visualization license only. `raw_data_redistribution` is
computed separately.

| Chart license              | Commercial use | Modification | Attribution | Citation | Share alike | Base status |
| -------------------------- | -------------: | -----------: | ----------: | -------: | ----------: | ----------- |
| `CC0_1_0`, `PUBLIC_DOMAIN` |           true |         true |       false |    false |       false | safe        |
| `CC_BY`                    |           true |         true |        true |     true |       false | safe        |
| `CC_BY_SA`                 |           true |         true |        true |     true |        true | restricted  |
| `CC_BY_ND`                 |           true |        false |        true |     true |       false | restricted  |
| `CC_BY_NC`                 |          false |         true |        true |     true |       false | restricted  |
| `CC_BY_NC_SA`              |          false |         true |        true |     true |        true | restricted  |
| `CC_BY_NC_ND`              |          false |        false |        true |     true |       false | restricted  |
| `ALL_RIGHTS_RESERVED`      |          false |        false |        null |     null |        null | blocked     |
| `CUSTOM_OR_UNKNOWN`        |           null |         null |        null |     null |        null | unknown     |

For OWID seed charts, OWID's requested citation remains required even if an underlying
data origin is public domain. The chart row is therefore `CC_BY`, not
`PUBLIC_DOMAIN`, whenever chart-specific OWID CC BY evidence is present.

## Status decision order

Rules are evaluated top-to-bottom; first match wins.

| Priority | Condition                                                           | `rights_status`    | Reason code                     |
| -------: | ------------------------------------------------------------------- | ------------------ | ------------------------------- |
|        1 | evidence URL or checked date is missing                             | unknown            | `missing_audit_evidence`        |
|        2 | `evidence_conflict === true`                                        | blocked            | `conflicting_evidence`          |
|        3 | `chart_reuse_prohibited === true`                                   | blocked            | `explicit_reuse_prohibition`    |
|        4 | `embed_available === false`                                         | blocked            | `official_embed_unavailable`    |
|        5 | chart license is `ALL_RIGHTS_RESERVED`                              | blocked            | `all_rights_reserved`           |
|        6 | chart owner is unknown                                              | unknown            | `unknown_chart_owner`           |
|        7 | chart license was not found on the chart or confirmed by review     | unknown            | `chart_license_not_explicit`    |
|        8 | chart is third-party and has no completed manual review             | unknown            | `third_party_review_required`   |
|        9 | chart license is missing/custom/unrecognized                        | unknown            | `unknown_chart_license`         |
|       10 | `embed_available` is unknown                                        | unknown            | `unknown_embed_capability`      |
|       11 | recognized chart license base status is restricted                  | restricted         | license-specific code           |
|       12 | permissive chart plus non-redistributable raw data                  | restricted         | `raw_data_non_redistributable`  |
|       13 | OWID-owned, explicit recognized permissive license, embed available | safe               | `verified_permissive_chart`     |
|       14 | reviewed third-party chart with otherwise complete evidence         | mapped base status | `manually_verified_third_party` |
|       15 | anything else                                                       | unknown            | `unmatched_evidence`            |

A third-party chart can become `safe` or `restricted` only through a recorded human
rights review that identifies the owner, exact license, evidence URL, and review date.
The automatic seed classifier must never promote it to `safe`.

## `rights_json` construction

For recognized chart licenses, fill the chart rights from the chart mapping table and
set `embed_allowed` from `embed_available`. For unknown or conflicting evidence, any
field not explicitly proved remains `null`.

```json
{
  "embed_allowed": true,
  "commercial_use": true,
  "modification_allowed": true,
  "citation_required": true,
  "raw_data_redistribution": null,
  "share_alike": false,
  "attribution_required": true,
  "evidence_url": "https://example.test/chart-specific-license",
  "evidence_checked_at": "2026-09-14T00:00:00.000Z"
}
```

The two evidence fields are required for `safe`, `restricted`, and `blocked`. When
status is `unknown`, preserve any available evidence but never manufacture a URL or
date.

## Raw-data rights aggregation

Raw-data rights are derived only from every unique indicator origin plus the
indicator's `nonRedistributable` field:

1. If any indicator has `nonRedistributable === true`, set
   `raw_data_redistribution = false`.
2. Otherwise, every indicator must have at least one origin and every origin must have
   an exact supported license.
3. Set `true` only when all origins are `CC0_1_0`, `PUBLIC_DOMAIN`, `CC_BY`, or
   `CC_BY_SA` and none is marked non-redistributable.
4. For NC, ND, all-rights-reserved, custom, missing, or conflicting origin terms, set
   `null` in V1. The current `rights_json` cannot express purpose-specific or
   transformation-specific raw-data conditions safely.

`raw_data_redistribution` never upgrades chart status. A false value makes an
otherwise safe chart `restricted` because the marketplace must suppress data-download
or export actions; a null value does not downgrade a verified source-hosted chart, but
all raw-data actions remain disabled.

## Public badges and actions

Gate B still applies: no public rights badge is enabled until the B6 audit passes.

| Status     | Public badge after Gate B               |                       Embed copy |                Citation copy | Source link |          Raw-data action |
| ---------- | --------------------------------------- | -------------------------------: | ---------------------------: | ----------: | -----------------------: |
| safe       | Verified for chart reuse                | only if `embed_allowed === true` | only if citation text exists |         yes | only if raw data is true |
| restricted | Restricted — show the exact restriction | only if `embed_allowed === true` | only if citation text exists |         yes | only if raw data is true |
| unknown    | Rights unverified                       |                               no |                           no |         yes |                       no |
| blocked    | Do not reuse                            |                               no |                           no |         yes |                       no |

Never show a positive badge for a `null` field. Never generate an embed action for a
blocked asset, even if an embed URL happens to be stored.

## Mandatory B4 test matrix

B4 must provide at least these deterministic cases:

1. OWID-owned + explicit CC BY + embed + complete evidence -> safe.
2. OWID-owned + CC BY-SA + embed -> restricted, share-alike true.
3. OWID-owned + CC BY-NC + embed -> restricted, commercial false.
4. OWID-owned + CC BY-ND + embed -> restricted, modification false.
5. Explicit reuse prohibition -> blocked regardless of license.
6. Missing chart license -> unknown.
7. Missing evidence URL/date -> unknown.
8. Unknown owner -> unknown.
9. Third-party without human review -> unknown.
10. Conflicting chart-specific evidence -> blocked.
11. Permissive chart + one non-redistributable indicator -> restricted, raw data false.
12. Permissive chart + one unknown origin license -> safe for chart actions, raw data null.
13. Multiple permissive origins -> raw data true.
14. Custom license containing the letters `CC BY` -> unknown, proving no substring match.
15. Blocked asset with stored embed URL -> embed action still denied.

Every supported license/status combination must be represented by a fixture, and the
classifier result must include a stable reason code suitable for `rights_reviews`.

## Seed evidence observation

The first ten live OWID records include both standard licenses and provider-specific
copyright labels. Examples of the latter include GSMA-, IRENA-, UN-, and named-author
terms. Those labels deliberately normalize to `CUSTOM_OR_UNKNOWN`; neither an OWID
host nor `nonRedistributable: false` is sufficient to convert them into a permissive
license.
