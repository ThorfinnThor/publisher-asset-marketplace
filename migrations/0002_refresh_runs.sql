CREATE TABLE refresh_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  refreshed_count INTEGER NOT NULL DEFAULT 0 CHECK (refreshed_count >= 0),
  hidden_count INTEGER NOT NULL DEFAULT 0 CHECK (hidden_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE refresh_results (
  id TEXT PRIMARY KEY,
  refresh_run_id TEXT NOT NULL REFERENCES refresh_runs(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('refreshed', 'hidden', 'failed')),
  reason_code TEXT NOT NULL,
  detail_json TEXT CHECK (detail_json IS NULL OR json_valid(detail_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX refresh_runs_source_started_idx ON refresh_runs(source_id, started_at);
CREATE INDEX refresh_results_run_outcome_idx ON refresh_results(refresh_run_id, outcome);
CREATE INDEX refresh_results_asset_created_idx ON refresh_results(asset_id, created_at);
