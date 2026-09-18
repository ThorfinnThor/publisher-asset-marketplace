CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google', 'email')),
  provider_subject TEXT NOT NULL,
  email_normalized TEXT COLLATE NOCASE,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_subject)
);

CREATE INDEX auth_identities_profile_idx ON auth_identities(profile_id);
CREATE INDEX auth_identities_email_idx
  ON auth_identities(email_normalized)
  WHERE email_normalized IS NOT NULL;

INSERT INTO auth_identities (
  id, profile_id, provider, provider_subject, email_normalized,
  email_verified, created_at, updated_at
)
SELECT
  'github:' || substr(id, length('github:') + 1),
  id,
  'github',
  substr(id, length('github:') + 1),
  NULL,
  0,
  created_at,
  created_at
FROM profiles
WHERE id LIKE 'github:%';
