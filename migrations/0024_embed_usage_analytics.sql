CREATE TABLE embed_usage_daily (
  asset_slug TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  load_count INTEGER NOT NULL DEFAULT 0 CHECK (load_count >= 0),
  unknown_publisher_load_count INTEGER NOT NULL DEFAULT 0 CHECK (
    unknown_publisher_load_count >= 0
  ),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (asset_slug, usage_date)
) WITHOUT ROWID;

CREATE INDEX embed_usage_daily_date_idx
  ON embed_usage_daily(usage_date, asset_slug);

CREATE TABLE embed_publisher_daily (
  asset_slug TEXT NOT NULL,
  publisher_hash TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (asset_slug, publisher_hash, usage_date)
) WITHOUT ROWID;

CREATE INDEX embed_publisher_daily_date_idx
  ON embed_publisher_daily(usage_date, asset_slug);
