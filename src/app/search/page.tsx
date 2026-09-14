import type { Metadata } from "next";

import { AssetCard, SearchIcon } from "@/components/design-system";
import { designAssets } from "@/lib/design-assets";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  return (
    <main className="search-page">
      <section className="search-page__bar">
        <div className="page-shell">
          <form className="search-control search-control--results">
            <label className="sr-only" htmlFor="search-query">
              Search publisher-ready assets
            </label>
            <div className="search-field">
              <SearchIcon />
              <input
                defaultValue={query}
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
          <FilterFields />
        </aside>

        <section className="search-results" aria-labelledby="results-heading">
          <div className="search-results__heading">
            <div>
              <p className="eyebrow">Browse assets</p>
              <h1 id="results-heading">
                {query ? `Preview results for “${query}”` : "Featured publisher assets"}
              </h1>
              <p>Three interface records from the first validation collection.</p>
            </div>
            <span className="result-count">3 results</span>
          </div>

          <details className="filters filters--mobile">
            <summary>Filters</summary>
            <div className="filters--mobile__body">
              <FilterFields />
            </div>
          </details>

          <div className="notice" role="status">
            <strong>Validation preview.</strong> Search ranking and reusable actions are not public
            until source metadata and rights classification pass review.
          </div>

          <div className="search-results__list">
            {designAssets.map((asset) => (
              <AssetCard asset={asset} key={asset.slug} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function FilterFields() {
  return (
    <div className="filter-groups">
      <div className="filter-header">
        <h2>Filters</h2>
        <button type="button">Clear</button>
      </div>
      <fieldset className="filter-group">
        <legend>Asset type</legend>
        {[
          ["Charts", "3"],
          ["Calculators", "0"],
          ["Tables", "0"],
          ["Datasets", "0"],
          ["Benchmarks", "0"],
        ].map(([label, count]) => (
          <label className="filter-option" key={label}>
            <input type="checkbox" />
            <span>{label}</span>
            <small>{count}</small>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>Usage</legend>
        {["Commercial use allowed", "Embed available", "Modification allowed"].map((label) => (
          <label className="filter-option" key={label}>
            <input disabled type="checkbox" />
            <span>{label}</span>
          </label>
        ))}
        <p className="filter-help">Available after rights review.</p>
      </fieldset>
      <fieldset className="filter-group">
        <legend>Freshness</legend>
        <label className="filter-option">
          <input defaultChecked name="freshness" type="radio" />
          <span>Any time</span>
        </label>
        <label className="filter-option">
          <input name="freshness" type="radio" />
          <span>Past 12 months</span>
        </label>
        <label className="filter-option">
          <input name="freshness" type="radio" />
          <span>Past 3 years</span>
        </label>
      </fieldset>
      <div className="filter-group">
        <label htmlFor="source-filter">Source</label>
        <input className="filter-search" id="source-filter" placeholder="Search source…" />
      </div>
    </div>
  );
}
