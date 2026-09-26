import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowUpRightIcon } from "@/components/design-system";
import { JsonLd } from "@/components/json-ld";
import {
  PUBLIC_EDITORIAL_ARTICLES,
  formatEditorialMetric,
  getPublicEditorialArticle,
  type PublicEditorialArticle,
} from "@/lib/editorial/public-articles";
import { SITE_ORIGIN } from "@/lib/seo";

type InsightPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PUBLIC_EDITORIAL_ARTICLES.map(({ draft }) => ({ slug: draft.slug }));
}

export async function generateMetadata({ params }: InsightPageProps): Promise<Metadata> {
  const article = getPublicEditorialArticle((await params).slug);
  if (!article) return { title: "Insight not found", robots: { index: false, follow: false } };
  const url = `/insights/${article.draft.slug}`;
  return {
    title: article.draft.seo_title,
    description: article.draft.seo_description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: article.draft.seo_title,
      description: article.draft.seo_description,
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      siteName: "Cite Supply",
    },
    twitter: {
      card: "summary_large_image",
      title: article.draft.seo_title,
      description: article.draft.seo_description,
    },
  };
}

export default async function InsightPage({ params }: InsightPageProps) {
  const article = getPublicEditorialArticle((await params).slug);
  if (!article) notFound();

  return (
    <main className="page-shell insight-article">
      <JsonLd value={buildArticleJsonLd(article)} />
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/insights">Insights</Link>
        <span aria-hidden="true">/</span>
        <span>{article.section}</span>
      </nav>

      <article>
        <header className="insight-article__header">
          <p className="eyebrow">{article.section} · Data insight</p>
          <h1>{article.draft.title}</h1>
          <p className="insight-article__dek">{article.draft.dek}</p>
          <dl className="insight-article__meta">
            <div>
              <dt>Published</dt>
              <dd>
                <time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time>
              </dd>
            </div>
            <div>
              <dt>Primary data</dt>
              <dd>{article.sourceLabel}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{formatLabel(article.draft.format)}</dd>
            </div>
          </dl>
        </header>

        <div className="insight-article__layout">
          <div className="insight-article__body">
            {article.draft.blocks.map((block) => {
              if (block.type === "prose") return <p key={block.id}>{block.text}</p>;

              if (block.type === "data_table") {
                return (
                  <section className="insight-table-section" key={block.id}>
                    <h2>{block.heading}</h2>
                    <div className="insight-table-wrap">
                      <table>
                        <caption>{block.caption}</caption>
                        <thead>
                          <tr>
                            {block.columns.map((column) => (
                              <th key={column} scope="col">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row) => (
                            <tr key={row.label}>
                              <th scope="row">{row.label}</th>
                              {row.metric_refs.map((metricId) => {
                                const metric = article.metrics.get(metricId);
                                return (
                                  <td key={metricId}>
                                    {metric ? formatEditorialMetric(metric) : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              }

              if (block.type === "asset_link") {
                return (
                  <aside className="insight-asset-link" key={block.id}>
                    <div>
                      <p className="eyebrow">Underlying asset</p>
                      <h2>{block.label}</h2>
                      <p>{block.context}</p>
                    </div>
                    <Link className="button button--secondary" href={`/asset/${block.asset_slug}`}>
                      Open asset <ArrowUpRightIcon />
                    </Link>
                  </aside>
                );
              }

              return (
                <section className={`insight-block insight-block--${block.type}`} key={block.id}>
                  <h2>{block.heading}</h2>
                  <p>{block.text}</p>
                </section>
              );
            })}
          </div>

          <aside className="insight-sources" aria-labelledby="sources-heading">
            <p className="eyebrow">Evidence</p>
            <h2 id="sources-heading">Sources</h2>
            <ol>
              {article.draft.citations.map((citation) => (
                <li key={citation.id}>
                  <a href={citation.url} rel="noreferrer" target="_blank">
                    {citation.title} <ArrowUpRightIcon />
                  </a>
                  <span>{citation.publisher}</span>
                </li>
              ))}
            </ol>
            <p className="insight-sources__note">
              Cite Supply calculated only the comparisons described in this article. Source links
              remain available so readers can inspect the original definitions and updates.
            </p>
          </aside>
        </div>
      </article>
    </main>
  );
}

function buildArticleJsonLd(article: PublicEditorialArticle): Record<string, unknown> {
  const url = `${SITE_ORIGIN}/insights/${article.draft.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.draft.title,
    description: article.draft.seo_description,
    url,
    mainEntityOfPage: url,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    inLanguage: "en",
    author: { "@id": `${SITE_ORIGIN}/#organization` },
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    citation: article.draft.citations.map((citation) => citation.url),
    about: article.section,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
