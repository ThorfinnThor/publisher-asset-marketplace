import {
  canCopyEmbed,
  deriveSourceHostedEmbedUrl,
  parseEmbedRights,
  type EmbedAsset,
} from "../assets/embed";

const TRACKED_SOURCE_EMBED_PATH = /^\/e\/([a-z0-9][a-z0-9._-]{1,127})\/?$/u;
const MARKETPLACE_EMBED_PATH =
  /^\/embed\/((?:eurostat|worldbank)-[a-z0-9][a-z0-9._-]{1,63})\/?$/u;
const HASH_PREFIX = "citesupply:embed-usage:v1:";

export type EmbedAnalyticsDataset = {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
};

type TrackedEmbedAssetRow = EmbedAsset & {
  slug: string;
  canonical_url: string;
};

export type EmbedProvenance = "marketplace_rendered" | "source_hosted" | "creator_hosted";

export function trackedSourceEmbedSlug(pathname: string): string | null {
  return TRACKED_SOURCE_EMBED_PATH.exec(pathname)?.[1] ?? null;
}

export function marketplaceEmbedSlug(pathname: string): string | null {
  return MARKETPLACE_EMBED_PATH.exec(pathname)?.[1] ?? null;
}

export function isIframeEmbedRequest(request: Request): boolean {
  return request.method === "GET" && request.headers.get("sec-fetch-dest") === "iframe";
}

export function publisherOriginFromRequest(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const publisher = new URL(referer);
    if (publisher.protocol !== "https:" && publisher.protocol !== "http:") return null;

    const requestOrigin = new URL(request.url).origin;
    const hostname = publisher.hostname.toLowerCase();
    if (
      publisher.origin === requestOrigin ||
      hostname === "citesupply.com" ||
      hostname.endsWith(".citesupply.com")
    ) {
      return null;
    }
    return publisher.origin;
  } catch {
    return null;
  }
}

export async function resolveTrackedEmbedTarget(
  db: D1Database,
  slug: string,
): Promise<{
  target: string;
  provenance: Exclude<EmbedProvenance, "marketplace_rendered">;
} | null> {
  const asset = await db
    .prepare(
      `
        SELECT
          a.slug,
          a.source_id,
          a.canonical_url,
          a.embed_url,
          a.embed_origin,
          a.rights_json,
          a.rights_status,
          a.title,
          a.attribution_name,
          a.attribution_url,
          s.base_url AS source_base_url
        FROM assets a
        LEFT JOIN sources s ON s.id = a.source_id
        WHERE a.slug = ?
          AND a.status = 'published'
          AND a.rights_status IN ('safe', 'restricted')
        LIMIT 1
      `,
    )
    .bind(slug)
    .first<TrackedEmbedAssetRow>();

  if (!asset) return null;
  const embedUrl = deriveSourceHostedEmbedUrl(
    asset.source_id,
    asset.canonical_url,
    asset.embed_url,
  );
  const resolvedAsset = { ...asset, embed_url: embedUrl };
  if (!embedUrl || !canCopyEmbed(resolvedAsset)) return null;
  const rights = parseEmbedRights(asset.rights_json);
  if (
    rights.marketplace_rendered_embed_allowed === true &&
    rights.embed_provenance === "marketplace_rendered"
  ) {
    return null;
  }

  return {
    target: embedUrl,
    provenance: asset.source_id === null ? "creator_hosted" : "source_hosted",
  };
}

export async function recordEmbedUsage(
  db: D1Database,
  analytics: EmbedAnalyticsDataset | undefined,
  slug: string,
  request: Request,
  provenance: EmbedProvenance,
  now = new Date(),
): Promise<void> {
  if (!isIframeEmbedRequest(request)) return;

  const publisherOrigin = publisherOriginFromRequest(request);
  const [publisherHash, samplingIndex] = await Promise.all([
    publisherOrigin ? stableHash(publisherOrigin) : Promise.resolve<string | null>(null),
    stableHash(slug),
  ]);

  analytics?.writeDataPoint({
    blobs: [slug, publisherHash ?? "unknown", provenance],
    doubles: [1],
    indexes: [samplingIndex],
  });

  const createdAt = now.toISOString();
  const usageDate = createdAt.slice(0, 10);
  const statements = [
    db
      .prepare(
        `
          INSERT INTO embed_usage_daily (
            asset_slug,
            usage_date,
            load_count,
            unknown_publisher_load_count,
            first_seen_at,
            last_seen_at
          ) VALUES (?, ?, 1, ?, ?, ?)
          ON CONFLICT(asset_slug, usage_date) DO UPDATE SET
            load_count = embed_usage_daily.load_count + 1,
            unknown_publisher_load_count =
              embed_usage_daily.unknown_publisher_load_count + excluded.unknown_publisher_load_count,
            last_seen_at = excluded.last_seen_at
        `,
      )
      .bind(slug, usageDate, publisherHash ? 0 : 1, createdAt, createdAt),
  ];

  if (publisherHash) {
    statements.push(
      db
        .prepare(
          `
            INSERT OR IGNORE INTO embed_publisher_daily (
              asset_slug,
              publisher_hash,
              usage_date,
              first_seen_at
            ) VALUES (?, ?, ?, ?)
          `,
        )
        .bind(slug, publisherHash, usageDate, createdAt),
    );
  }

  await db.batch(statements);
}

async function stableHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${HASH_PREFIX}${value}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
