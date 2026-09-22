-- Imported sources expose their real previews and embeds differently: OWID uses
-- deterministic source-hosted routes, while Eurostat and World Bank render from
-- reviewed metadata. Rebuild the curated set with source-aware eligibility.
UPDATE assets SET search_indexable = 0;

WITH event_scores AS (
  SELECT
    asset_id,
    SUM(
      CASE event_type
        WHEN 'embed_copy' THEN 8
        WHEN 'citation_copy' THEN 6
        WHEN 'detail_view' THEN 4
        WHEN 'source_click' THEN 2
        WHEN 'impression' THEN 1
        ELSE 0
      END
    ) AS engagement_score
  FROM asset_events
  GROUP BY asset_id
),
eligible AS (
  SELECT
    a.id,
    CASE
      WHEN a.creator_id IS NOT NULL THEN 'creator'
      WHEN a.source_id IN ('source_owid', 'source_eurostat', 'source_worldbank') THEN a.source_id
      ELSE 'other'
    END AS cohort,
    (
      CASE
        WHEN a.slug IN (
          'solar-pv-prices',
          'share-of-individuals-using-the-internet',
          'cost-of-sequencing-a-full-human-genome',
          'worldbank-eg.elc.accs.zs',
          'eurostat-tps00001',
          'eurostat-nama_10_gdp',
          'eurostat-une_rt_a'
        ) THEN 1000000
        ELSE 0
      END
      + COALESCE(event_scores.engagement_score, 0) * 100
      + CASE a.asset_type
          WHEN 'calculator' THEN 600
          WHEN 'widget' THEN 550
          WHEN 'chart' THEN 500
          WHEN 'benchmark' THEN 400
          WHEN 'table' THEN 300
          ELSE 200
        END
      + MIN(LENGTH(TRIM(a.description)), 500)
    ) AS quality_score,
    COALESCE(a.source_updated_at, a.published_at, a.updated_at) AS freshness
  FROM assets a
  LEFT JOIN event_scores ON event_scores.asset_id = a.id
  WHERE a.status = 'published'
    AND a.rights_status = 'safe'
    AND LENGTH(TRIM(a.title)) BETWEEN 3 AND 160
    AND LENGTH(TRIM(a.description)) >= 80
    AND a.canonical_url LIKE 'https://%'
    AND (
      a.source_id = 'source_owid'
      OR (
        a.source_id IN ('source_eurostat', 'source_worldbank')
        AND a.metadata_json IS NOT NULL
        AND LENGTH(TRIM(a.metadata_json)) > 2
      )
      OR (
        a.preview_url IS NOT NULL
        AND TRIM(a.preview_url) <> ''
        AND a.embed_url IS NOT NULL
        AND TRIM(a.embed_url) <> ''
      )
    )
),
ranked AS (
  SELECT
    id,
    cohort,
    ROW_NUMBER() OVER (
      PARTITION BY cohort
      ORDER BY quality_score DESC, freshness DESC, id ASC
    ) AS cohort_rank
  FROM eligible
),
balanced AS (
  SELECT id
  FROM ranked
  WHERE cohort_rank <= CASE cohort
    WHEN 'source_owid' THEN 200
    WHEN 'source_eurostat' THEN 150
    WHEN 'source_worldbank' THEN 100
    WHEN 'creator' THEN 25
    ELSE 25
  END
)
UPDATE assets
SET search_indexable = 1
WHERE id IN (SELECT id FROM balanced);

WITH event_scores AS (
  SELECT
    asset_id,
    SUM(
      CASE event_type
        WHEN 'embed_copy' THEN 8
        WHEN 'citation_copy' THEN 6
        WHEN 'detail_view' THEN 4
        WHEN 'source_click' THEN 2
        WHEN 'impression' THEN 1
        ELSE 0
      END
    ) AS engagement_score
  FROM asset_events
  GROUP BY asset_id
),
remaining AS (
  SELECT
    a.id,
    ROW_NUMBER() OVER (
      ORDER BY
        COALESCE(event_scores.engagement_score, 0) DESC,
        CASE a.asset_type
          WHEN 'calculator' THEN 6
          WHEN 'widget' THEN 5
          WHEN 'chart' THEN 4
          WHEN 'benchmark' THEN 3
          WHEN 'table' THEN 2
          ELSE 1
        END DESC,
        COALESCE(a.source_updated_at, a.published_at, a.updated_at) DESC,
        LENGTH(TRIM(a.description)) DESC,
        a.id ASC
    ) AS overall_rank
  FROM assets a
  LEFT JOIN event_scores ON event_scores.asset_id = a.id
  WHERE a.search_indexable = 0
    AND a.status = 'published'
    AND a.rights_status = 'safe'
    AND LENGTH(TRIM(a.title)) BETWEEN 3 AND 160
    AND LENGTH(TRIM(a.description)) >= 80
    AND a.canonical_url LIKE 'https://%'
    AND (
      a.source_id = 'source_owid'
      OR (
        a.source_id IN ('source_eurostat', 'source_worldbank')
        AND a.metadata_json IS NOT NULL
        AND LENGTH(TRIM(a.metadata_json)) > 2
      )
      OR (
        a.preview_url IS NOT NULL
        AND TRIM(a.preview_url) <> ''
        AND a.embed_url IS NOT NULL
        AND TRIM(a.embed_url) <> ''
      )
    )
)
UPDATE assets
SET search_indexable = 1
WHERE id IN (
  SELECT id
  FROM remaining
  WHERE overall_rank <= MAX(
    0,
    500 - (SELECT COUNT(*) FROM assets WHERE search_indexable = 1)
  )
);
