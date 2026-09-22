ALTER TABLE assets ADD COLUMN search_indexable INTEGER NOT NULL DEFAULT 0 CHECK (
  search_indexable IN (0, 1)
);

CREATE INDEX assets_search_indexable_idx
  ON assets(search_indexable, status, rights_status);

-- Seed a deliberately small, balanced search corpus. The full marketplace remains
-- public and browsable, but only pages with reviewed rights, a real preview, an
-- embed and substantial copy are eligible for search indexing.
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
    AND a.preview_url IS NOT NULL
    AND TRIM(a.preview_url) <> ''
    AND a.embed_url IS NOT NULL
    AND TRIM(a.embed_url) <> ''
    AND LENGTH(TRIM(a.title)) BETWEEN 3 AND 160
    AND LENGTH(TRIM(a.description)) >= 80
    AND a.canonical_url LIKE 'https://%'
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

-- If one cohort has fewer qualifying assets, fill its unused allocation with the
-- strongest remaining candidates while preserving the hard 500-page ceiling.
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
    AND a.preview_url IS NOT NULL
    AND TRIM(a.preview_url) <> ''
    AND a.embed_url IS NOT NULL
    AND TRIM(a.embed_url) <> ''
    AND LENGTH(TRIM(a.title)) BETWEEN 3 AND 160
    AND LENGTH(TRIM(a.description)) >= 80
    AND a.canonical_url LIKE 'https://%'
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
