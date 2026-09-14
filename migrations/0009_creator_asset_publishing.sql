ALTER TABLE assets ADD COLUMN embed_origin TEXT;

CREATE INDEX assets_creator_idx ON assets(creator_id);
