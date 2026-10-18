import { deriveSourceHostedEmbedUrl } from "./embed";

export type PublishedAssetDetail = {
  id: string;
  source_id: string | null;
  slug: string;
  asset_type: string;
  title: string;
  description: string;
  canonical_url: string;
  embed_url: string | null;
  embed_origin: string | null;
  preview_url: string | null;
  citation_text: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
  attribution_terms: string;
  source_updated_at: string | null;
  last_checked_at: string | null;
  license_code: string | null;
  rights_status: "safe" | "restricted";
  rights_json: string | null;
  metadata_json: string | null;
  source_name: string;
  source_base_url: string | null;
  source_policy_url: string | null;
  search_indexable: 0 | 1;
};

export type RelatedAsset = {
  id: string;
  slug: string;
  title: string;
  asset_type: string;
  source_name: string;
  source_updated_at: string | null;
};

type PublishedAssetRow = PublishedAssetDetail;

const detailSql = `
  SELECT
    a.id,
    a.source_id,
    a.slug,
    a.asset_type,
    a.title,
    a.description,
    a.canonical_url,
    a.embed_url,
    a.preview_url,
    a.citation_text,
    a.attribution_name,
    a.attribution_url,
    a.attribution_terms,
    a.source_updated_at,
    a.last_checked_at,
    a.license_code,
    a.rights_status,
    a.rights_json,
    a.metadata_json,
    COALESCE(s.name, a.attribution_name, '') AS source_name,
    s.base_url AS source_base_url,
    s.policy_url AS source_policy_url,
    a.embed_origin AS embed_origin,
    a.search_indexable
  FROM assets a
  LEFT JOIN sources s ON s.id = a.source_id
  WHERE a.slug = ?
    AND a.status = 'published'
    AND a.rights_status IN ('safe', 'restricted')
  LIMIT 1
`;

const relatedBySourceSql = `
  SELECT
    a.id,
    a.slug,
    a.title,
    a.asset_type,
    COALESCE(s.name, a.attribution_name, '') AS source_name,
    a.source_updated_at
  FROM assets a
  LEFT JOIN sources s ON s.id = a.source_id
  WHERE ? IS NOT NULL
    AND a.source_id = ?
    AND a.slug <> ?
    AND a.status = 'published'
    AND a.rights_status IN ('safe', 'restricted')
  ORDER BY a.updated_at DESC, a.slug ASC
  LIMIT 3
`;

const relatedByTypeSql = `
  SELECT
    a.id,
    a.slug,
    a.title,
    a.asset_type,
    COALESCE(s.name, a.attribution_name, '') AS source_name,
    a.source_updated_at
  FROM assets a
  LEFT JOIN sources s ON s.id = a.source_id
  WHERE a.asset_type = ?
    AND a.slug <> ?
    AND a.status = 'published'
    AND a.rights_status IN ('safe', 'restricted')
    AND (? IS NULL OR a.source_id IS NULL OR a.source_id <> ?)
  ORDER BY a.updated_at DESC, a.slug ASC
  LIMIT 3
`;

export function buildAssetDetailSql(): string {
  return detailSql;
}

export function buildRelatedAssetsSql(): { sameSource: string; sameType: string } {
  return {
    sameSource: relatedBySourceSql,
    sameType: relatedByTypeSql,
  };
}

export async function getPublishedAssetBySlug(
  db: D1Database,
  slug: string,
): Promise<{ asset: PublishedAssetDetail; related: RelatedAsset[] } | null> {
  const detailResult = await db.prepare(detailSql).bind(slug).all<PublishedAssetRow>();
  const asset = detailResult.results[0];
  if (!asset) return null;

  const [sameSourceResult, sameTypeResult] = (await db.batch([
    db.prepare(relatedBySourceSql).bind(asset.source_id, asset.source_id, slug),
    db.prepare(relatedByTypeSql).bind(asset.asset_type, slug, asset.source_id, asset.source_id),
  ])) as unknown as [{ results: RelatedAsset[] }, { results: RelatedAsset[] }];

  return {
    asset: {
      ...asset,
      embed_url: deriveSourceHostedEmbedUrl(asset.source_id, asset.canonical_url, asset.embed_url),
    },
    related: [...sameSourceResult.results, ...sameTypeResult.results].slice(0, 3),
  };
}
