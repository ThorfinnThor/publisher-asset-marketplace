import type { Metadata } from "next";
import Link from "next/link";

import {
  getPublicOpportunities,
  type PublicOpportunityData,
} from "@/lib/analytics/public-opportunities";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Publisher opportunities",
  description: "See topics where publishers are looking for useful, publishable assets.",
};

export default async function OpportunitiesPage() {
  const data = await loadOpportunities();

  return (
    <main className="page-shell opportunities-page">
      <header className="opportunities-header">
        <div>
          <p className="eyebrow">For creators</p>
          <h1 className="page-title">Build what publishers are looking for.</h1>
          <p className="page-intro">
            Explore anonymized demand signals and publish a useful chart, calculator, benchmark or
            dataset where the current supply is thin.
          </p>
        </div>
        <Link className="button button--primary" href="/submit">
          Submit an asset
        </Link>
      </header>

      <div className="notice opportunities-notice">
        <strong>Aggregate publisher demand.</strong> These buckets use the latest complete 28-day
        window ({data?.windowEnd ?? "not available"}). They show discovery opportunity, not a
        promise of traffic, publication, citations or backlinks.
      </div>

      {data ? <OpportunityContent data={data} /> : <UnavailableMessage />}
    </main>
  );
}

function OpportunityContent({ data }: { data: PublicOpportunityData }) {
  if (data.opportunities.length === 0) {
    return (
      <section className="opportunities-section" aria-labelledby="opportunities-heading">
        <div className="opportunities-section__heading">
          <p className="eyebrow">Current openings</p>
          <h2 id="opportunities-heading">No public opportunities yet.</h2>
          <p>
            Demand scoring needs a completed window and enough independent publisher activity before
            it is shown here.
          </p>
        </div>
        <div className="empty-state">
          <strong>Check back after the next scoring run.</strong>
          <span>You can still submit a reviewed asset for the marketplace.</span>
          <Link className="text-link" href="/submit">
            Open submission form
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="opportunities-section" aria-labelledby="opportunities-heading">
      <div className="opportunities-section__heading">
        <p className="eyebrow">Current openings</p>
        <h2 id="opportunities-heading">Topics with demand and low supply</h2>
        <p>Use these signals to decide what to publish next. Exact counts stay bucketed.</p>
      </div>
      <div className="opportunities-grid">
        {data.opportunities.map((opportunity) => (
          <article className="opportunity-card" key={opportunity.query}>
            <p className="eyebrow">Publisher opportunity</p>
            <h3>{opportunity.query}</h3>
            <dl>
              <div>
                <dt>Demand</dt>
                <dd>{opportunity.demand_band}</dd>
              </div>
              <div>
                <dt>Current supply</dt>
                <dd>{opportunity.supply_band}</dd>
              </div>
            </dl>
            <p className="opportunity-card__note">
              Publish a useful asset with clear source, rights and attribution details.
            </p>
            <Link className="text-link" href="/submit">
              Submit an asset
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function UnavailableMessage() {
  return (
    <div className="notice" role="status">
      <strong>Opportunities are temporarily unavailable.</strong> Try again after the next Worker
      request.
    </div>
  );
}

async function loadOpportunities(): Promise<PublicOpportunityData | null> {
  try {
    return await getPublicOpportunities(getDatabase());
  } catch {
    return null;
  }
}
