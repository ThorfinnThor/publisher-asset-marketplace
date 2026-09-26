import type { Metadata } from "next";
import Link from "next/link";

import { ArrowUpRightIcon } from "@/components/design-system";

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

const topics = [
  {
    name: "Population and society",
    description: "Population, migration, households, cities and social conditions.",
    query: "population",
  },
  {
    name: "Economy and finance",
    description: "Growth, prices, trade, banking, public finance and business indicators.",
    query: "economy",
  },
  {
    name: "Health",
    description: "Life expectancy, mortality, healthcare and public-health measures.",
    query: "health",
  },
  {
    name: "Energy and climate",
    description: "Electricity, renewables, emissions, climate and energy prices.",
    query: "energy",
  },
  {
    name: "Technology and infrastructure",
    description: "Internet access, digital adoption, transport and infrastructure.",
    query: "internet",
  },
  {
    name: "Education and work",
    description: "Education, skills, employment, wages and labor-market indicators.",
    query: "education",
  },
  {
    name: "Environment and land",
    description: "Land use, agriculture, forests, biodiversity, water and wildfires.",
    query: "environment",
  },
  {
    name: "Publisher tools",
    description: "Calculators, benchmarks and interactive tools made for practical use.",
    query: "calculator",
  },
] as const;

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
          {topics.map((topic, index) => (
            <Link
              className="topic-card"
              href={`/search?q=${encodeURIComponent(topic.query)}`}
              key={topic.name}
            >
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
