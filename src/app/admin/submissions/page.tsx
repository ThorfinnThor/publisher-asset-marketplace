import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submission moderation",
  robots: { index: false, follow: false },
};

export default function AdminSubmissionsPage() {
  return (
    <main className="page-shell dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Submission review</h1>
          <p className="page-intro">Review source identity, reuse evidence and embed safety.</p>
        </div>
      </header>
      <div className="notice dashboard-notice">
        <strong>Queue inactive.</strong> Manual moderation is implemented after publisher search and
        analytics pass their launch gates.
      </div>
      <section className="dashboard-table" aria-labelledby="moderation-table-heading">
        <div className="dashboard-table__heading">
          <div>
            <h2 id="moderation-table-heading">Pending submissions</h2>
            <p>Nothing is published automatically.</p>
          </div>
          <span className="result-count">0 pending</span>
        </div>
        <div className="empty-state empty-state--standalone">
          <strong>No submissions to review</strong>
          <span>The moderation queue is not collecting submissions yet.</span>
        </div>
      </section>
    </main>
  );
}
