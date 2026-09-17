import type { Metadata } from "next";
import Link from "next/link";

import { SearchAnalyticsBeacon, TrackedSourceLink } from "@/components/analytics-components";
import { AssetPreview } from "@/components/asset-preview";
import { ArrowUpRightIcon, RightsBadge, SearchIcon } from "@/components/design-system";
import { getDatabase } from "@/lib/db/client";
import {
  assetTypeOptions,
  freshnessOptions,
  parseSearchPageParams,
  sourceOptions,
  type SearchPageParams,
} from "@/lib/search/search-page";
import { searchAssets, type SearchAsset } from "@/lib/search/search-assets";
import type { SearchResultContract } from "@/lib/search/ranking-contract";

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
  const parsed = parseSearchPageParams(params);
  const loaded = await loadSearchResults(parsed.request);
  const hasSearch = parsed.query.length > 0;

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
          <FilterFields parsed={parsed} />
        </aside>

        <section className="search-results" aria-labelledby="results-heading">
          <div className="search-results__heading">
            <div>
              <p className="eyebrow">Browse assets</p>
              <h1 id="results-heading">
                {hasSearch ? `Results for “${parsed.query}”` : "Find publisher-ready assets"}
              </h1>
              <p>
                {hasSearch
                  ? "Source links, freshness and reuse rights stay visible on every result."
                  : "Search charts, calculators and datasets with clear reuse information."}
              </p>
            </div>
            <span className="result-count">
              {loaded.results.length} {loaded.results.length === 1 ? "result" : "results"}
            </span>
          </div>

          <details className="filters filters--mobile">
            <summary>Filters</summary>
            <div className="filters--mobile__body">
              <FilterFields parsed={parsed} />
            </div>
          </details>

          {loaded.unavailable ? (
            <div className="notice" role="status">
              <strong>Search is temporarily unavailable.</strong> Published assets will appear here
              when the marketplace database is connected.
            </div>
          ) : null}

          {!loaded.unavailable && !hasSearch ? (
            <div className="empty-state search-empty" role="status">
              <strong>Start with a topic or source.</strong>
              <span>Try “solar”, “internet”, or “population” to find a reusable asset.</span>
            </div>
          ) : null}

          {!loaded.unavailable && hasSearch && loaded.results.length === 0 ? (
            <div className="empty-state search-empty" role="status">
              <strong>No published assets matched this search.</strong>
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
): Promise<SearchLoadResult> {
  if (!request.query) return { results: [], unavailable: false };
  try {
    const response = await searchAssets(getDatabase(), request);
    return { results: response.results, unavailable: false };
  } catch {
    return { results: [], unavailable: true };
  }
}

function FilterFields({ parsed }: { parsed: ReturnType<typeof parseSearchPageParams> }) {
  return (
    <div className="filter-groups">
      <div className="filter-header">
        <h2>Filters</h2>
        <Link href="/search">Clear</Link>
      </div>
      <fieldset className="filter-group">
        <legend>Asset type</legend>
        {assetTypeOptions.map((option) => (
          <label className="filter-option" key={option.value}>
            <input
              defaultChecked={parsed.selectedAssetTypes.includes(option.value)}
              form="search-form"
              name="type"
              type="checkbox"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>Source</legend>
        <select
          aria-label="Filter by source"
          defaultValue={parsed.selectedSource}
          form="search-form"
          name="source"
        >
          <option value="">All sources</option>
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Rights status</legend>
        <label className="filter-option">
          <input
            defaultChecked={parsed.selectedRights.includes("safe")}
            form="search-form"
            name="rights"
            type="checkbox"
            value="safe"
          />
          <span>Commercial use allowed</span>
        </label>
        <label className="filter-option">
          <input
            defaultChecked={parsed.selectedRights.includes("restricted")}
            form="search-form"
            name="rights"
            type="checkbox"
            value="restricted"
          />
          <span>Restricted use</span>
        </label>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Freshness</legend>
        {freshnessOptions.map((option) => (
          <label className="filter-option" key={option.value}>
            <input
              defaultChecked={parsed.selectedFreshness === option.value}
              form="search-form"
              name="freshness"
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResultContract<SearchAsset> }) {
  const asset = result.asset;
  const rights = parseRights(asset.rights_json);
  const embedAllowed = rights.embed_allowed === true && Boolean(asset.embed_url);
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
            <button
              className="button button--text button--small"
              disabled
              title="Embed actions are enabled in the asset detail view"
              type="button"
            >
              Embed
            </button>
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
