import type { Metadata } from "next";
import Link from "next/link";

import { ArrowUpRightIcon, RightsBadge, SearchIcon } from "@/components/design-system";
import { getPublishedAssetCount } from "@/lib/assets/count";
import { getDatabase } from "@/lib/db/client";
import { designAssets } from "@/lib/design-assets";
import { siteBrand } from "@/lib/site-identity";

const trendingQueries = ["Internet access", "Population", "Solar photovoltaic", "Life expectancy"];
const trustedSources = ["Our World in Data", "World Bank Open Data", "Eurostat"];

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const assetCount = await loadPublishedAssetCount();

  return (
    <main>
      <section className="home-hero">
        <div className="page-shell home-hero__grid">
          <div className="home-hero__copy">
            <p className="eyebrow">{siteBrand.tagline}</p>
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
            <div className="catalog-count" aria-label="Published asset count">
              <strong>{assetCount === null ? "—" : assetCount.toLocaleString("en-US")}</strong>
              <span>published assets in the catalog</span>
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
              <img
                alt="Our World in Data chart showing the share of individuals using the Internet"
                className="hero-preview__source-image"
                decoding="async"
                src={designAssets[1].previewUrl}
              />
              <div className="hero-preview__footer">
                <div>
                  <strong>Our World in Data</strong>
                  <span>Checked Sep 2026</span>
                </div>
                <RightsBadge state="verified">Source data</RightsBadge>
              </div>
            </article>

            <Link
              aria-label="Open Solar photovoltaic module prices"
              className="hero-preview hero-preview--secondary-chart"
              href={`/asset/${designAssets[2].slug}`}
            >
              <div className="hero-preview__heading">
                <div>
                  <p>Chart preview</p>
                  <h2>{designAssets[2].title}</h2>
                </div>
                <span className="source-monogram" aria-label="Source: Our World in Data">
                  OWID
                </span>
              </div>
              <img
                alt={`Our World in Data chart: ${designAssets[2].title}`}
                className="hero-preview__source-image"
                decoding="async"
                src={designAssets[2].previewUrl}
              />
              <span className="hero-preview__open">
                Open real asset <ArrowUpRightIcon />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="trusted-sources" aria-labelledby="trusted-sources-heading">
        <div className="page-shell trusted-sources__inner">
          <div>
            <h2 id="trusted-sources-heading">Reviewed public sources</h2>
            <p>Sources represented in the catalog; no partnership implied.</p>
          </div>
          <ul>
            {trustedSources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      </section>

      <ProcessSection
        actionHref="/search"
        actionLabel="Browse assets"
        description="Cite Supply brings publisher-ready charts, tables, datasets, calculators and benchmarks into one searchable catalog."
        eyebrow="For publishers"
        id="publishers"
        steps={[
          {
            title: "Find the right asset",
            description:
              "Search by topic, format or source and choose an asset that fits your article.",
          },
          {
            title: "Check the details",
            description:
              "Preview the real data, source, freshness, attribution and permitted uses before publishing.",
          },
          {
            title: "Copy and publish",
            description:
              "Copy the approved embed or citation with one click and paste it into your content.",
          },
        ]}
        title="Find it. Check it. Publish it."
      />

      <section className="featured-section">
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
                  <img
                    alt={`Our World in Data chart: ${asset.title}`}
                    className="featured-card__source-image"
                    decoding="async"
                    loading="lazy"
                    src={asset.previewUrl}
                  />
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
                    <RightsBadge state="verified">Source data</RightsBadge>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="validation-note">
            These previews are generated from the cited Our World in Data charts. Open an asset to
            review its current reuse conditions and publisher actions.
          </p>
        </div>
      </section>

      <ProcessSection
        actionHref="/submit"
        actionLabel="Publish an asset"
        description="Have a useful chart, table, dataset, calculator, benchmark or widget? Add it without uploading code."
        eyebrow="For creators"
        id="for-creators"
        secondaryAction={{ href: "/creator/guide", label: "Read the creator guide" }}
        steps={[
          {
            title: "Sign in",
            description:
              "Use Google or GitHub to create a creator profile or return to your existing account.",
          },
          {
            title: "Add your asset",
            description:
              "Paste its public URL, add the source and rights details, and provide a real preview.",
          },
          {
            title: "Pass checks and go live",
            description:
              "Automated checks validate the URLs and permissions. Passing assets are published in the catalog.",
          },
        ]}
        title="Publish in three simple steps."
        variant="dark"
      />
    </main>
  );
}

async function loadPublishedAssetCount(): Promise<number | null> {
  try {
    return await getPublishedAssetCount(getDatabase());
  } catch {
    return null;
  }
}

type ProcessStep = {
  title: string;
  description: string;
};

function ProcessSection({
  actionHref,
  actionLabel,
  description,
  eyebrow,
  id,
  secondaryAction,
  steps,
  title,
  variant = "light",
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  eyebrow: string;
  id: string;
  secondaryAction?: { href: string; label: string };
  steps: ProcessStep[];
  title: string;
  variant?: "light" | "dark";
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={`process-section process-section--${variant}`}
      id={id}
    >
      <div className="page-shell process-section__inner">
        <div className="process-section__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="section-heading" id={headingId}>
              {title}
            </h2>
            <p>{description}</p>
          </div>
          <div className="process-section__actions">
            <Link className="button button--primary" href={actionHref}>
              {actionLabel}
            </Link>
            {secondaryAction ? (
              <Link className="text-link" href={secondaryAction.href}>
                {secondaryAction.label} <ArrowUpRightIcon />
              </Link>
            ) : null}
          </div>
        </div>
        <ol className="process-grid">
          {steps.map((step, index) => (
            <li className="process-card" key={step.title}>
              <span aria-hidden="true" className="process-card__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
