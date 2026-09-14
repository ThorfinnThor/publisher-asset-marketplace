import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArrowUpRightIcon, ChartPreview, CopyIcon, RightsBadge } from "@/components/design-system";
import { findDesignAsset } from "@/lib/design-assets";

export const metadata: Metadata = {
  title: "Asset",
};

type AssetPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AssetPage({ params }: AssetPageProps) {
  const { slug } = await params;
  const asset = findDesignAsset(slug);

  if (!asset) {
    notFound();
  }

  return (
    <main className="asset-detail page-shell">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <a href="/search">Browse</a>
        <span aria-hidden="true">/</span>
        <span>{asset.topic}</span>
      </nav>

      <section className="asset-detail__hero">
        <div className="asset-detail__copy">
          <div className="asset-type-line">
            <span>{asset.assetType}</span>
            <span aria-hidden="true">·</span>
            <span>{asset.topic}</span>
          </div>
          <h1>{asset.title}</h1>
          <p>{asset.description}</p>

          <dl className="asset-detail__meta">
            <div>
              <dt>Source</dt>
              <dd>{asset.source}</dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>{asset.checkedAt}</dd>
            </div>
            <div>
              <dt>Rights status</dt>
              <dd>
                <RightsBadge state="restricted">Review pending</RightsBadge>
              </dd>
            </div>
          </dl>

          <div className="asset-detail__actions">
            <button className="button" disabled type="button">
              <CopyIcon /> Copy embed
            </button>
            <button className="button button--secondary" disabled type="button">
              <CopyIcon /> Copy citation
            </button>
            <a
              className="button button--secondary"
              href={asset.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              View source <ArrowUpRightIcon />
            </a>
          </div>
          <p className="action-note">
            Copy actions become available only after asset-level rights review.
          </p>
        </div>

        <div className="asset-detail__preview">
          <ChartPreview variant={asset.preview} />
          <p>Interface preview only—not source data.</p>
        </div>
      </section>

      <div className="asset-detail__columns">
        <section className="detail-panel" aria-labelledby="rights-heading">
          <div className="detail-panel__heading">
            <div>
              <p className="eyebrow">Reuse conditions</p>
              <h2 id="rights-heading">Usage rights</h2>
            </div>
            <RightsBadge state="restricted">Awaiting evidence review</RightsBadge>
          </div>
          <dl className="rights-table">
            {[
              "Commercial use",
              "Embed",
              "Modification",
              "Attribution",
              "Raw data redistribution",
            ].map((right) => (
              <div key={right}>
                <dt>{right}</dt>
                <dd>Unknown</dd>
              </div>
            ))}
          </dl>
          <a
            className="evidence-link"
            href="https://ourworldindata.org/faqs"
            rel="noreferrer"
            target="_blank"
          >
            View source policy awaiting classification <ArrowUpRightIcon />
          </a>
        </section>

        <div className="detail-stack">
          <section
            className="detail-panel detail-panel--compact"
            aria-labelledby="citation-heading"
          >
            <div className="detail-panel__heading">
              <div>
                <p className="eyebrow">Publisher workflow</p>
                <h2 id="citation-heading">Citation</h2>
              </div>
              <button className="button button--secondary button--small" disabled type="button">
                <CopyIcon /> Copy
              </button>
            </div>
            <p className="code-preview">
              Citation text will be generated from reviewed source metadata.
            </p>
          </section>

          <section className="detail-panel detail-panel--compact" aria-labelledby="embed-heading">
            <div className="detail-panel__heading">
              <div>
                <p className="eyebrow">Source-hosted only</p>
                <h2 id="embed-heading">Embed</h2>
              </div>
              <button className="button button--secondary button--small" disabled type="button">
                <CopyIcon /> Copy
              </button>
            </div>
            <p className="code-preview">Approved embed code will appear after review.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
