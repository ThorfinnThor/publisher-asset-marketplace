export type CreatorAssetDeletionRow = {
  id: string;
  preview_url: string | null;
};

export const creatorAssetDeletionLookupSql = `
  SELECT id, preview_url
  FROM assets
  WHERE slug = ? AND creator_id = ? AND status = 'published'
  LIMIT 1
`;

export function prepareCreatorAssetDeletionStatements(
  db: D1Database,
  assetId: string,
  creatorId: string,
): [D1PreparedStatement, D1PreparedStatement] {
  return [
    db
      .prepare("DELETE FROM submissions WHERE creator_id = ? AND asset_id = ?")
      .bind(creatorId, assetId),
    db.prepare("DELETE FROM assets WHERE id = ? AND creator_id = ?").bind(assetId, creatorId),
  ];
}

export function marketplacePreviewObjectKey(
  previewUrl: string | null,
  marketplaceOrigin: string,
): string | null {
  if (!previewUrl) return null;
  try {
    const url = new URL(previewUrl);
    if (url.origin !== new URL(marketplaceOrigin).origin) return null;
    const match = url.pathname.match(
      /^\/api\/submission-previews\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu,
    );
    return match?.[1] ? `submission-previews/${match[1]}` : null;
  } catch {
    return null;
  }
}
