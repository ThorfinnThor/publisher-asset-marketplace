import type { Metadata } from "next";
import Link from "next/link";

import { ArrowUpRightIcon } from "@/components/design-system";
import {
  PUBLIC_EDITORIAL_ARTICLES,
  editorialArticleWordCount,
} from "@/lib/editorial/public-articles";

export const metadata: Metadata = {
  title: "Data insights",
  description:
    "Source-led explanations and original comparisons built from the reviewed data on Cite Supply.",
  alternates: { canonical: "/insights" },
  openGraph: {
    type: "website",
    url: "/insights",
    title: "Data insights | Cite Supply",
    description:
      "Source-led explanations and original comparisons built from the reviewed data on Cite Supply.",
  },
};

export default function InsightsPage() {
  return (
    <main className="page-shell insights-index">
      <header className="insights-index__header">
        <p className="eyebrow">Cite Supply insights</p>
        <h1 className="page-title">Read the data, not just the headline.</h1>
        <p className="page-intro">
          Original comparisons and plain-language explainers built from reviewed source data. Every
          article links to its underlying asset, method and primary sources.
        </p>
      </header>

      <section aria-labelledby="latest-insights-heading" className="insights-index__section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Published analysis</p>
            <h2 className="section-heading" id="latest-insights-heading">
              Four evidence-led reads
            </h2>
          </div>
          <p>Each article is independently structured and contains at least 500 words.</p>
        </div>

        <div className="insight-grid">
          {PUBLIC_EDITORIAL_ARTICLES.map((article) => (
            <article className="insight-card" key={article.draft.slug}>
              <div className="insight-card__meta">
                <span>{article.section}</span>
                <span>
                  {editorialArticleWordCount(article.draft).toLocaleString("en-US")} words
                </span>
              </div>
              <h3>
                <Link href={`/insights/${article.draft.slug}`}>{article.draft.title}</Link>
              </h3>
              <p>{article.draft.dek}</p>
              <div className="insight-card__footer">
                <span>{article.sourceLabel}</span>
                <Link className="text-link" href={`/insights/${article.draft.slug}`}>
                  Read insight <ArrowUpRightIcon />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
