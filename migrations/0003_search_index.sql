DROP TRIGGER IF EXISTS assets_fts_after_insert;
DROP TRIGGER IF EXISTS assets_fts_after_update;
DROP TRIGGER IF EXISTS assets_fts_after_delete;
DROP TABLE IF EXISTS assets_fts;

CREATE VIRTUAL TABLE assets_fts USING fts5(
  asset_id UNINDEXED,
  title,
  description,
  asset_type,
  source_name,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

CREATE TABLE asset_search_trigrams (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  trigram TEXT NOT NULL,
  PRIMARY KEY (asset_id, trigram)
);

CREATE INDEX asset_search_trigrams_trigram_idx ON asset_search_trigrams(trigram);

INSERT INTO assets_fts (asset_id, title, description, asset_type, source_name)
SELECT
  assets.id,
  assets.title,
  assets.description,
  assets.asset_type,
  COALESCE(sources.name, '')
FROM assets
LEFT JOIN sources ON sources.id = assets.source_id;

WITH RECURSIVE normalized(asset_id, value) AS (
  SELECT id, lower('  ' || title || ' ' || asset_type || '  ')
  FROM assets
), positions(asset_id, value, position) AS (
  SELECT asset_id, value, 1 FROM normalized
  UNION ALL
  SELECT asset_id, value, position + 1
  FROM positions
  WHERE position + 3 <= length(value)
)
INSERT INTO asset_search_trigrams (asset_id, trigram)
SELECT DISTINCT asset_id, substr(value, position, 3)
FROM positions
WHERE length(substr(value, position, 3)) = 3;

CREATE TRIGGER assets_fts_after_insert
AFTER INSERT ON assets
BEGIN
  INSERT INTO assets_fts (asset_id, title, description, asset_type, source_name)
  VALUES (NEW.id, NEW.title, NEW.description, NEW.asset_type,
    COALESCE((SELECT name FROM sources WHERE sources.id = NEW.source_id), ''));
END;

CREATE TRIGGER assets_fts_after_update
AFTER UPDATE OF title, description, asset_type, source_id ON assets
BEGIN
  DELETE FROM assets_fts WHERE asset_id = OLD.id;
  INSERT INTO assets_fts (asset_id, title, description, asset_type, source_name)
  VALUES (NEW.id, NEW.title, NEW.description, NEW.asset_type,
    COALESCE((SELECT name FROM sources WHERE sources.id = NEW.source_id), ''));
END;

CREATE TRIGGER assets_fts_after_delete
AFTER DELETE ON assets
BEGIN
  DELETE FROM assets_fts WHERE asset_id = OLD.id;
  DELETE FROM asset_search_trigrams WHERE asset_id = OLD.id;
END;
