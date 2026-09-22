export const publishedAssetCountSql = `
  SELECT COUNT(*) AS count
  FROM assets
  WHERE status = 'published'
    AND rights_status IN ('safe', 'restricted')
`;

type CountRow = {
  count: number | string | null;
};

/**
 * Returns the number of assets currently visible in the public catalog.
 * Draft, hidden, and unreviewed records are intentionally excluded.
 */
export async function getPublishedAssetCount(db: D1Database): Promise<number> {
  const row = await db.prepare(publishedAssetCountSql).first<CountRow>();
  const count = Number(row?.count ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}
