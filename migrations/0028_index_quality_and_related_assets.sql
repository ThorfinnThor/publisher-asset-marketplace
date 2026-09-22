-- Keep asset-detail related lookups index-backed under crawler traffic.
CREATE INDEX IF NOT EXISTS assets_related_source_idx
ON assets(source_id, status, rights_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS assets_related_type_idx
ON assets(asset_type, status, rights_status, updated_at DESC);

-- Search engines should not receive multiple indexable pages with the same
-- visible title. Keep the strongest/freshest representative and leave the
-- remaining published pages available with noindex, follow.
WITH ranked_titles AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(title))
      ORDER BY
        CASE WHEN preview_url IS NOT NULL AND TRIM(preview_url) <> '' THEN 1 ELSE 0 END DESC,
        CASE WHEN embed_url IS NOT NULL AND TRIM(embed_url) <> '' THEN 1 ELSE 0 END DESC,
        COALESCE(source_updated_at, published_at, updated_at) DESC,
        LENGTH(TRIM(description)) DESC,
        id ASC
    ) AS title_rank
  FROM assets
  WHERE search_indexable = 1
)
UPDATE assets
SET search_indexable = 0
WHERE id IN (
  SELECT id
  FROM ranked_titles
  WHERE title_rank > 1
);
