# V2-03 asset editorial overlay decision

**Decision date:** 4 October 2026  
**Model role:** Sol  
**Status:** Architecture approved; not implemented  
**Production changes:** None

## 1. Decision

Store reviewed asset-page editorial content as version-controlled JSON in the repository and load it into a bundled, read-only runtime map keyed by the stable asset ID.

Do not add the reviewed copy to `assets.description`, `assets.metadata_json` or another field currently owned by an import or refresh job. Do not add a D1 table for the pilot. A database-backed editor can be reconsidered only if the reviewed cohort becomes too large to maintain through the repository workflow or if a real editorial UI is required.

The initial implementation should use:

- one validated JSON record per asset under `content/assets/editorial/`;
- one Zod schema and loader under `src/lib/assets/editorial/`;
- a runtime map keyed by `asset_id`, with an asserted `asset_slug` as a human-readable safety check;
- a deterministic source-contract fingerprint derived from the evidence inputs used by the editorial claim;
- optional rendering only when the record is approved and its source contract still matches the current asset record.

This is a separate editorial overlay, not a replacement for the imported asset record.

## 2. Why this is the smallest durable option

The current source import and refresh paths update the title, description, canonical URL, embed and preview URLs, citation, attribution, source dates, rights data, metadata, search document, publication status and audit timestamps on `assets`. Storing reviewed editorial copy in those fields would allow a normal source refresh to replace or invalidate reviewed text without an editorial decision.

A repository-backed overlay avoids that ownership conflict:

- source imports continue to own source-derived asset fields;
- editors and reviewers own the overlay files;
- Git provides review history, attribution, rollback and exact content versions;
- deployment is required before reviewed text becomes public;
- no page view, import or scheduled job writes editorial content to D1;
- legacy assets without an overlay follow the current read and render path exactly;
- the existing repository-backed editorial article pattern can be reused instead of introducing a second content administration system.

For three pilots and an initial ten-page cohort, a D1 projection would add a migration, write path, synchronization logic and another failure mode without improving the public read path. It is therefore explicitly deferred.

## 3. Ownership boundaries

| Data                                                                                              | Owner                                   | Refresh behavior                                                              |
| ------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Asset title, source description, canonical/source URLs, preview, source dates and source metadata | Source import/refresh                   | May be updated by the existing ingest pipeline                                |
| Rights status and allowed publisher actions                                                       | Rights review pipeline                  | May change independently; unsafe rights always suppress the editorial overlay |
| Direct answer, method, limitations, observation coverage and curated related links                | Reviewed overlay file                   | Changes only through a reviewed repository change                             |
| Source contract and content version                                                               | Reviewed overlay file                   | Changes only when evidence is relocked and reviewed                           |
| Fresh/stale result                                                                                | Derived at runtime                      | Never written merely because a page was viewed                                |
| Search indexability                                                                               | Existing `assets.search_indexable` gate | Never enabled automatically by overlay approval                               |

## 4. Record contract

The machine-readable contract is recorded in `data/seo/asset-editorial-overlay-contract-v2-03.json`. Each future overlay record must contain these concepts:

- `schema_version`: version of the file shape;
- `asset_id`: stable primary key from `assets.id`;
- `asset_slug`: asserted route identity, used to catch accidental asset mismatches;
- `content_version`: explicit version of the reviewed copy;
- `review_state`: `draft`, `in_review`, `approved` or `retired`;
- `language`: initially `en`;
- `direct_answer`: concise answer to the page's defined question;
- `methodology`: how the source measure should be interpreted and any Cite Supply transformation;
- `limitations`: material constraints that prevent overinterpretation;
- `observation_coverage`: structured unit, period, geography and population/series scope;
- `source_contract`: exact source family, identifiers, canonical evidence URLs, evidence version and normalized fingerprint;
- `related_links`: allowlisted internal asset, topic or insight links with editorial context;
- `review`: reviewer role, approval time and hashes of the locked brief/evidence used for approval.

There is no fixed word-count requirement for an asset overlay. Its job is to answer and qualify the asset's specific question clearly. Long-form articles remain a separate format and must not be duplicated inside asset pages.

## 5. Source fingerprint and stale handling

The fingerprint must cover only the inputs that support the displayed answer, not the complete source metadata blob. Hashing the whole `metadata_json` would create false invalidations when an unrelated field changes.

The normalized fingerprint input should include, where applicable:

1. source family and source ID;
2. external indicator or chart identifiers;
3. canonical evidence URL;
4. unit and measurement definition;
5. selected geography or entity scope;
6. first and last observation period used by the answer;
7. source-data version, last-updated marker or approved fixture hash;
8. transformation identifier and version;
9. the identifiers of the facts or assertions used by the brief.

The normalization and SHA-256 calculation must be deterministic and tested. Key ordering, whitespace and display rounding must not change the result.

At read time the loader derives one of these effective states:

- `approved_fresh`: stored state is `approved`, the asset ID and slug match, the source contract matches, the asset remains published and rights remain safe;
- `stale`: a reviewed source-contract input changed;
- `suppressed`: the asset is no longer published, rights are no longer safe, the record is retired, or an integrity check fails;
- `absent`: no overlay exists.

Only `approved_fresh` renders the reviewed claim blocks or contributes to metadata. `stale`, `suppressed` and `absent` use the existing asset page without editorial claims. This conservative fallback prevents outdated claims without creating a D1 write storm. A stale result should be reported by a bounded validation command or CI check, not by writing on every request.

## 6. Read and render contract

The future loader should expose an optional, validated overlay alongside `PublishedAssetDetail`. It must not make the base asset query fail when no overlay exists.

For an approved, fresh overlay, the asset page may add these visible sections after the current preview/source-data area and before the rights workflow:

1. **Direct answer** — the reviewed answer with its period and unit visible;
2. **How to read it** — methodology and any transformation;
3. **Coverage** — time, geography and series scope;
4. **Limitations** — material caveats;
5. **Related Cite Supply pages** — contextual links, not a generic keyword list.

The existing preview, fallback states, rights panel, citation, embed behavior and source links remain authoritative. The overlay must not imply that Cite Supply created third-party source data.

Legacy behavior is an explicit compatibility requirement:

- no overlay: current page output remains unchanged;
- invalid overlay: build or test fails before release;
- stale overlay in production: current base page renders without the reviewed claim blocks;
- unsafe or blocked rights: current rights/indexability rules take precedence;
- source outage: the existing page fallback remains available, while an assertion that cannot be validated is not shown as current.

## 7. Metadata and indexability

Overlay approval and search indexability are independent gates.

- V2-03 does not change `assets.search_indexable`.
- An approved overlay does not automatically enter the sitemap.
- The Eurostat pilot remains `noindex, follow` until V2-07 approves its visible content, rights behavior, canonical, schema and sitemap eligibility.
- Metadata may use a dedicated reviewed `seo_description` only if that optional field is later added to the schema and validated against visible content.
- Do not truncate `direct_answer` mechanically to manufacture a meta description.
- JSON-LD must describe the same asset and visible claims; it must not publish a stale overlay.
- The existing public insight about EU renewables keeps its broader analytical intent. The asset overlay must remain a narrower dataset-reference explanation to avoid duplication and cannibalization.

## 8. Write and review workflow

The implementation should follow this bounded sequence:

1. V2-04 produces a locked brief and evidence record for each pilot.
2. Luna may create a first-pass overlay file only from that locked evidence.
3. Sol reviews source interpretation, calculations, limitations, rights and link intent.
4. The record moves to `approved` only after its evidence hashes and source fingerprint validate.
5. CI validates every overlay and checks that `asset_id` and `asset_slug` resolve to the same published asset.
6. A release bundles the approved files with the Worker.
7. A later source refresh may change the imported asset record, but it cannot edit the overlay file.
8. The validation command reports source-contract drift so the affected overlay can be relocked, updated and reviewed.

No automated import, refresh, analytics or page request is authorized to modify these files or their review state.

## 9. Cost and operational safeguards

- No new D1 table or migration in V2-03.
- No new D1 write path for editorial content.
- No per-request freshness write or view counter.
- No catalog-wide scheduled scan.
- Runtime lookup is an in-memory map lookup after the existing asset read.
- Source drift checks are limited to the approved cohort and run in CI or an explicit maintenance command.
- Any future D1 projection requires a separate cost estimate, bounded batch size, idempotent writes and an explicit rollout decision.

## 10. Rejected alternatives

### Add fields to `assets`

Rejected because import and refresh jobs already own this row and update many source-derived fields. Even if new columns were initially excluded from the update statement, ownership would remain ambiguous and a later bulk upsert could silently replace reviewed copy.

### Put the copy in `metadata_json`

Rejected because `metadata_json` is rebuilt from source responses. It is source payload, not an editorial store.

### Add a D1 overlay table now

Deferred because the pilot does not need runtime editing. It would require a migration, synchronization and extra reads/writes while Git-backed JSON already supplies review, versioning and rollback. Reconsider after the ten-page cohort only if a demonstrated workflow requires it.

### Generate the answer dynamically from live source data

Rejected because generation would not preserve a reviewed claim, could drift between requests and would make factual approval impossible to reproduce.

## 11. Implementation acceptance tests for V2-05 and V2-06

V2-07 implementation note: the current D1 detail contract exposes the
`source_updated_at` marker but not source-file hashes. The runtime therefore
validates the overlay against the bundled V2-06 assertion fixture (including
all reviewed hashes) and against the D1 update marker. A same-marker source
byte change still requires the source refresh/review process to advance the
marker or retire the assertion; it is not detectable by a page request alone.

The architecture is not complete in code until future steps prove all of the following:

- schema rejects missing unit, period, material limitation, invalid internal links and unapproved review states;
- asset ID and slug mismatch fails closed;
- an approved matching record renders all expected sections;
- a legacy asset produces the same output as before the feature;
- a mismatched source-assertion fixture or source update marker hides reviewed
  claims and is reported as stale;
- unsafe rights suppress the overlay even when its stored state is approved;
- stale or draft content is absent from metadata and JSON-LD;
- current sitemap eligibility does not change merely because an overlay exists;
- no import or refresh SQL statement targets overlay content;
- the validation and render paths perform no D1 writes;
- the three pilots retain their source-specific embed and citation distinctions.

## 12. V2-03 gate result

The gate is satisfied at the architecture level:

- reviewed text has a separate owner and cannot be silently replaced by imports;
- the representation is keyed by stable asset ID with a slug integrity assertion;
- source drift has a fail-closed, write-free behavior;
- old assets render unchanged;
- indexability remains an explicit, later decision.

No overlay records have been drafted, no migration has been created, no production data has been changed and nothing has been deployed.
