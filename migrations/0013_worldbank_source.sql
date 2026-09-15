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
  'source_worldbank',
  'worldbank',
  'World Bank Open Data',
  'https://data.worldbank.org',
  'https://data.worldbank.org/summary-terms-of-use',
  1,
  '2026-09-15T00:00:00.000Z',
  '2026-09-15T00:00:00.000Z'
);
