CREATE TABLE url_scan_jobs (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_url TEXT NOT NULL,
  requested_url_normalized TEXT NOT NULL COLLATE NOCASE,
  requested_hostname TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN (
      'queued',
      'running',
      'needs_confirmation',
      'needs_changes',
      'failed',
      'expired',
      'converted'
    )
  ),
  contract_version INTEGER NOT NULL DEFAULT 1 CHECK (contract_version = 1),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  error_code TEXT,
  preview_r2_key TEXT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX url_scan_jobs_creator_created_idx
  ON url_scan_jobs(creator_id, created_at DESC);

CREATE INDEX url_scan_jobs_status_created_idx
  ON url_scan_jobs(status, created_at);

CREATE INDEX url_scan_jobs_creator_url_idx
  ON url_scan_jobs(creator_id, requested_url_normalized, created_at DESC);

CREATE UNIQUE INDEX url_scan_jobs_submission_unique
  ON url_scan_jobs(submission_id)
  WHERE submission_id IS NOT NULL;
