DROP TRIGGER IF EXISTS assets_fts_after_insert;
DROP TRIGGER IF EXISTS assets_fts_after_update;

CREATE TRIGGER assets_fts_after_insert
AFTER INSERT ON assets
BEGIN
  INSERT INTO assets_fts (asset_id, title, description, asset_type, source_name)
  VALUES (
    NEW.id,
    NEW.title,
    NEW.description,
    NEW.asset_type,
    COALESCE((SELECT name FROM sources WHERE sources.id = NEW.source_id), NEW.attribution_name, '')
  );
END;

CREATE TRIGGER assets_fts_after_update
AFTER UPDATE OF title, description, asset_type, source_id, attribution_name ON assets
BEGIN
  DELETE FROM assets_fts WHERE asset_id = OLD.id;
  INSERT INTO assets_fts (asset_id, title, description, asset_type, source_name)
  VALUES (
    NEW.id,
    NEW.title,
    NEW.description,
    NEW.asset_type,
    COALESCE((SELECT name FROM sources WHERE sources.id = NEW.source_id), NEW.attribution_name, '')
  );
END;
