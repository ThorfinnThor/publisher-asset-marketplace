import type { Metadata } from "next";
import Link from "next/link";

import { ArrowUpRightIcon } from "@/components/design-system";
import { JsonLd } from "@/components/json-ld";
import { SITE_ORIGIN, buildBreadcrumbJsonLd } from "@/lib/seo";
import { TOPICS } from "@/lib/topics";

export const metadata: Metadata = {
  title: "Topics",
  description:
    "Browse Cite Supply charts, datasets, tables, benchmarks and calculators by subject or format.",
  alternates: { canonical: "/topics" },
  openGraph: {
    type: "website",
    url: "/topics",
    title: "Topics | Cite Supply",
    description:
      "Browse Cite Supply charts, datasets, tables, benchmarks and calculators by subject or format.",
  },
};

const formats = [
  { label: "Charts", query: "chart" },
  { label: "Tables", query: "table" },
  { label: "Datasets", query: "dataset" },
  { label: "Calculators", query: "calculator" },
  { label: "Benchmarks", query: "benchmark" },
] as const;

export default function TopicsPage() {
  return (
    <main className="page-shell topics-page">
      <JsonLd value={buildBreadcrumbJsonLd([{ name: "Topics", path: "/topics" }])} />
      <JsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Cite Supply topics",
          description: metadata.description,
          url: `${SITE_ORIGIN}/topics`,
          isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: TOPICS.map((topic, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: topic.name,
              url: `${SITE_ORIGIN}/topics/${topic.slug}`,
            })),
          },
        }}
      />
      <header className="topics-page__header">
        <p className="eyebrow">Browse by subject</p>
        <h1 className="page-title">Start with the question you are researching.</h1>
        <p className="page-intro">
          Explore subject areas across the Cite Supply catalog. Each result keeps its original
          source, freshness and reuse conditions visible before you cite or embed it.
        </p>
      </header>

      <section aria-labelledby="topic-list-heading" className="topics-page__section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Subject areas</p>
            <h2 className="section-heading" id="topic-list-heading">
              Browse the catalog by topic
            </h2>
          </div>
        </div>
        <div className="topics-grid">
          {TOPICS.map((topic, index) => (
            <Link className="topic-card" href={`/topics/${topic.slug}`} key={topic.name}>
              <span className="topic-card__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{topic.name}</h3>
              <p>{topic.description}</p>
              <span className="text-link">
                Explore topic <ArrowUpRightIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="format-list-heading" className="topics-formats">
        <div>
          <p className="eyebrow">Browse another way</p>
          <h2 className="section-heading" id="format-list-heading">
            Choose a format
          </h2>
          <p>
            Go directly to the catalog and narrow the results with its source and rights filters.
          </p>
        </div>
        <div className="topics-formats__links">
          {formats.map((format) => (
            <Link href={`/search?q=${encodeURIComponent(format.query)}`} key={format.label}>
              {format.label} <ArrowUpRightIcon />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
