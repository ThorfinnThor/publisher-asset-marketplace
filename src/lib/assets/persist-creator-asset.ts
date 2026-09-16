import type { CreatorAssetRecord } from "./publish-submission";

const creatorAssetUpsertSql = `
  INSERT INTO assets (
    id, source_id, creator_id, external_id, slug, asset_type, title, description,
    canonical_url, canonical_url_normalized, embed_url, embed_origin, preview_url,
    citation_text, attribution_name, attribution_url, attribution_terms, published_at,
    source_updated_at, license_code, rights_status, rights_json, metadata_json,
    search_document, status, created_at, updated_at, last_checked_at
  )
  SELECT
    ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?,
    'published', ?, ?, ?
  WHERE EXISTS (
    SELECT 1 FROM submissions WHERE id = ?
  )
  ON CONFLICT(id) DO UPDATE SET
    creator_id = excluded.creator_id,
    slug = excluded.slug,
    asset_type = excluded.asset_type,
    title = excluded.title,
    description = excluded.description,
    canonical_url = excluded.canonical_url,
    canonical_url_normalized = excluded.canonical_url_normalized,
    embed_url = excluded.embed_url,
    embed_origin = excluded.embed_origin,
    preview_url = excluded.preview_url,
    citation_text = excluded.citation_text,
    attribution_name = excluded.attribution_name,
    attribution_url = excluded.attribution_url,
    attribution_terms = excluded.attribution_terms,
    license_code = excluded.license_code,
    rights_status = excluded.rights_status,
    rights_json = excluded.rights_json,
    metadata_json = excluded.metadata_json,
    search_document = excluded.search_document,
    status = 'published',
    updated_at = excluded.updated_at,
    last_checked_at = excluded.last_checked_at
`;

export function prepareCreatorAssetUpsert(
  db: D1Database,
  asset: CreatorAssetRecord,
  submissionId: string,
  licenseCode = "CREATOR_REVIEWED",
): D1PreparedStatement {
  return db
    .prepare(creatorAssetUpsertSql)
    .bind(
      asset.id,
      asset.creator_id,
      asset.slug,
      asset.asset_type,
      asset.title,
      asset.description,
      asset.canonical_url,
      asset.canonical_url_normalized,
      asset.embed_url,
      asset.embed_origin,
      asset.preview_url,
      asset.citation_text,
      asset.attribution_name,
      asset.attribution_url,
      asset.attribution_terms,
      licenseCode,
      asset.rights_status,
      asset.rights_json,
      asset.metadata_json,
      asset.search_document,
      asset.created_at,
      asset.updated_at,
      asset.last_checked_at,
      submissionId,
    );
}

export { creatorAssetUpsertSql };
