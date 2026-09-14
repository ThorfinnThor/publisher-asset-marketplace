# B6 import audit

- Audit time: 2026-09-14T14:50:00.000Z
- Data source: remote Cloudflare D1 binding DB
- Assets audited: 10
- Gate B: **OPEN**

## Stratified coverage

| Stratum          | Population | Sampled | State       |
| ---------------- | ---------: | ------: | ----------- |
| safe             |         10 |       3 | covered     |
| restricted       |          0 |       0 | not_present |
| unknown          |          0 |       0 | not_present |
| blocked          |          0 |       0 | not_present |
| missing_metadata |          0 |       0 | not_present |
| stale            |          1 |       1 | covered     |

## Gate B decision

Gate B passed: every live rights status was sampled and no rights invariant failed.

## Sample

| Stratum | Slug                                                 | Rights | Publication | Source updated | Findings     |
| ------- | ---------------------------------------------------- | ------ | ----------- | -------------- | ------------ |
| safe    | active-mobile-money-accounts                         | safe   | published   | 2026-03-09     | none         |
| safe    | annual-professional-service-robots-installed-by-area | safe   | published   | 2026-04-20     | none         |
| safe    | cost-of-sequencing-a-full-human-genome               | safe   | published   | 2023-11-28     | none         |
| stale   | transistors-per-microprocessor                       | safe   | published   | 2023-03-09     | stale_source |

## Findings

| Severity | Slug                           | Code         | Detail                                                   |
| -------- | ------------------------------ | ------------ | -------------------------------------------------------- |
| warning  | transistors-per-microprocessor | stale_source | Source data is 1285 days old and has no nextUpdate date. |

## Interpretation

A closed gate keeps public rights badges disabled. `unknown` and `blocked` assets must remain unpublished. Missing/stale strata are reviewed when present; their absence alone does not fail the gate.
