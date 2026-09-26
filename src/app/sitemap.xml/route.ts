import { getDatabase } from "@/lib/db/client";
import { PUBLIC_EDITORIAL_ARTICLES } from "@/lib/editorial/public-articles";

const SITE_ORIGIN = "https://citesupply.com";
const staticPaths = ["/", "/creator/guide", "/insights", "/topics"];

type SitemapRow = {
  slug: string;
  last_modified: string | null;
};

export async function GET(): Promise<Response> {
  const result = await getDatabase()
    .prepare(
      `SELECT slug, COALESCE(updated_at, source_updated_at, published_at) AS last_modified
       FROM assets
       WHERE status = 'published'
         AND rights_status = 'safe'
         AND search_indexable = 1
       ORDER BY slug`,
    )
    .all<SitemapRow>();

  const entries = [
    ...staticPaths.map((path) => sitemapEntry(new URL(path, SITE_ORIGIN).toString(), null)),
    ...PUBLIC_EDITORIAL_ARTICLES.map((article) =>
      sitemapEntry(
        new URL(`/insights/${article.draft.slug}`, SITE_ORIGIN).toString(),
        article.dateModified,
      ),
    ),
    ...result.results.map((asset) =>
      sitemapEntry(
        new URL(`/asset/${encodeURIComponent(asset.slug)}`, SITE_ORIGIN).toString(),
        asset.last_modified,
      ),
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}

function sitemapEntry(location: string, lastModified: string | null): string {
  const lastmod = normalizeDate(lastModified);
  return `  <url><loc>${escapeXml(location)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
}

function normalizeDate(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
