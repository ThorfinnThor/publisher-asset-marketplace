ALTER TABLE submissions ADD COLUMN rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (
  rights_status IN ('safe', 'restricted', 'unknown', 'blocked')
);
ALTER TABLE submissions ADD COLUMN rights_reason_code TEXT;
ALTER TABLE submissions ADD COLUMN rights_evidence_url TEXT;
ALTER TABLE submissions ADD COLUMN rights_reviewed_at TEXT;

CREATE TABLE submission_reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_changes')),
  review_notes TEXT NOT NULL,
  rights_status TEXT NOT NULL CHECK (
    rights_status IN ('safe', 'restricted', 'unknown', 'blocked')
  ),
  rights_reason_code TEXT NOT NULL,
  rights_evidence_url TEXT,
  reviewed_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE INDEX submission_reviews_submission_created_idx
  ON submission_reviews(submission_id, created_at);
CREATE INDEX submissions_rights_status_idx
  ON submissions(rights_status);
