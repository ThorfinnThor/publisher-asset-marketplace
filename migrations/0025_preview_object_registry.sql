CREATE TABLE preview_object_registry (
  r2_key TEXT PRIMARY KEY CHECK (r2_key LIKE 'submission-previews/%'),
  creator_id TEXT,
  uploaded_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_reference_at TEXT,
  unreferenced_since TEXT,
  delete_after TEXT,
  deleted_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX preview_object_registry_candidates_idx
  ON preview_object_registry(deleted_at, delete_after);

CREATE TABLE preview_gc_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cursor TEXT,
  last_run_at TEXT,
  last_completed_at TEXT,
  last_scanned_count INTEGER NOT NULL DEFAULT 0 CHECK (last_scanned_count >= 0),
  last_candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (last_candidate_count >= 0),
  last_deleted_count INTEGER NOT NULL DEFAULT 0 CHECK (last_deleted_count >= 0)
);

INSERT INTO preview_gc_state (id) VALUES (1);
