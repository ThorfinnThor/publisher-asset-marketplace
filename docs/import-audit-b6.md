# B6 import audit

- Audit time: 2026-09-14T12:00:00.000Z
- Data source: local Cloudflare D1 binding `DB`
- Assets audited: 10
- Gate B: **CLOSED**

The production Cloudflare D1 database was also queried read-only at the same audit time. It
contains zero assets, so its Gate B result is also closed. No remote data was written.

## Result

All ten imported seed assets are conservatively classified as `unknown` and remain in `draft`.
No rights or publication invariant failed. Public rights badges must remain disabled because the
live seed contains no `safe`, `restricted`, or `blocked` record that can be reviewed against
chart-specific evidence.

The automated B6 tests exercise all six audit strata, malformed metadata, unsafe publication,
rights invariants, deterministic sampling, and source freshness. Test fixtures do not substitute
for live evidence when deciding Gate B.

## Stratified coverage

| Stratum          | Population | Sampled | State       |
| ---------------- | ---------: | ------: | ----------- |
| safe             |          0 |       0 | not present |
| restricted       |          0 |       0 | not present |
| unknown          |         10 |       3 | covered     |
| blocked          |          0 |       0 | not present |
| missing metadata |          0 |       0 | not present |
| stale            |          1 |       1 | covered     |

## Gate B decision

- No live `safe` asset was available for stratified review.
- No live `restricted` asset was available for stratified review.
- No live `blocked` asset was available for stratified review.

## Reviewed sample

| Stratum | Slug                                                   | Rights  | Publication | Source updated | Finding                                       |
| ------- | ------------------------------------------------------ | ------- | ----------- | -------------- | --------------------------------------------- |
| unknown | `active-mobile-money-accounts`                         | unknown | draft       | 2026-03-09     | none                                          |
| unknown | `annual-professional-service-robots-installed-by-area` | unknown | draft       | 2026-04-20     | none                                          |
| unknown | `cost-of-sequencing-a-full-human-genome`               | unknown | draft       | 2023-11-28     | none; source declares `nextUpdate` 2026-10-14 |
| stale   | `transistors-per-microprocessor`                       | unknown | draft       | 2023-03-09     | 1,285 days old; no `nextUpdate`               |

## Freshness rule

The audit first honors valid `nextUpdate` dates found in the source column metadata. If none is
present, it marks a record stale when `source_updated_at` is more than 730 days before the audit.
This avoids flagging intentionally slow datasets that already publish a future refresh date.

## Reproduce

```bash
npm run audit:import -- --local --at 2026-09-14T12:00:00.000Z
```

Use `--remote` explicitly to audit production D1. Add `--enforce-gate` in CI when a closed gate
should return exit code 2. The B6 audit is read-only and did not modify local or remote D1.
