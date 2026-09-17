export type SearchIndexAsset = {
  id: string;
  title: string;
  asset_type: string;
};

export function normalizeSearchIndexText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

export function buildTrigrams(value: string): string[] {
  const padded = `  ${normalizeSearchIndexText(value)}  `;
  const trigrams = new Set<string>();
  for (let index = 0; index + 3 <= padded.length; index += 1) {
    trigrams.add(padded.slice(index, index + 3));
  }
  return [...trigrams].sort();
}

export function buildAssetSearchTrigrams(asset: SearchIndexAsset): string[] {
  return buildTrigrams(`${asset.title} ${asset.asset_type}`);
}

export const rebuildAssetSearchTrigramsSql = `
  WITH RECURSIVE normalized(asset_id, value) AS (
    SELECT id, lower('  ' || title || ' ' || asset_type || '  ')
    FROM assets
  ), positions(asset_id, value, position) AS (
    SELECT asset_id, value, 1 FROM normalized
    UNION ALL
    SELECT asset_id, value, position + 1
    FROM positions
    WHERE position + 3 <= length(value)
  )
  INSERT INTO asset_search_trigrams (asset_id, trigram)
  SELECT DISTINCT asset_id, substr(value, position, 3)
  FROM positions
  WHERE length(substr(value, position, 3)) = 3
`;

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function rebuildSelectedAssetSearchTrigramsSql(assetIds: readonly string[]): string {
  if (assetIds.length === 0) {
    throw new Error("at least one asset id is required to rebuild selected search trigrams");
  }
  const ids = assetIds.map(sqlString).join(", ");
  return `DELETE FROM asset_search_trigrams WHERE asset_id IN (${ids});
WITH RECURSIVE normalized(asset_id, value) AS (
  SELECT id, lower('  ' || title || ' ' || asset_type || '  ')
  FROM assets
  WHERE id IN (${ids})
), positions(asset_id, value, position) AS (
  SELECT asset_id, value, 1 FROM normalized
  UNION ALL
  SELECT asset_id, value, position + 1
  FROM positions
  WHERE position + 3 <= length(value)
)
INSERT INTO asset_search_trigrams (asset_id, trigram)
SELECT DISTINCT asset_id, substr(value, position, 3)
FROM positions
WHERE length(substr(value, position, 3)) = 3;`;
}

export type SearchIndexQuery = {
  sql: string;
  params: string[];
};

export function rebuildSelectedAssetSearchTrigramQueries(
  assetIds: readonly string[],
): SearchIndexQuery[] {
  if (assetIds.length === 0) {
    return [];
  }
  const placeholders = assetIds.map(() => "?").join(", ");
  return [
    {
      sql: `DELETE FROM asset_search_trigrams WHERE asset_id IN (${placeholders})`,
      params: [...assetIds],
    },
    {
      sql: `WITH RECURSIVE normalized(asset_id, value) AS (
  SELECT id, lower('  ' || title || ' ' || asset_type || '  ')
  FROM assets
  WHERE id IN (${placeholders})
), positions(asset_id, value, position) AS (
  SELECT asset_id, value, 1 FROM normalized
  UNION ALL
  SELECT asset_id, value, position + 1
  FROM positions
  WHERE position + 3 <= length(value)
)
INSERT INTO asset_search_trigrams (asset_id, trigram)
SELECT DISTINCT asset_id, substr(value, position, 3)
FROM positions
WHERE length(substr(value, position, 3)) = 3`,
      params: [...assetIds],
    },
  ];
}

export async function rebuildAssetSearchTrigrams(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM asset_search_trigrams").bind().run();
  await db.prepare(rebuildAssetSearchTrigramsSql).bind().run();
}
