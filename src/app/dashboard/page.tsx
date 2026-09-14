import type { Metadata } from "next";

import {
  getDemandDashboard,
  type DemandDashboardData,
  type DemandSummaryRow,
  type FastestGrowingRow,
  type OpportunityDashboardRow,
} from "@/lib/analytics/demand-dashboard";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demand dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const loaded = await loadDashboard();

  if (!loaded.data) {
    return (
      <main className="page-shell dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Internal demand intelligence</p>
            <h1 className="page-title">Opportunity dashboard</h1>
            <p className="page-intro">
              Search demand is collected anonymously and shown only as aggregate opportunities.
            </p>
          </div>
        </header>
        <div className="notice dashboard-notice" role="status">
          <strong>Dashboard temporarily unavailable.</strong> The scheduled demand tables are not
          reachable yet. Try again after the next Worker run.
        </div>
      </main>
    );
  }

  const { data } = loaded;
  const snapshotLabel = data.snapshotWindowEnd
    ? `Score snapshot ending ${formatDate(data.snapshotWindowEnd)}`
    : "No score snapshot yet";

  return (
    <main className="page-shell dashboard-page demand-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Internal demand intelligence</p>
          <h1 className="page-title">Opportunity dashboard</h1>
          <p className="page-intro">
            Find publisher demand that is growing, underserved or already showing reuse intent.
          </p>
        </div>
        <span className="dashboard-snapshot">{snapshotLabel}</span>
      </header>

      <div className="notice dashboard-notice">
        <strong>Internal preview.</strong> This view uses the latest complete 28-day window. It is a
        prioritization aid, not a demand forecast, quality judgment or backlink guarantee.
      </div>

      <section className="demand-dashboard__section" aria-labelledby="top-searches-heading">
        <DashboardSectionHeading
          id="top-searches-heading"
          title="Top searches"
          description={`Most searches from ${formatDate(data.window.start)} to ${formatDate(data.window.end)}.`}
        />
        <DemandTable rows={data.topSearches} empty="No completed demand window is available yet." />
      </section>

      <section className="demand-dashboard__grid" aria-label="Demand signals">
        <DashboardPanel
          id="growth-heading"
          title="Fastest-growing queries"
          description="Compared with the preceding complete 28-day window."
        >
          <GrowthList rows={data.fastestGrowing} />
        </DashboardPanel>
        <DashboardPanel
          id="no-result-heading"
          title="No-result queries"
          description="Queries with at least five searches and the highest no-result rate."
        >
          <OpportunityList rows={data.noResultQueries} metric="noResult" />
        </DashboardPanel>
      </section>

      <section className="demand-dashboard__grid" aria-label="Supply and reuse signals">
        <DashboardPanel
          id="supply-heading"
          title="Low-supply / high-demand"
          description="Scored topics with no more than two safe and one embeddable matching assets."
        >
          <OpportunityList rows={data.lowSupplyTopics} metric="score" />
        </DashboardPanel>
        <DashboardPanel
          id="copies-heading"
          title="Top copied assets"
          description="Embed and citation copies attributed to a search event in the current window."
        >
          <CopiedAssetList data={data} />
        </DashboardPanel>
      </section>
    </main>
  );
}

async function loadDashboard(): Promise<{ data: DemandDashboardData | null }> {
  try {
    return { data: await getDemandDashboard(getDatabase()) };
  } catch {
    return { data: null };
  }
}

function DashboardSectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="demand-dashboard__heading">
      <div>
        <p className="eyebrow">Demand signal</p>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function DashboardPanel({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="demand-dashboard__panel" aria-labelledby={id}>
      <DashboardSectionHeading id={id} title={title} description={description} />
      {children}
    </section>
  );
}

function DemandTable({ rows, empty }: { rows: DemandSummaryRow[]; empty: string }) {
  if (rows.length === 0) return <DashboardEmpty message={empty} />;
  return (
    <div className="table-scroll">
      <table className="demand-table">
        <thead>
          <tr>
            <th>Query</th>
            <th>Searches</th>
            <th>No result</th>
            <th>Clicks</th>
            <th>Copies</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aggregation_key}>
              <th scope="row">{row.display_query}</th>
              <td>{formatInteger(row.searches)}</td>
              <td>{formatPercent(row.no_result_rate)}</td>
              <td>{formatInteger(row.asset_clicks)}</td>
              <td>{formatInteger(row.embed_copies + row.citation_copies)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrowthList({ rows }: { rows: FastestGrowingRow[] }) {
  if (rows.length === 0) return <DashboardEmpty message="Not enough completed demand data yet." />;
  return (
    <ul className="demand-list">
      {rows.map((row) => (
        <li key={row.aggregation_key}>
          <span>
            <strong>{row.display_query}</strong>
            <small>{formatInteger(row.searches)} searches now</small>
          </span>
          <b>{row.growth_rate === null ? "New" : `+${formatPercent(row.growth_rate)}`}</b>
        </li>
      ))}
    </ul>
  );
}

function OpportunityList({
  rows,
  metric,
}: {
  rows: OpportunityDashboardRow[];
  metric: "noResult" | "score";
}) {
  if (rows.length === 0) return <DashboardEmpty message="No qualifying query is available yet." />;
  return (
    <ul className="demand-list">
      {rows.map((row) => (
        <li key={`${row.window_end}-${row.display_query}`}>
          <span>
            <strong>{row.display_query}</strong>
            <small>
              {formatInteger(row.searches)} searches · {formatInteger(row.safe_asset_count ?? 0)}{" "}
              safe · {formatInteger(row.embeddable_asset_count ?? 0)} embeddable
            </small>
          </span>
          <b>{metric === "noResult" ? formatPercent(row.no_result_rate) : row.opportunity_score}</b>
        </li>
      ))}
    </ul>
  );
}

function CopiedAssetList({ data }: { data: DemandDashboardData }) {
  if (data.topCopiedAssets.length === 0) {
    return <DashboardEmpty message="No attributed copies in the current window." />;
  }
  return (
    <ul className="demand-list">
      {data.topCopiedAssets.map((asset) => (
        <li key={asset.slug}>
          <span>
            <strong>{asset.title}</strong>
            <small>
              {formatInteger(asset.embed_copies)} embeds · {formatInteger(asset.citation_copies)}
              citations
            </small>
          </span>
          <b>{formatInteger(asset.total_copies)}</b>
        </li>
      ))}
    </ul>
  );
}

function DashboardEmpty({ message }: { message: string }) {
  return <p className="demand-dashboard__empty">{message}</p>;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );
}
