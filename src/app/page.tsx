import Link from "next/link";

import {
  ArrowUpRightIcon,
  ChartPreview,
  RightsBadge,
  SearchIcon,
} from "@/components/design-system";
import { designAssets } from "@/lib/design-assets";

const trendingQueries = ["AI adoption", "SaaS churn", "German salary", "Ecommerce benchmarks"];
const trustedSources = ["Our World in Data", "World Bank", "OECD", "United Nations", "Eurostat"];

export default function HomePage() {
  return (
    <main>
      <section className="home-hero" id="publishers">
        <div className="page-shell home-hero__grid">
          <div className="home-hero__copy">
            <p className="eyebrow">Publisher research, made reusable</p>
            <h1>Find data worth citing.</h1>
            <p className="home-hero__intro">
              Search charts, statistics, calculators and datasets you can actually publish in your
              content—with the source, freshness and reuse conditions in view.
            </p>
            <form action="/search" className="search-control home-search">
              <label className="sr-only" htmlFor="home-search">
                Search charts, statistics, calculators and datasets
              </label>
              <div className="search-field">
                <SearchIcon />
                <input
                  id="home-search"
                  name="q"
                  placeholder="Search charts, statistics, calculators…"
                  type="search"
                />
              </div>
              <button className="button button--primary" type="submit">
                Search
              </button>
            </form>
            <div className="trending" aria-label="Trending searches">
              <span>Trending</span>
              <div>
                {trendingQueries.map((query) => (
                  <Link href={`/search?q=${encodeURIComponent(query)}`} key={query}>
                    {query}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-previews" aria-label="Product preview">
            <article className="hero-preview hero-preview--chart">
              <div className="hero-preview__heading">
                <div>
                  <p>Chart preview</p>
                  <h2>Share of individuals using the Internet</h2>
                </div>
                <span className="source-monogram" aria-label="Source: Our World in Data">
                  OWID
                </span>
              </div>
              <ChartPreview variant="line" />
              <div className="hero-preview__footer">
                <div>
                  <strong>Our World in Data</strong>
                  <span>Checked Sep 2026</span>
                </div>
                <RightsBadge state="restricted">Rights review pending</RightsBadge>
              </div>
            </article>

            <article className="hero-preview hero-preview--calculator">
              <div className="calculator-copy">
                <p>Calculator preview</p>
                <h2>SaaS churn rate</h2>
                <span>Interface example</span>
              </div>
              <div className="calculator-fields" aria-label="Calculator interface preview">
                <label>
                  Monthly revenue
                  <span>€10,000</span>
                </label>
                <label>
                  Churn rate
                  <span>5%</span>
                </label>
              </div>
              <button className="button button--secondary" disabled type="button">
                Calculate
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className="trusted-sources" aria-labelledby="trusted-sources-heading">
        <div className="page-shell trusted-sources__inner">
          <div>
            <h2 id="trusted-sources-heading">Trusted public sources</h2>
            <p>Source candidates, not implied partnerships.</p>
          </div>
          <ul>
            {trustedSources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="featured-section" id="topics">
        <div className="page-shell">
          <div className="section-header">
            <div>
              <p className="eyebrow">Validation collection</p>
              <h2 className="section-heading">Recently checked charts</h2>
            </div>
            <Link className="text-link" href="/search">
              Browse the interface <ArrowUpRightIcon />
            </Link>
          </div>
          <div className="featured-grid">
            {designAssets.map((asset) => (
              <article className="featured-card" key={asset.slug}>
                <Link className="featured-card__preview" href={`/asset/${asset.slug}`}>
                  <ChartPreview compact variant={asset.preview} />
                </Link>
                <div className="featured-card__body">
                  <p>
                    {asset.assetType} · {asset.topic}
                  </p>
                  <h3>
                    <Link href={`/asset/${asset.slug}`}>{asset.title}</Link>
                  </h3>
                  <div className="featured-card__meta">
                    <span>{asset.source}</span>
                    <RightsBadge>Review pending</RightsBadge>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="validation-note">
            These records demonstrate the interface only. Reuse actions remain unavailable until
            asset-level rights evidence passes review.
          </p>
        </div>
      </section>

      <section className="creator-cta" id="creators">
        <div className="page-shell creator-cta__inner">
          <div>
            <p className="eyebrow">For creators</p>
            <h2 className="section-heading editorial-heading">Have useful data or a tool?</h2>
            <p>
              Publish a chart, calculator, benchmark or dataset and get discovered by publishers.
            </p>
            <span>See what publishers need and where good sources are missing.</span>
          </div>
          <div className="creator-cta__actions">
            <Link className="button button--secondary" href="/opportunities">
              See publisher demand <ArrowUpRightIcon />
            </Link>
            <Link className="text-link" href="/submit">
              Publish an asset
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
