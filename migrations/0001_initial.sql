PRAGMA foreign_keys = ON;

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  policy_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('creator', 'admin')),
  display_name TEXT NOT NULL,
  website_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  creator_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  external_id TEXT,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  asset_type TEXT NOT NULL CHECK (
    asset_type IN ('chart', 'calculator', 'table', 'dataset', 'benchmark', 'widget')
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL,
  canonical_url_normalized TEXT NOT NULL COLLATE NOCASE UNIQUE,
  embed_url TEXT,
  preview_url TEXT,
  citation_text TEXT,
  attribution_name TEXT,
  attribution_url TEXT,
  published_at TEXT,
  source_updated_at TEXT,
  license_code TEXT,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (
    rights_status IN ('safe', 'restricted', 'unknown', 'blocked')
  ),
  rights_json TEXT CHECK (rights_json IS NULL OR json_valid(rights_json)),
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  search_document TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'review', 'published', 'hidden')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_checked_at TEXT,
  CHECK (
    (source_id IS NOT NULL AND creator_id IS NULL)
    OR (source_id IS NULL AND creator_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX assets_source_external_id_unique
  ON assets(source_id, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX assets_status_idx ON assets(status);
CREATE INDEX assets_asset_type_idx ON assets(asset_type);
CREATE INDEX assets_source_idx ON assets(source_id);
CREATE INDEX assets_rights_status_idx ON assets(rights_status);
CREATE INDEX assets_source_updated_at_idx ON assets(source_updated_at);
CREATE INDEX assets_last_checked_at_idx ON assets(last_checked_at);

CREATE VIRTUAL TABLE assets_fts USING fts5(
  asset_id UNINDEXED,
  title,
  description,
  asset_type,
  source_name,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  canonical_url_normalized TEXT NOT NULL COLLATE NOCASE,
  embed_url TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (
    asset_type IN ('chart', 'calculator', 'table', 'dataset', 'benchmark', 'widget')
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  attribution_name TEXT NOT NULL,
  attribution_url TEXT NOT NULL,
  declared_rights_json TEXT NOT NULL CHECK (json_valid(declared_rights_json)),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    review_status IN ('pending', 'approved', 'rejected', 'needs_changes')
  ),
  review_notes TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX submissions_creator_idx ON submissions(creator_id);
CREATE INDEX submissions_review_status_idx ON submissions(review_status);

CREATE TABLE search_events (
  id TEXT PRIMARY KEY,
  anonymous_session_id TEXT NOT NULL,
  query_raw TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  result_count INTEGER NOT NULL CHECK (result_count >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX search_events_created_at_idx ON search_events(created_at);
CREATE INDEX search_events_query_normalized_idx ON search_events(query_normalized);

CREATE TABLE asset_events (
  id TEXT PRIMARY KEY,
  anonymous_session_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('impression', 'detail_view', 'embed_copy', 'citation_copy', 'source_click')
  ),
  search_event_id TEXT REFERENCES search_events(id) ON DELETE SET NULL,
  result_position INTEGER CHECK (result_position IS NULL OR result_position >= 1),
  created_at TEXT NOT NULL
);

CREATE INDEX asset_events_asset_created_idx ON asset_events(asset_id, created_at);
CREATE INDEX asset_events_search_event_idx ON asset_events(search_event_id);
CREATE INDEX asset_events_type_created_idx ON asset_events(event_type, created_at);

CREATE TABLE rights_reviews (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('safe', 'restricted', 'unknown', 'blocked')),
  reason_code TEXT NOT NULL,
  notes TEXT,
  evidence_url TEXT NOT NULL,
  reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX rights_reviews_asset_created_idx ON rights_reviews(asset_id, created_at);

CREATE TABLE ingest_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  invalid_count INTEGER NOT NULL DEFAULT 0 CHECK (invalid_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE ingest_results (
  id TEXT PRIMARY KEY,
  ingest_run_id TEXT NOT NULL REFERENCES ingest_runs(id) ON DELETE CASCADE,
  external_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'duplicate', 'invalid', 'failed', 'upserted')),
  reason_code TEXT,
  detail_json TEXT CHECK (detail_json IS NULL OR json_valid(detail_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX ingest_results_run_status_idx ON ingest_results(ingest_run_id, status);

INSERT INTO sources (
  id,
  key,
  name,
  base_url,
  policy_url,
  active,
  created_at,
  updated_at
) VALUES (
  'source_owid',
  'owid',
  'Our World in Data',
  'https://ourworldindata.org',
  'https://ourworldindata.org/faqs',
  1,
  '2026-09-14T00:00:00.000Z',
  '2026-09-14T00:00:00.000Z'
);
