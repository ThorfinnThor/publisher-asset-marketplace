import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetAnalyticsBeacon, TrackedSourceLink } from "@/components/analytics-components";
import { ArrowUpRightIcon, ChartPreview, RightsBadge } from "@/components/design-system";
import { CopyCitationButton } from "@/components/copy-citation-button";
import { CopyEmbedButton } from "@/components/copy-embed-button";
import { JsonLd } from "@/components/json-ld";
import { SourceDataPreview } from "@/components/source-data-preview";
import { WorldBankDataChart } from "@/components/worldbank-data-chart";
import { buildEmbedMarkup, canCopyEmbed, parseEmbedRights } from "@/lib/assets/embed";
import { obligationLabel, permissionLabel, rightsValueState } from "@/lib/assets/rights-labels";
import { getDatabase } from "@/lib/db/client";
import { normalizePublicHttpsUrl } from "@/lib/submissions/validate";
import { parseSourcePreview } from "@/lib/assets/source-data-preview";
import { parseWorldBankIndicator } from "@/lib/assets/worldbank-chart";
import { buildAssetJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";
import { assetRobotsMetadata, isAssetSeoEligible } from "@/lib/seo/indexability";
import {
  getPublishedAssetBySlug,
  type PublishedAssetDetail,
  type RelatedAsset,
} from "@/lib/assets/get-asset";

type AssetPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: AssetPageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = await loadAsset(slug);
  if (!record) {
    return { title: "Asset not found", robots: { index: false, follow: false } };
  }
  const normalizedPreview = normalizePublicHttpsUrl(record.asset.preview_url);
  const images = normalizedPreview.ok
    ? [{ url: normalizedPreview.value, alt: record.asset.title }]
    : [{ url: "/opengraph-image", alt: "Cite Supply" }];
  return {
    title: record.asset.title,
    description: record.asset.description,
    robots: assetRobotsMetadata(isAssetSeoEligible(record.asset)),
    alternates: { canonical: `/asset/${record.asset.slug}` },
    openGraph: {
      type: "article",
      url: `/asset/${record.asset.slug}`,
      title: record.asset.title,
      description: record.asset.description,
      siteName: "Cite Supply",
      images,
      ...(record.asset.source_updated_at ? { modifiedTime: record.asset.source_updated_at } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: record.asset.title,
      description: record.asset.description,
      images: images.map((image) => image.url),
    },
  };
}

type AssetRights = {
  embed_allowed?: boolean | null;
  marketplace_rendered_embed_allowed?: boolean | null;
  embed_provenance?: "source_hosted" | "marketplace_rendered" | null;
  commercial_use?: boolean | null;
  modification_allowed?: boolean | null;
  citation_required?: boolean | null;
  raw_data_redistribution?: boolean | null;
  attribution_required?: boolean | null;
  evidence_url?: string | null;
  evidence_checked_at?: string | null;
};

type EurostatSample = {
  datasetCode: string;
  observationCount: number;
  selector: Record<string, string>;
  dimensions: Array<{ id: string; label: string }>;
  observations: Array<{
    value: number | string;
    status: string | null;
    coordinates: Record<string, string>;
    labels: Record<string, string>;
  }>;
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
  const eurostatSample = parseEurostatSample(asset.metadata_json);
  const sourceDataPreview = parseSourcePreview(asset.metadata_json);
  const worldBankIndicator =
    asset.source_id === "source_worldbank"
      ? parseWorldBankIndicator(asset.metadata_json, asset.canonical_url)
      : null;
  const embedRights = parseEmbedRights(asset.rights_json);
  const marketplaceEmbed =
    embedRights.embed_provenance === "marketplace_rendered" &&
    embedRights.marketplace_rendered_embed_allowed === true;

  return (
    <main className="asset-detail page-shell">
      <JsonLd value={buildAssetJsonLd(asset)} />
      <JsonLd
        value={buildBreadcrumbJsonLd([
          { name: "Browse", path: "/search" },
          { name: asset.title, path: `/asset/${asset.slug}` },
        ])}
      />
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
          <h1 className={assetTitleClassName(asset.title)} title={asset.title}>
            {asset.title}
          </h1>
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
              label={embedButtonLabel(marketplaceEmbed)}
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
          {eurostatSample ? (
            <EurostatDataPreview sample={eurostatSample} />
          ) : previewUrl ? (
            <img
              className="asset-detail__source-image"
              src={previewUrl}
              alt={`Data visualization: ${asset.title}`}
              loading="eager"
            />
          ) : worldBankIndicator ? (
            <WorldBankDataChart
              indicator={worldBankIndicator}
              metadataJson={asset.metadata_json}
              title={asset.title}
              marketplaceEmbedAvailable={marketplaceEmbed}
            />
          ) : sourceDataPreview ? (
            <SourceDataPreview metadataJson={asset.metadata_json} />
          ) : (
            <ChartPreview variant={previewVariant(asset.asset_type)} />
          )}
          <p>
            {eurostatSample
              ? "Live values from the reviewed Eurostat selection; this is a customised presentation."
              : previewUrl
                ? `Data visualization loaded directly from ${asset.source_name || "the source"}.`
                : worldBankIndicator
                  ? "Real observations loaded from the official World Bank Indicators API."
                  : sourceDataPreview
                    ? "Reviewed source observations rendered as a Cite Supply data preview."
                    : "A source data visualization is not available for this asset."}
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
            <PermissionRow label="Source-hosted embed use" value={rights.embed_allowed} />
            {marketplaceEmbed ? (
              <PermissionRow label="Marketplace-rendered embed" value={true} />
            ) : null}
            <PermissionRow label="Commercial use" value={rights.commercial_use} />
            <PermissionRow label="Modification" value={rights.modification_allowed} />
            <ObligationRow label="Attribution" value={rights.attribution_required} />
            <ObligationRow label="Citation" value={rights.citation_required} />
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
                <p className="eyebrow">
                  {marketplaceEmbed ? "Marketplace-rendered embed" : "Source-hosted only"}
                </p>
                <h2 id="embed-heading">Embed instructions</h2>
              </div>
              <CopyEmbedButton
                assetSlug={asset.slug}
                compact
                disabled={!embedAllowed}
                embedMarkup={buildEmbedMarkup(asset)}
                label={embedButtonLabel(marketplaceEmbed)}
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
                : marketplaceEmbed
                  ? asset.source_id === "source_worldbank"
                    ? "This iframe is rendered by Cite Supply from reviewed World Bank observations under CC BY 4.0. It is not an official World Bank embed."
                    : "This iframe is rendered by Cite Supply from the reviewed Eurostat sample. It is not an official Eurostat embed."
                  : asset.source_id === "source_worldbank"
                    ? "World Bank catalogue assets are citation-only. No official or marketplace-rendered embed has been approved."
                    : "Embeds stay hosted by the source. Cite Supply records an aggregate iframe-load signal before redirecting to the reviewed source embed; it does not proxy or republish the chart."}
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 ? <RelatedAssets assets={related} /> : null}
    </main>
  );
}

async function loadAsset(slug: string) {
  return getPublishedAssetBySlug(getDatabase(), slug);
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
  const state = rightsValueState(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`permission permission--${state}`}>{permissionLabel(value)}</dd>
    </div>
  );
}

function assetTitleClassName(title: string): string | undefined {
  if (title.length > 140) return "asset-detail__title--long";
  if (title.length > 90) return "asset-detail__title--medium";
  return undefined;
}

function ObligationRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  const state = rightsValueState(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`permission permission--${state}`}>{obligationLabel(value)}</dd>
    </div>
  );
}

function embedButtonLabel(marketplaceEmbed: boolean): string {
  return marketplaceEmbed ? "Copy Cite Supply embed" : "Copy source embed";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([, entry]) => typeof entry !== "string")) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

function parseEurostatSample(value: string | null): EurostatSample | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.source !== "eurostat") return null;
    const datasetCode = typeof parsed.dataset_code === "string" ? parsed.dataset_code : null;
    const observationCount =
      typeof parsed.observation_count === "number" && Number.isFinite(parsed.observation_count)
        ? parsed.observation_count
        : null;
    const selector = stringMap(parsed.selector);
    const dimensions = Array.isArray(parsed.dimensions)
      ? parsed.dimensions.flatMap((dimension) => {
          if (!isRecord(dimension)) return [];
          const id = typeof dimension.id === "string" ? dimension.id : null;
          const label = typeof dimension.label === "string" ? dimension.label : null;
          return id && label ? [{ id, label }] : [];
        })
      : [];
    const observations = Array.isArray(parsed.observations)
      ? parsed.observations.flatMap((observation) => {
          if (!isRecord(observation)) return [];
          const observationValue =
            (typeof observation.value === "number" && Number.isFinite(observation.value)) ||
            typeof observation.value === "string"
              ? observation.value
              : null;
          const coordinates = stringMap(observation.coordinates);
          const labels = stringMap(observation.labels);
          const status =
            observation.status === null || typeof observation.status === "string"
              ? observation.status
              : null;
          return observationValue !== null && coordinates && labels
            ? [{ value: observationValue, status, coordinates, labels }]
            : [];
        })
      : [];
    if (
      !datasetCode ||
      observationCount === null ||
      !selector ||
      dimensions.length === 0 ||
      observations.length === 0
    ) {
      return null;
    }
    return { datasetCode, observationCount, selector, dimensions, observations };
  } catch {
    return null;
  }
}

function formatObservationValue(value: number | string): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
  }
  return value;
}

function EurostatDataPreview({ sample }: { sample: EurostatSample }) {
  return (
    <div className="eurostat-data-preview">
      <div className="eurostat-data-preview__header">
        <span>DATA SAMPLE</span>
        <span>{sample.datasetCode}</span>
      </div>
      <div className="eurostat-data-preview__table-wrap">
        <table>
          <caption className="sr-only">
            Reviewed Eurostat observations for {sample.datasetCode}
          </caption>
          <thead>
            <tr>
              {sample.dimensions.map((dimension) => (
                <th key={dimension.id} scope="col">
                  {dimension.label}
                </th>
              ))}
              <th scope="col">Value</th>
              <th scope="col">Flag</th>
            </tr>
          </thead>
          <tbody>
            {sample.observations.map((observation, index) => (
              <tr key={`${index}-${observation.value}`}>
                {sample.dimensions.map((dimension) => (
                  <td key={dimension.id}>
                    {observation.labels[dimension.id] ??
                      observation.coordinates[dimension.id] ??
                      "—"}
                  </td>
                ))}
                <td className="eurostat-data-preview__value">
                  {formatObservationValue(observation.value)}
                </td>
                <td>{observation.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="eurostat-data-preview__note">
        Showing {sample.observations.length} of {sample.observationCount} retained observations ·{" "}
        {Object.entries(sample.selector)
          .filter(([key]) => key !== "lang")
          .map(([key, selected]) => `${key}=${selected}`)
          .join(" · ")}
      </p>
    </div>
  );
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
