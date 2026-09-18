CREATE TABLE auth_magic_links (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE,
  request_ip_hash TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX auth_magic_links_email_created_idx
  ON auth_magic_links(email_normalized, created_at);

CREATE INDEX auth_magic_links_ip_created_idx
  ON auth_magic_links(request_ip_hash, created_at);

CREATE INDEX auth_magic_links_expiry_idx
  ON auth_magic_links(expires_at);

CREATE TABLE auth_magic_link_rate_limits (
  scope_key TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 1),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (scope_key, window_started_at)
);

CREATE INDEX auth_magic_link_rate_expiry_idx
  ON auth_magic_link_rate_limits(expires_at);
