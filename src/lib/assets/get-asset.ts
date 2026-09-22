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

const relatedSql = `
  WITH target AS (
    SELECT source_id, asset_type
    FROM assets
    WHERE slug = ?
    LIMIT 1
  ),
  same_source AS (
    SELECT
      a.id,
      a.slug,
      a.title,
      a.asset_type,
      COALESCE(s.name, a.attribution_name, '') AS source_name,
      a.source_updated_at,
      a.updated_at AS sort_updated_at,
      1 AS source_priority
    FROM target t
    JOIN assets a ON t.source_id IS NOT NULL AND a.source_id = t.source_id
    LEFT JOIN sources s ON s.id = a.source_id
    WHERE a.slug <> ?
      AND a.status = 'published'
      AND a.rights_status IN ('safe', 'restricted')
    ORDER BY a.updated_at DESC, a.slug ASC
    LIMIT 3
  ),
  same_type AS (
    SELECT
      a.id,
      a.slug,
      a.title,
      a.asset_type,
      COALESCE(s.name, a.attribution_name, '') AS source_name,
      a.source_updated_at,
      a.updated_at AS sort_updated_at,
      0 AS source_priority
    FROM target t
    JOIN assets a ON a.asset_type = t.asset_type
    LEFT JOIN sources s ON s.id = a.source_id
    WHERE a.slug <> ?
      AND a.status = 'published'
      AND a.rights_status IN ('safe', 'restricted')
      AND (t.source_id IS NULL OR a.source_id IS NULL OR a.source_id <> t.source_id)
    ORDER BY a.updated_at DESC, a.slug ASC
    LIMIT 3
  ),
  candidates AS (
    SELECT * FROM same_source
    UNION ALL
    SELECT * FROM same_type
  )
  SELECT id, slug, title, asset_type, source_name, source_updated_at
  FROM candidates
  ORDER BY source_priority DESC, sort_updated_at DESC, slug ASC
  LIMIT 3
`;

export function buildAssetDetailSql(): string {
  return detailSql;
}

export function buildRelatedAssetsSql(): string {
  return relatedSql;
}

export async function getPublishedAssetBySlug(
  db: D1Database,
  slug: string,
): Promise<{ asset: PublishedAssetDetail; related: RelatedAsset[] } | null> {
  const [detailResult, relatedResult] = (await db.batch([
    db.prepare(detailSql).bind(slug),
    db.prepare(relatedSql).bind(slug, slug, slug),
  ])) as unknown as [{ results: PublishedAssetRow[] }, { results: RelatedAsset[] }];
  const asset = detailResult.results[0];
  if (!asset) return null;
  return {
    asset: {
      ...asset,
      embed_url: deriveSourceHostedEmbedUrl(asset.source_id, asset.canonical_url, asset.embed_url),
    },
    related: relatedResult.results,
  };
}
