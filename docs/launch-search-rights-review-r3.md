# R3 launch search and rights review

Status: reviewed and deployed  
Model allocation: SOL review, LUNA implementation fixes

## Search eligibility

- Public search SQL requires `status = 'published'` and `rights_status IN ('safe', 'restricted')`.
- Detail pages and related-asset queries apply the same boundary.
- Embed/citation/source action routes repeat the published and rights-reviewed checks instead of
  trusting the page that initiated the request.
- Draft, review, hidden, unknown and blocked assets therefore cannot leak through a public slug,
  search filter or related-assets query.

## Rights claims

- Search and detail badges now read the per-asset `commercial_use` field from reviewed
  `rights_json`; `rights_status = safe` alone is not presented as blanket reuse permission.
- Detail pages show commercial use, modification, embed, citation, attribution and raw-data rights
  as separate tri-state rows.
- Raw-data redistribution is never inferred from chart/embed rights.
- Creator attribution markup is generated only when reviewed attribution and embed-origin checks pass.
- Copy actions are described as publisher intent, never as confirmed publication, citations or
  backlinks.

The existing ranking benchmark, rights decision-table tests and the R2 public smoke suite remain
release gates. No known public search or rights-claim defect remains for this MVP release.
