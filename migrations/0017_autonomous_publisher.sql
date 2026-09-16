INSERT INTO profiles (id, role, display_name, website_url, created_at)
VALUES (
  'system:auto-publisher',
  'admin',
  'Autonomous publication checks',
  NULL,
  '2026-09-16T00:00:00.000Z'
)
ON CONFLICT(id) DO UPDATE SET
  role = 'admin',
  display_name = 'Autonomous publication checks';
