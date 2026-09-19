import type { Metadata } from "next";
import Link from "next/link";

import { SearchAnalyticsBeacon, TrackedSourceLink } from "@/components/analytics-components";
import { AssetPreview } from "@/components/asset-preview";
import { ArrowUpRightIcon, RightsBadge, SearchIcon } from "@/components/design-system";
import { SearchFilterFields } from "@/components/search-filter-fields";
import { canCopyEmbed } from "@/lib/assets/embed";
import { getDatabase } from "@/lib/db/client";
import {
  parseSearchPageParams,
  sourceOptions,
  type SearchSourceOption,
  type SearchPageParams,
} from "@/lib/search/search-page";
import { searchAssets, type SearchAsset } from "@/lib/search/search-assets";
import type { SearchResultContract } from "@/lib/search/ranking-contract";
import { siteBrand } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

type SearchPageProps = {
  searchParams: Promise<SearchPageParams>;
};

type SearchLoadResult = {
  results: Array<SearchResultContract<SearchAsset>>;
  unavailable: boolean;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const availableSources = await loadSourceOptions();
  const parsed = parseSearchPageParams(params, new Date(), availableSources);
  const hasSearch = parsed.query.length > 0;
  const hasActiveFilters =
    parsed.selectedAssetTypes.length > 0 ||
    parsed.selectedSource !== "" ||
    parsed.selectedRights.length > 0 ||
    parsed.selectedFreshness !== "any";
  const shouldLoadResults = hasSearch || hasActiveFilters;
  const loaded = await loadSearchResults(parsed.request, shouldLoadResults);

  return (
    <main className="search-page">
      <section className="search-page__bar">
        <div className="page-shell">
          <form
            action="/search"
            className="search-control search-control--results"
            id="search-form"
            method="get"
          >
            <label className="sr-only" htmlFor="search-query">
              Search publisher-ready assets
            </label>
            <div className="search-field">
              <SearchIcon />
              <input
                defaultValue={parsed.query}
                id="search-query"
                name="q"
                placeholder="Search charts, statistics, calculators…"
                type="search"
              />
            </div>
            <button className="button button--primary" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="page-shell search-layout">
        <aside className="filters filters--desktop" aria-label="Search filters">
          <SearchFilterFields
            formId="search-form"
            parsed={parsed}
            sourceOptions={availableSources}
          />
        </aside>

        <section className="search-results" aria-labelledby="results-heading">
          <div className="search-results__heading">
            <div>
              <p className="eyebrow">{siteBrand.discoveryLine}</p>
              <h1 id="results-heading">
                {hasSearch
                  ? `Results for “${parsed.query}”`
                  : hasActiveFilters
                    ? "Filtered publisher-ready assets"
                    : "Find publisher-ready assets"}
              </h1>
              <p>
                {hasSearch
                  ? "Source links, freshness and reuse rights stay visible on every result."
                  : hasActiveFilters
                    ? "Showing published assets that match your selected filters."
                    : "Search charts, calculators and datasets with clear reuse information."}
              </p>
            </div>
            <span className="result-count">
              {loaded.results.length} {loaded.results.length === 1 ? "result" : "results"}
            </span>
          </div>

          <details className="filters filters--mobile">
            <summary>Filters</summary>
            <form
              action="/search"
              className="filters--mobile__body"
              id="mobile-filter-form"
              method="get"
            >
              <input name="q" type="hidden" value={parsed.query} />
              <SearchFilterFields
                formId="mobile-filter-form"
                parsed={parsed}
                sourceOptions={availableSources}
              />
            </form>
          </details>

          {loaded.unavailable ? (
            <div className="notice" role="status">
              <strong>Search is temporarily unavailable.</strong> Published assets will appear here
              when the marketplace database is connected.
            </div>
          ) : null}

          {!loaded.unavailable && !shouldLoadResults ? (
            <div className="empty-state search-empty" role="status">
              <strong>Start with a topic or source.</strong>
              <span>Try “solar”, “internet”, or “population” to find a reusable asset.</span>
            </div>
          ) : null}

          {!loaded.unavailable && shouldLoadResults && loaded.results.length === 0 ? (
            <div className="empty-state search-empty" role="status">
              <strong>No published assets match this search/filter combination.</strong>
              <span>
                Try fewer words or remove a filter. Draft and unverified assets stay hidden.
              </span>
            </div>
          ) : null}

          <div className="search-results__list">
            {loaded.results.map((result) => (
              <SearchResultCard key={result.asset.id} result={result} />
            ))}
          </div>
          <SearchAnalyticsBeacon
            query={parsed.query}
            resultCount={loaded.results.length}
            resultIds={loaded.results.map((result) => result.asset.id)}
          />
        </section>
      </div>
    </main>
  );
}

async function loadSearchResults(
  request: Parameters<typeof searchAssets>[1],
  shouldLoadResults: boolean,
): Promise<SearchLoadResult> {
  if (!shouldLoadResults) return { results: [], unavailable: false };
  try {
    const response = await searchAssets(getDatabase(), request);
    return { results: response.results, unavailable: false };
  } catch {
    return { results: [], unavailable: true };
  }
}

async function loadSourceOptions(): Promise<SearchSourceOption[]> {
  try {
    const response = await getDatabase()
      .prepare(
        `SELECT sources.id AS value, sources.name AS label, COUNT(assets.id) AS count
         FROM sources
         JOIN assets ON assets.source_id = sources.id
         WHERE sources.active = 1 AND assets.status = 'published'
           AND assets.rights_status IN ('safe', 'restricted')
         GROUP BY sources.id, sources.name
         ORDER BY sources.name`,
      )
      .all<SearchSourceOption>();
    return response.results.length > 0 ? response.results : sourceOptions;
  } catch {
    return sourceOptions;
  }
}

function SearchResultCard({ result }: { result: SearchResultContract<SearchAsset> }) {
  const asset = result.asset;
  const rights = parseRights(asset.rights_json);
  const embedAllowed = canCopyEmbed({
    ...asset,
    embed_url: asset.embed_url ?? null,
    embed_origin: asset.embed_origin ?? null,
    source_id: asset.source_id ?? null,
    source_base_url: asset.source_base_url ?? null,
    attribution_name: asset.attribution_name ?? null,
    attribution_url: asset.attribution_url ?? null,
  });
  const updated = formatUpdatedAt(asset.source_updated_at);

  return (
    <article className="asset-card">
      <Link
        aria-label={`Preview ${asset.title}`}
        className="asset-card__preview"
        href={`/asset/${asset.slug}`}
      >
        <AssetPreview
          compact
          previewUrl={asset.preview_url}
          metadataJson={asset.metadata_json}
          title={asset.title}
          variant={previewVariant(asset.asset_type)}
        />
      </Link>
      <div className="asset-card__body">
        <div className="asset-card__eyebrow">
          <span>{formatAssetType(asset.asset_type)}</span>
          <span aria-hidden="true">·</span>
          <span>{asset.source_name || "Independent source"}</span>
        </div>
        <h2 className="asset-card__title">
          <Link href={`/asset/${asset.slug}`}>{asset.title}</Link>
        </h2>
        <p className="asset-card__description">{asset.description}</p>
        <dl className="asset-card__meta">
          <div>
            <dt>Source</dt>
            <dd>{asset.source_name || "Not listed"}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{updated}</dd>
          </div>
        </dl>
        <div className="asset-card__footer">
          <div className="rights-badges" aria-label="Rights status">
            <RightsBadge state={rightsBadgeState(rights.commercial_use, asset.rights_status)}>
              {commercialUseLabel(rights.commercial_use, asset.rights_status)}
            </RightsBadge>
            {embedAllowed ? <RightsBadge state="verified">Embed ✓</RightsBadge> : null}
            <RightsBadge state={asset.citation_text ? "verified" : "unknown"}>
              {asset.citation_text ? "Citation ready" : "Citation required"}
            </RightsBadge>
          </div>
          <div className="asset-actions">
            <Link className="button button--secondary button--small" href={`/asset/${asset.slug}`}>
              Preview
            </Link>
            {embedAllowed ? (
              <Link
                className="button button--text button--small"
                href={`/asset/${asset.slug}#embed-heading`}
              >
                Embed
              </Link>
            ) : (
              <button
                className="button button--text button--small"
                disabled
                title={
                  asset.source_name === "World Bank Open Data"
                    ? "This catalogue asset is citation-only; no reviewed embed is available."
                    : "No reviewed embed is available for this asset."
                }
                type="button"
              >
                Embed
              </button>
            )}
            <button
              className="button button--text button--small"
              disabled
              title="Citation actions are enabled in the asset detail view"
              type="button"
            >
              Cite
            </button>
            <TrackedSourceLink
              assetSlug={asset.slug}
              className="button button--text button--small"
              href={asset.canonical_url ?? `/asset/${asset.slug}`}
              rel="noreferrer"
              target="_blank"
            >
              Source <ArrowUpRightIcon />
            </TrackedSourceLink>
          </div>
        </div>
      </div>
    </article>
  );
}

function parseRights(value: string | null): {
  embed_allowed?: boolean | null;
  commercial_use?: boolean | null;
} {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as { embed_allowed?: boolean | null; commercial_use?: boolean | null })
      : {};
  } catch {
    return {};
  }
}

function rightsBadgeState(
  commercialUse: boolean | null | undefined,
  status: SearchAsset["rights_status"],
): "verified" | "restricted" | "unknown" {
  if (commercialUse === true) return "verified";
  if (commercialUse === false || status === "restricted") return "restricted";
  return "unknown";
}

function commercialUseLabel(
  commercialUse: boolean | null | undefined,
  status: SearchAsset["rights_status"],
): string {
  if (commercialUse === true) return "Commercial use ✓";
  if (commercialUse === false) return "Non-commercial";
  return status === "restricted" ? "Restricted" : "Commercial use unknown";
}

function formatAssetType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatUpdatedAt(value: string | null): string {
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
