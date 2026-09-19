INSERT OR IGNORE INTO rights_reviews (
  id,
  asset_id,
  decision,
  reason_code,
  notes,
  evidence_url,
  reviewed_by,
  created_at
)
SELECT
  'worldbank_marketplace_chart_cc_by_v1_' || id,
  id,
  rights_status,
  'automated_policy_verified_third_party',
  'Enabled a Cite Supply-rendered chart of selected World Bank API observations. Eligibility requires the existing indicator-specific CC BY-4.0 automated review, no recorded reuse prohibition, and no evidence conflict. This is not an official World Bank embed and does not enable a raw-data download.',
  canonical_url,
  NULL,
  '2026-09-19T00:30:00.000Z'
FROM assets
WHERE source_id = 'source_worldbank'
  AND status = 'published'
  AND rights_status = 'safe'
  AND license_code = 'CC_BY'
  AND json_extract(rights_json, '$.automated_review_completed') = 1
  AND json_extract(rights_json, '$.automated_review_version') = 'worldbank-indicator-metadata-cc-by-v1'
  AND json_extract(metadata_json, '$.source') = 'worldbank'
  AND json_extract(metadata_json, '$.rights_evidence.chart_license_raw') = 'CC BY-4.0'
  AND json_extract(metadata_json, '$.rights_evidence.chart_license_explicit') = 1
  AND COALESCE(json_extract(metadata_json, '$.rights_evidence.chart_reuse_prohibited'), 0) = 0
  AND COALESCE(json_extract(metadata_json, '$.rights_evidence.evidence_conflict'), 0) = 0;

UPDATE assets
SET
  embed_url = 'https://citesupply.com/embed/' || slug,
  embed_origin = 'https://citesupply.com',
  rights_json = json_set(
    rights_json,
    '$.embed_allowed', json('false'),
    '$.marketplace_rendered_embed_allowed', json('true'),
    '$.embed_provenance', 'marketplace_rendered',
    '$.embed_review_version', 'worldbank-marketplace-chart-cc-by-v1'
  ),
  metadata_json = json_set(
    metadata_json,
    '$.rights_evidence.citation_only_allowed', json('true'),
    '$.rights_evidence.marketplace_rendered_embed_allowed', json('true'),
    '$.rights_evidence.embed_provenance', 'marketplace_rendered',
    '$.rights_evidence.embed_review_version', 'worldbank-marketplace-chart-cc-by-v1'
  ),
  updated_at = '2026-09-19T00:30:00.000Z'
WHERE source_id = 'source_worldbank'
  AND status = 'published'
  AND rights_status = 'safe'
  AND license_code = 'CC_BY'
  AND json_extract(rights_json, '$.automated_review_completed') = 1
  AND json_extract(rights_json, '$.automated_review_version') = 'worldbank-indicator-metadata-cc-by-v1'
  AND json_extract(metadata_json, '$.source') = 'worldbank'
  AND json_extract(metadata_json, '$.rights_evidence.chart_license_raw') = 'CC BY-4.0'
  AND json_extract(metadata_json, '$.rights_evidence.chart_license_explicit') = 1
  AND COALESCE(json_extract(metadata_json, '$.rights_evidence.chart_reuse_prohibited'), 0) = 0
  AND COALESCE(json_extract(metadata_json, '$.rights_evidence.evidence_conflict'), 0) = 0;
