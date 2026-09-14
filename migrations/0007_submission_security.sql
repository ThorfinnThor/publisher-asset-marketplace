ALTER TABLE submissions ADD COLUMN preview_url TEXT;
ALTER TABLE submissions ADD COLUMN attribution_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN authorization_attested_at TEXT;
ALTER TABLE submissions ADD COLUMN authorization_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE submissions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX submissions_canonical_url_unique
  ON submissions(canonical_url_normalized);
CREATE INDEX submissions_creator_created_idx
  ON submissions(creator_id, created_at);
