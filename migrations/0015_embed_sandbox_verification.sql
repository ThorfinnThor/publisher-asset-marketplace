ALTER TABLE submissions ADD COLUMN sandbox_tested_at TEXT;

ALTER TABLE submission_reviews ADD COLUMN sandbox_tested INTEGER NOT NULL DEFAULT 0 CHECK (
  sandbox_tested IN (0, 1)
);
