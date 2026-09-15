import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetAnalyticsBeacon, TrackedSourceLink } from "@/components/analytics-components";
import { ArrowUpRightIcon, ChartPreview, RightsBadge } from "@/components/design-system";
import { CopyCitationButton } from "@/components/copy-citation-button";
import { CopyEmbedButton } from "@/components/copy-embed-button";
import { buildEmbedMarkup, canCopyEmbed } from "@/lib/assets/embed";
import { getDatabase } from "@/lib/db/client";
import { normalizePublicHttpsUrl } from "@/lib/submissions/validate";
import {
  getPublishedAssetBySlug,
  type PublishedAssetDetail,
  type RelatedAsset,
} from "@/lib/assets/get-asset";

export const metadata: Metadata = {
  title: "Asset",
};

type AssetPageProps = {
  params: Promise<{ slug: string }>;
};

type AssetRights = {
  embed_allowed?: boolean | null;
  commercial_use?: boolean | null;
  modification_allowed?: boolean | null;
  citation_required?: boolean | null;
  raw_data_redistribution?: boolean | null;
  attribution_required?: boolean | null;
  evidence_url?: string | null;
  evidence_checked_at?: string | null;
};

export default async function AssetPage({ params }: AssetPageProps) {
  const { slug } = await params;
  const record = await loadAsset(slug);
  if (!record) notFound();

  const { asset, related } = record;
  const rights = parseRights(asset.rights_json);
  const embedAllowed = canCopyEmbed(asset);
  const citationAvailable = Boolean(asset.citation_text);
  const normalizedPreview = normalizePublicHttpsUrl(asset.preview_url);
  const previewUrl = normalizedPreview.ok ? normalizedPreview.value : null;

  return (
    <main className="asset-detail page-shell">
      <AssetAnalyticsBeacon assetSlug={asset.slug} />
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/search">Browse</Link>
        <span aria-hidden="true">/</span>
        <span>{asset.source_name || "Publisher asset"}</span>
      </nav>

      <section className="asset-detail__hero">
        <div className="asset-detail__copy">
          <div className="asset-type-line">
            <span>{formatAssetType(asset.asset_type)}</span>
            <span aria-hidden="true">·</span>
            <span>{asset.source_name || "Independent source"}</span>
          </div>
          <h1>{asset.title}</h1>
          <p>{asset.description}</p>

          <dl className="asset-detail__meta">
            <div>
              <dt>Source</dt>
              <dd>
                <TrackedSourceLink
                  assetSlug={asset.slug}
                  href={asset.canonical_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {asset.source_name || "View canonical source"} <ArrowUpRightIcon />
                </TrackedSourceLink>
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(asset.source_updated_at)}</dd>
            </div>
            <div>
              <dt>Last checked</dt>
              <dd>{formatDate(asset.last_checked_at)}</dd>
            </div>
            <div>
              <dt>Rights status</dt>
              <dd>
                <RightsBadge state={rightsBadgeState(rights.commercial_use, asset.rights_status)}>
                  {commercialUseLabel(rights.commercial_use, asset.rights_status)}
                </RightsBadge>
              </dd>
            </div>
          </dl>

          <div className="asset-detail__actions">
            <CopyEmbedButton
              assetSlug={asset.slug}
              disabled={!embedAllowed}
              embedMarkup={buildEmbedMarkup(asset)}
            />
            <CopyCitationButton
              assetSlug={asset.slug}
              citationText={asset.citation_text ?? ""}
              disabled={!citationAvailable}
            />
            <TrackedSourceLink
              assetSlug={asset.slug}
              className="button button--secondary"
              href={asset.canonical_url}
              rel="noreferrer"
              target="_blank"
            >
              View source <ArrowUpRightIcon />
            </TrackedSourceLink>
          </div>
          <p className="action-note">
            Copy actions record publisher intent only. They do not confirm publication, citation or
            a backlink.
          </p>
        </div>

        <div className="asset-detail__preview">
          {embedAllowed && asset.embed_url ? (
            <iframe
              className="asset-detail__source-embed"
              src={asset.embed_url}
              title={`${asset.title} — interactive source chart`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts"
            />
          ) : previewUrl ? (
            <img
              className="asset-detail__source-image"
              src={previewUrl}
              alt={`Source preview of ${asset.title}`}
              loading="eager"
            />
          ) : (
            <ChartPreview variant={previewVariant(asset.asset_type)} />
          )}
          <p>
            {embedAllowed && asset.embed_url
              ? "Interactive chart loaded directly from the source."
              : previewUrl
                ? "Data preview loaded directly from the source."
                : "A source preview is not available for this asset."}
          </p>
        </div>
      </section>

      <div className="asset-detail__columns">
        <section className="detail-panel" aria-labelledby="rights-heading">
          <div className="detail-panel__heading">
            <div>
              <p className="eyebrow">Reuse conditions</p>
              <h2 id="rights-heading">Usage rights</h2>
            </div>
            <RightsBadge state={asset.rights_status === "safe" ? "verified" : "restricted"}>
              {asset.license_code ?? "License evidence reviewed"}
            </RightsBadge>
          </div>
          <dl className="rights-table">
            <PermissionRow label="Chart / embed use" value={rights.embed_allowed} />
            <PermissionRow label="Commercial use" value={rights.commercial_use} />
            <PermissionRow label="Modification" value={rights.modification_allowed} />
            <PermissionRow label="Attribution" value={rights.attribution_required} />
            <PermissionRow label="Citation" value={rights.citation_required} />
            <PermissionRow label="Raw-data redistribution" value={rights.raw_data_redistribution} />
          </dl>
          <p className="rights-separation-note">
            Chart and embed permission is separate from raw-data redistribution. The raw dataset is
            not included in this marketplace asset unless that right is explicitly marked allowed.
          </p>
          <a
            className="evidence-link"
            href={rights.evidence_url ?? asset.source_policy_url ?? asset.canonical_url}
            rel="noreferrer"
            target="_blank"
          >
            View rights evidence <ArrowUpRightIcon />
          </a>
        </section>

        <div className="detail-stack">
          <section
            className="detail-panel detail-panel--compact"
            aria-labelledby="citation-heading"
          >
            <div className="detail-panel__heading">
              <div>
                <p className="eyebrow">Publisher workflow</p>
                <h2 id="citation-heading">Exact citation</h2>
              </div>
              <CopyCitationButton
                assetSlug={asset.slug}
                citationText={asset.citation_text ?? ""}
                compact
                disabled={!citationAvailable}
              />
            </div>
            <p className="code-preview">
              {asset.citation_text ?? "Citation text is not available for this asset."}
            </p>
            {asset.attribution_name ? (
              <p className="detail-supporting-text">
                Attribution:{" "}
                {asset.attribution_url ? (
                  <a href={asset.attribution_url} rel="noreferrer" target="_blank">
                    {asset.attribution_name}
                  </a>
                ) : (
                  asset.attribution_name
                )}
                {asset.attribution_terms ? ` · ${asset.attribution_terms}` : ""}
              </p>
            ) : null}
          </section>

          <section className="detail-panel detail-panel--compact" aria-labelledby="embed-heading">
            <div className="detail-panel__heading">
              <div>
                <p className="eyebrow">Source-hosted only</p>
                <h2 id="embed-heading">Embed instructions</h2>
              </div>
              <CopyEmbedButton
                assetSlug={asset.slug}
                compact
                disabled={!embedAllowed}
                embedMarkup={buildEmbedMarkup(asset)}
              />
            </div>
            <p className="code-preview">
              {embedAllowed
                ? buildEmbedMarkup(asset)
                : "An approved source-hosted embed is not available for this asset."}
            </p>
            <p className="detail-supporting-text">
              {asset.source_id === null
                ? "Creator embeds include visible reviewed source attribution. The exact markup shown above is copied."
                : "Embeds stay hosted by the source; this marketplace does not proxy or republish the underlying chart."}
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 ? <RelatedAssets assets={related} /> : null}
    </main>
  );
}

async function loadAsset(slug: string) {
  try {
    return await getPublishedAssetBySlug(getDatabase(), slug);
  } catch {
    return null;
  }
}

function RelatedAssets({ assets }: { assets: RelatedAsset[] }) {
  return (
    <section className="related-assets" aria-labelledby="related-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow">Keep exploring</p>
          <h2 className="section-heading" id="related-heading">
            Related assets
          </h2>
        </div>
        <Link className="text-link" href="/search">
          Back to search
        </Link>
      </div>
      <div className="related-assets__grid">
        {assets.map((asset) => (
          <article className="related-asset" key={asset.id}>
            <p>
              {formatAssetType(asset.asset_type)} · {asset.source_name || "Source"}
            </p>
            <h3>
              <Link href={`/asset/${asset.slug}`}>{asset.title}</Link>
            </h3>
            <span>Updated {formatDate(asset.source_updated_at)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function PermissionRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  const state = value === true ? "allowed" : value === false ? "not-allowed" : "unknown";
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`permission permission--${state}`}>{permissionLabel(value)}</dd>
    </div>
  );
}

function parseRights(value: string | null): AssetRights {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as AssetRights) : {};
  } catch {
    return {};
  }
}

function permissionLabel(value: boolean | null | undefined): string {
  if (value === true) return "Allowed";
  if (value === false) return "Not allowed";
  return "Unknown";
}

function rightsBadgeState(
  commercialUse: boolean | null | undefined,
  status: PublishedAssetDetail["rights_status"],
): "verified" | "restricted" | "unknown" {
  if (commercialUse === true) return "verified";
  if (commercialUse === false || status === "restricted") return "restricted";
  return "unknown";
}

function commercialUseLabel(
  commercialUse: boolean | null | undefined,
  status: PublishedAssetDetail["rights_status"],
): string {
  if (commercialUse === true) return "Commercial use allowed";
  if (commercialUse === false) return "Non-commercial only";
  return status === "restricted" ? "Restricted use" : "Commercial use unknown";
}

function formatAssetType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function previewVariant(assetType: string): "line" | "bars" | "steps" {
  if (assetType === "calculator" || assetType === "benchmark") return "steps";
  if (assetType === "dataset" || assetType === "table") return "bars";
  return "line";
}
