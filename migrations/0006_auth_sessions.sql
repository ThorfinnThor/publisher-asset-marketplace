CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL COLLATE NOCASE UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX auth_sessions_profile_idx ON auth_sessions(profile_id);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
