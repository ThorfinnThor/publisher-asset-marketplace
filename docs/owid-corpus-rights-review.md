# OWID corpus rights review

- Model route: SOL (B6 rights/import audit)
- Review mechanism: deterministic, asset-specific OWID JSON-LD evidence
- Review version: `owid-jsonld-v1`
- Scope: the 3,000 OWID chart URLs in `data/seed/owid-all-3000.csv`

The corpus review does not infer chart rights from the generic OWID FAQ alone. For each canonical
chart URL it requires an official `WebPage` JSON-LD record whose `ImageObject`:

- names Our World in Data as the creator and copyright holder;
- points back to the same chart-specific PNG path;
- links to a supported Creative Commons license.

Only matching records enter the existing B3 deterministic classifier. `safe` and `restricted`
decisions can be published; missing, conflicting, third-party, unsupported, or unavailable
evidence fails closed and leaves the asset unchanged. Rights for underlying source data are still
calculated independently from the stored indicator metadata and are never inferred from chart
rights.

The production workflow is
`.github/workflows/review-owid-rights.yml`. It reads and writes D1 with parameterized requests,
records idempotent `rights_reviews`, audits the complete database after publication, and uploads
the full B6 report as a workflow artifact.

Run a remote dry review without writes:

```bash
npm run rights:owid-corpus -- data/seed/owid-all-3000.csv --remote
```

Apply verified decisions and publish only classifier-approved assets:

```bash
npm run rights:owid-corpus -- data/seed/owid-all-3000.csv --remote --apply --publish
```
