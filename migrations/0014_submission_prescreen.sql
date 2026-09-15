ALTER TABLE submissions ADD COLUMN pre_screen_status TEXT NOT NULL DEFAULT 'review' CHECK (
  pre_screen_status IN ('pass', 'review')
);

ALTER TABLE submissions ADD COLUMN pre_screen_json TEXT NOT NULL DEFAULT '{"schema_version":1,"status":"review","checks":[]}' CHECK (
  json_valid(pre_screen_json)
);

CREATE INDEX submissions_pre_screen_status_idx
  ON submissions(pre_screen_status, review_status, created_at);
