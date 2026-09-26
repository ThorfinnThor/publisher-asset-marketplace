-- Step 32: read-only Eurostat editorial gates.
-- This file must remain SELECT-only. It is safe to run against production D1.

SELECT
  a.id,
  a.source_id,
  a.slug,
  a.external_id,
  a.status,
  a.asset_type,
  a.canonical_url,
  a.embed_url,
  a.preview_url,
  a.citation_text,
  a.attribution_name,
  a.attribution_url,
  a.attribution_terms,
  a.embed_origin,
  a.source_updated_at,
  a.last_checked_at,
  a.license_code,
  a.rights_status,
  a.search_indexable,
  s.key AS source_key,
  s.name AS source_name,
  s.base_url AS source_base_url,
  s.policy_url AS source_policy_url,
  s.active AS source_active
FROM assets a
LEFT JOIN sources s ON s.id = a.source_id
WHERE a.slug IN ('eurostat-nrg_ind_ren', 'eurostat-tec00118')
  AND a.status = 'published'
  AND a.rights_status IN ('safe', 'restricted')
ORDER BY a.slug;

SELECT
  slug,
  CASE
    WHEN json_extract(rights_json, '$.embed_allowed') = 0
      AND json_extract(rights_json, '$.marketplace_rendered_embed_allowed') = 1
      AND json_extract(rights_json, '$.embed_provenance') = 'marketplace_rendered'
      AND json_extract(rights_json, '$.commercial_use') = 1
      AND json_extract(rights_json, '$.modification_allowed') = 1
      AND json_extract(rights_json, '$.attribution_required') = 1
      AND json_extract(rights_json, '$.citation_required') = 1
      AND json_extract(rights_json, '$.raw_data_redistribution') = 1
      AND json_extract(rights_json, '$.share_alike') = 0
      AND json_extract(rights_json, '$.automated_review_completed') = 1
      AND json_extract(rights_json, '$.automated_review_version') = 'eurostat-automated-policy-v1'
      AND json_extract(rights_json, '$.embed_review_version') = 'eurostat-marketplace-embed-v2'
      AND json_extract(rights_json, '$.evidence_url') = canonical_url
      AND json_extract(rights_json, '$.evidence_checked_at') IS NOT NULL
    THEN 1 ELSE 0
  END AS asset_rights_pass,
  CASE
    WHEN json_extract(metadata_json, '$.source') = 'eurostat'
      AND json_extract(metadata_json, '$.rights_evidence.chart_owner') = 'third_party'
      AND json_extract(metadata_json, '$.rights_evidence.chart_license_code') = 'EU_COMMISSION_REUSE_2011'
      AND json_extract(metadata_json, '$.rights_evidence.chart_license_explicit') = 1
      AND json_extract(metadata_json, '$.rights_evidence.manual_review_completed') = 0
      AND json_extract(metadata_json, '$.rights_evidence.automated_review_completed') = 1
      AND json_extract(metadata_json, '$.rights_evidence.automated_review_version') = 'eurostat-automated-policy-v1'
      AND json_extract(metadata_json, '$.rights_evidence.marketplace_rendered_embed_allowed') = 1
      AND json_extract(metadata_json, '$.rights_evidence.embed_review_version') = 'eurostat-marketplace-embed-v2'
      AND json_extract(metadata_json, '$.rights_evidence.chart_reuse_prohibited') = 0
      AND json_extract(metadata_json, '$.rights_evidence.evidence_conflict') = 0
      AND json_extract(metadata_json, '$.rights_evidence.evidence_url') = canonical_url
      AND json_array_length(json_extract(metadata_json, '$.rights_evidence.indicator_evidence')) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM json_each(metadata_json, '$.rights_evidence.indicator_evidence') AS indicator
        WHERE json_extract(indicator.value, '$.non_redistributable') IS NOT 0
          OR json_array_length(json_extract(indicator.value, '$.origins')) = 0
          OR EXISTS (
            SELECT 1
            FROM json_each(indicator.value, '$.origins') AS origin
            WHERE json_extract(origin.value, '$.license_code') != 'EU_COMMISSION_REUSE_2011'
              OR json_extract(origin.value, '$.license_url') != 'https://ec.europa.eu/eurostat/help/copyright-notice'
          )
      )
    THEN 1 ELSE 0
  END AS evidence_pass,
  json_extract(rights_json, '$.automated_review_version') AS automated_version,
  json_extract(rights_json, '$.embed_review_version') AS embed_version,
  json_array_length(json_extract(metadata_json, '$.rights_evidence.indicator_evidence')) AS indicator_count,
  json_extract(rights_json, '$.evidence_checked_at') AS evidence_checked_at
FROM assets
WHERE slug IN ('eurostat-nrg_ind_ren', 'eurostat-tec00118')
ORDER BY slug;

SELECT
  slug,
  length(citation_text) AS citation_length,
  length(attribution_terms) AS attribution_terms_length,
  canonical_url = attribution_url AS canonical_matches_attribution,
  canonical_url = ('https://citesupply.com/asset/' || slug) AS canonical_matches_public_route,
  (
    substr(embed_url, 1, length(embed_origin)) = embed_origin
    AND substr(embed_url, length(embed_origin) + 1, 1) = '/'
  ) AS embed_origin_matches,
  embed_origin IN (
    'https://citesupply.com',
    'https://publisher-asset-marketplace.shuu9599.workers.dev'
  ) AS embed_origin_approved,
  source_updated_at
FROM assets
WHERE slug IN ('eurostat-nrg_ind_ren', 'eurostat-tec00118')
ORDER BY slug;
