type EmbedRights = {
  embed_allowed?: boolean | null;
};

export type EmbedAsset = {
  embed_url: string | null;
  embed_origin?: string | null;
  rights_json: string | null;
  rights_status: "safe" | "restricted" | "unknown" | "blocked";
  source_base_url: string | null;
  title: string;
};

export function parseEmbedRights(value: string | null): EmbedRights {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as EmbedRights) : {};
  } catch {
    return {};
  }
}

export function isSourceHostedEmbed(
  embedUrl: string | null,
  sourceBaseUrl: string | null,
): boolean {
  if (!embedUrl || !sourceBaseUrl) return false;
  try {
    const embed = new URL(embedUrl);
    const source = new URL(sourceBaseUrl);
    const sameHost =
      embed.hostname === source.hostname || embed.hostname.endsWith(`.${source.hostname}`);
    return embed.protocol === "https:" && source.protocol === "https:" && sameHost;
  } catch {
    return false;
  }
}

export function canCopyEmbed(asset: EmbedAsset): boolean {
  return (
    (asset.rights_status === "safe" || asset.rights_status === "restricted") &&
    parseEmbedRights(asset.rights_json).embed_allowed === true &&
    (asset.embed_origin
      ? isReviewedEmbed(asset.embed_url, asset.embed_origin)
      : isSourceHostedEmbed(asset.embed_url, asset.source_base_url))
  );
}

export function buildEmbedMarkup(asset: Pick<EmbedAsset, "embed_url" | "title">): string {
  if (!asset.embed_url) return "";
  return `<iframe src="${escapeAttribute(asset.embed_url)}" title="${escapeAttribute(asset.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts"></iframe>`;
}

export function isReviewedEmbed(embedUrl: string | null, embedOrigin: string | null): boolean {
  if (!embedUrl || !embedOrigin) return false;
  try {
    const embed = new URL(embedUrl);
    const reviewed = new URL(embedOrigin);
    return (
      embed.protocol === "https:" &&
      reviewed.protocol === "https:" &&
      embed.origin === reviewed.origin
    );
  } catch {
    return false;
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
