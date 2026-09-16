import { normalizePublicHttpsUrl } from "../submissions/validate";

type EmbedRights = {
  embed_allowed?: boolean | null;
  attribution_required?: boolean | null;
};

export const MARKETPLACE_IFRAME_STYLE = "width:100%;height:720px;border:0;display:block";

export type EmbedAsset = {
  embed_url: string | null;
  embed_origin?: string | null;
  rights_json: string | null;
  rights_status: "safe" | "restricted" | "unknown" | "blocked";
  source_id: string | null;
  source_base_url: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
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
  const rights = parseEmbedRights(asset.rights_json);
  return (
    (asset.rights_status === "safe" || asset.rights_status === "restricted") &&
    rights.embed_allowed === true &&
    (asset.embed_origin
      ? isReviewedEmbed(asset.embed_url, asset.embed_origin)
      : isSourceHostedEmbed(asset.embed_url, asset.source_base_url)) &&
    (asset.source_id !== null ||
      (rights.attribution_required === true && hasReviewedCreatorAttribution(asset)))
  );
}

export function buildEmbedMarkup(asset: EmbedAsset): string {
  if (!canCopyEmbed(asset) || !asset.embed_url) return "";
  const iframe = `<iframe src="${escapeAttribute(asset.embed_url)}" title="${escapeAttribute(asset.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts" style="${MARKETPLACE_IFRAME_STYLE}"></iframe>`;
  if (asset.source_id !== null) return iframe;

  return `<figure>${iframe}<figcaption>Source: <a href="${escapeAttribute(asset.attribution_url ?? "")}">${escapeText(asset.attribution_name ?? "")}</a></figcaption></figure>`;
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

export function hasReviewedCreatorAttribution(
  asset: Pick<EmbedAsset, "attribution_name" | "attribution_url">,
): boolean {
  const name = asset.attribution_name?.normalize("NFC").trim() ?? "";
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001F\u007F-\u009F]/.test(name)) {
    return false;
  }
  const normalized = normalizePublicHttpsUrl(asset.attribution_url);
  return (
    name === asset.attribution_name && normalized.ok && normalized.value === asset.attribution_url
  );
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
