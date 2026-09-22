import type { Metadata } from "next";
import Link from "next/link";

import { publicContactEmail } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Report content or a rights issue",
  description: "How to report unlawful content, incorrect rights information, or a listing issue.",
  alternates: { canonical: "/report" },
  robots: { index: false, follow: true },
};

export default function ReportPage() {
  return (
    <main className="page-shell legal-page">
      <header className="legal-page__header">
        <p className="eyebrow">Notice and action</p>
        <h1 className="page-title">Report content or a rights issue</h1>
        <p className="page-intro">
          Tell us about a specific marketplace listing that may be unlawful, misleading, insecure,
          or published without the necessary permission.
        </p>
      </header>

      <div className="legal-page__layout">
        <article className="legal-page__content">
          <section className="legal-page__section" aria-labelledby="submit-heading">
            <h2 id="submit-heading">Submit a notice</h2>
            <p>
              Email your notice to <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
              . A sufficiently specific notice should include:
            </p>
            <ul>
              <li>the exact Cite Supply asset URL,</li>
              <li>the information at issue and why it should be restricted or removed,</li>
              <li>the relevant right, licence term, or legal basis, if known,</li>
              <li>supporting evidence or a link to it,</li>
              <li>a contact address for questions, and</li>
              <li>a statement that the information is accurate to the best of your knowledge.</li>
            </ul>
          </section>

          <section className="legal-page__section" aria-labelledby="process-heading">
            <h2 id="process-heading">What happens next</h2>
            <p>
              We assess the notice, may request evidence, and may temporarily limit or remove the
              listing while the issue is reviewed. Where appropriate, we inform the affected creator
              or source and document the outcome. A notice does not automatically result in removal.
            </p>
            <p>
              Urgent security reports should clearly say <strong>Security issue</strong> in the
              subject line and avoid including credentials, private URLs, or unnecessary personal
              data.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="creator-heading">
            <h2 id="creator-heading">Your own listings</h2>
            <p>
              Signed-in creators can remove their own assets from the creator dashboard. If account
              access is unavailable, contact us from the email address linked to the account. The{" "}
              <Link href="/creator/terms">Creator Terms</Link> explain the continuing effect of
              previously copied embed code.
            </p>
          </section>
        </article>

        <aside className="legal-page__aside">
          <div className="detail-panel detail-panel--compact">
            <p className="eyebrow">Privacy</p>
            <p>
              Send only the personal data needed to understand and process the notice. Details about
              handling messages are in our <Link href="/privacy">privacy policy</Link>.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
