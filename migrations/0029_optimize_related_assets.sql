-- Related assets are read on every public asset-detail request. Partial indexes
-- let SQLite stop after the first three eligible rows instead of scanning and
-- sorting an entire source/type cohort.
DROP INDEX IF EXISTS assets_related_source_idx;
DROP INDEX IF EXISTS assets_related_type_idx;

CREATE INDEX assets_related_source_idx
ON assets(source_id, updated_at DESC, slug ASC)
WHERE status = 'published'
  AND rights_status IN ('safe', 'restricted');

CREATE INDEX assets_related_type_idx
ON assets(asset_type, updated_at DESC, slug ASC)
WHERE status = 'published'
  AND rights_status IN ('safe', 'restricted');
