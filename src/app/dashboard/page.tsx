import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  const metrics = [
    ["Assets", "0"],
    ["Search impressions", "—"],
    ["Asset views", "—"],
    ["Embed copies", "—"],
    ["Citation copies", "—"],
    ["Source clicks", "—"],
  ];

  return (
    <main className="page-shell dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Creator workspace</p>
          <h1 className="page-title">Your assets</h1>
          <p className="page-intro">Track how publishers discover and use approved assets.</p>
        </div>
        <a className="button button--secondary" href="/submit">
          Add an asset
        </a>
      </header>

      <div className="notice dashboard-notice">
        <strong>Preview mode.</strong> Creator authentication and analytics are scheduled after
        publisher search is proven. No activity data is being claimed here.
      </div>

      <section className="metric-grid" aria-label="Creator metrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-table" aria-labelledby="assets-table-heading">
        <div className="dashboard-table__heading">
          <div>
            <h2 id="assets-table-heading">Asset performance</h2>
            <p>Approved assets will appear here.</p>
          </div>
          <label>
            <span className="sr-only">Filter assets</span>
            <input className="filter-search" disabled placeholder="Filter assets…" />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Status</th>
                <th>Impressions</th>
                <th>Views</th>
                <th>Embeds</th>
                <th>Citations</th>
                <th>Source clicks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <strong>No creator assets yet</strong>
                    <span>Creator accounts open in a later milestone.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
