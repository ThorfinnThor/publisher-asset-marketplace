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
  'worldbank_population_total_provider_caveat_v1',
  id,
  rights_status,
  'manually_verified_third_party',
  'Population total remains citation-only because the existing asset review records additional provider-specific attribution concerns. The general World Bank marketplace-rendered embed approval does not override this asset-specific exception.',
  canonical_url,
  NULL,
  '2026-09-19T07:45:00.000Z'
FROM assets
WHERE source_id = 'source_worldbank'
  AND slug = 'worldbank-sp.pop.totl';

UPDATE assets
SET
  embed_url = NULL,
  embed_origin = NULL,
  rights_json = json_set(
    rights_json,
    '$.embed_allowed', json('false'),
    '$.marketplace_rendered_embed_allowed', json('false'),
    '$.embed_provenance', NULL,
    '$.embed_review_version', NULL
  ),
  metadata_json = json_set(
    metadata_json,
    '$.rights_evidence.citation_only_allowed', json('true'),
    '$.rights_evidence.marketplace_rendered_embed_allowed', json('false'),
    '$.rights_evidence.embed_provenance', NULL,
    '$.rights_evidence.embed_review_version', NULL
  ),
  updated_at = '2026-09-19T07:45:00.000Z'
WHERE source_id = 'source_worldbank'
  AND slug = 'worldbank-sp.pop.totl';
