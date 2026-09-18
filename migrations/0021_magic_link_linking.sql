ALTER TABLE auth_magic_links ADD COLUMN link_profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE auth_magic_links ADD COLUMN link_session_hash TEXT;

CREATE INDEX auth_magic_links_link_profile_idx
  ON auth_magic_links(link_profile_id)
  WHERE link_profile_id IS NOT NULL;
