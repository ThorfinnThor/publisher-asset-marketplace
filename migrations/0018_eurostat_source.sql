INSERT OR IGNORE INTO sources (
  id,
  key,
  name,
  base_url,
  policy_url,
  active,
  created_at,
  updated_at
) VALUES (
  'source_eurostat',
  'eurostat',
  'Eurostat',
  'https://ec.europa.eu/eurostat',
  'https://ec.europa.eu/eurostat/help/copyright-notice',
  1,
  '2026-09-17T00:00:00.000Z',
  '2026-09-17T00:00:00.000Z'
);
