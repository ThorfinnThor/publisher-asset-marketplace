import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowUpRightIcon } from "@/components/design-system";
import { JsonLd } from "@/components/json-ld";
import { getDatabase } from "@/lib/db/client";
import { buildBreadcrumbJsonLd, SITE_ORIGIN } from "@/lib/seo";
import { searchAssets, type SearchAsset } from "@/lib/search/search-assets";
import { getTopic, TOPICS } from "@/lib/topics";

type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return TOPICS.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const topic = getTopic((await params).slug);
  if (!topic) return { title: "Topic not found", robots: { index: false, follow: false } };
  const url = `/topics/${topic.slug}`;
  return {
    title: topic.seoTitle,
    description: topic.seoDescription,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      url,
      title: `${topic.seoTitle} | Cite Supply`,
      description: topic.seoDescription,
      siteName: "Cite Supply",
    },
    twitter: {
      card: "summary_large_image",
      title: `${topic.seoTitle} | Cite Supply`,
      description: topic.seoDescription,
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const topic = getTopic((await params).slug);
  if (!topic) notFound();
  const assets = await loadTopicAssets(topic.query);
  const pageUrl = `${SITE_ORIGIN}/topics/${topic.slug}`;

  return (
    <main className="page-shell topic-detail">
      <JsonLd
        value={buildBreadcrumbJsonLd([
          { name: "Topics", path: "/topics" },
          { name: topic.name, path: `/topics/${topic.slug}` },
        ])}
      />
      <JsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: topic.name,
          description: topic.seoDescription,
          url: pageUrl,
          isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: assets.length,
            itemListElement: assets.map((asset, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: asset.title,
              url: `${SITE_ORIGIN}/asset/${asset.slug}`,
            })),
          },
        }}
      />

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/topics">Topics</Link>
        <span aria-hidden="true">/</span>
        <span>{topic.name}</span>
      </nav>

      <header className="topic-detail__header">
        <p className="eyebrow">Cite Supply topic</p>
        <h1>{topic.name}</h1>
        <p className="topic-detail__dek">{topic.description}</p>
      </header>

      <section className="topic-detail__overview" aria-label={`${topic.name} overview`}>
        <div className="topic-detail__introduction">
          {topic.introduction.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <aside className="topic-detail__questions" aria-labelledby="research-questions-heading">
          <p className="eyebrow">Research checklist</p>
          <h2 id="research-questions-heading">Questions to settle first</h2>
          <ul>
            {topic.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="topic-detail__assets" aria-labelledby="topic-assets-heading">
        <div className="section-header">
          <div>
            <p className="eyebrow">Reviewed catalog</p>
            <h2 className="section-heading" id="topic-assets-heading">
              Selected {topic.name.toLowerCase()} assets
            </h2>
          </div>
          <Link className="text-link" href={`/search?q=${encodeURIComponent(topic.query)}`}>
            Browse all matches <ArrowUpRightIcon />
          </Link>
        </div>

        {assets.length > 0 ? (
          <div className="topic-asset-grid">
            {assets.map((asset) => (
              <article className="topic-asset-card" key={asset.slug}>
                <p className="topic-asset-card__meta">
                  {formatAssetType(asset.asset_type)} · {asset.source_name || "Independent source"}
                </p>
                <h3>
                  <Link href={`/asset/${asset.slug}`}>{asset.title}</Link>
                </h3>
                <p>{asset.description}</p>
                <div className="topic-asset-card__footer">
                  <span>{formatDate(asset.source_updated_at)}</span>
                  <Link className="text-link" href={`/asset/${asset.slug}`}>
                    Review asset <ArrowUpRightIcon />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No reviewed selection is available right now.</h3>
            <p>Browse the full catalog to see newer or non-indexed matching assets.</p>
            <Link className="button button--secondary" href={`/search?q=${topic.query}`}>
              Search the catalog
            </Link>
          </div>
        )}
      </section>

      <aside className="topic-detail__guidance" aria-labelledby="source-guidance-heading">
        <p className="eyebrow">Before publishing</p>
        <h2 id="source-guidance-heading">Read the measure, not only the label.</h2>
        <p>{topic.sourceGuidance}</p>
      </aside>
    </main>
  );
}

async function loadTopicAssets(query: string): Promise<SearchAsset[]> {
  try {
    const result = await searchAssets(getDatabase(), {
      query,
      filters: { rights_statuses: ["safe"], search_indexable_only: true },
      limit: 12,
    });
    return result.results.map(({ asset }) => asset);
  } catch {
    return [];
  }
}

function formatAssetType(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "Update date unavailable";
  return `Updated ${new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))}`;
}
