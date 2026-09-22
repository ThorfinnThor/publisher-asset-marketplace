import type { Metadata } from "next";
import Link from "next/link";

import { publicContactEmail, siteBrand, siteIdentity } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Legal notice",
  description: `Provider information and legal notices for ${siteBrand.name}.`,
  alternates: { canonical: "/legal-notice" },
  robots: { index: false, follow: true },
};

export default function LegalNoticePage() {
  return (
    <main className="page-shell legal-page">
      <header className="legal-page__header">
        <p className="eyebrow">Legal information</p>
        <h1 className="page-title">Legal notice</h1>
        <p className="page-intro">
          Provider information under Section 5 of the German Digital Services Act (DDG).
        </p>
      </header>

      <div className="legal-page__layout">
        <article className="legal-page__content">
          <section className="legal-page__section" aria-labelledby="provider-heading">
            <h2 id="provider-heading">Service provider</h2>
            <address>
              {siteIdentity.operatorName}
              <br />
              {siteIdentity.businessName}, {siteIdentity.legalForm}
              <br />
              {siteIdentity.street}
              <br />
              {siteIdentity.postalCode} {siteIdentity.city}
              <br />
              {siteIdentity.country}
            </address>
          </section>

          <section className="legal-page__section" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Contact</h2>
            <p>
              Email: <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
            </p>
            <p>
              This address is the direct electronic contact for general enquiries, privacy requests,
              and content or rights notices. Please use the structured information on the{" "}
              <Link href="/report">report-content page</Link> for complaints about a listing.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="editorial-heading">
            <h2 id="editorial-heading">Editorial responsibility</h2>
            <p>
              Responsible for journalistic-editorial content under Section 18(2) of the German
              Interstate Media Treaty (MStV): {siteIdentity.operatorName}, at the address stated
              above.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="service-heading">
            <h2 id="service-heading">About the service</h2>
            <p>
              {siteBrand.name} is a commercial discovery and publishing service for charts,
              datasets, calculators, tables, benchmarks, and widgets. Source names and trademarks
              identify the origin of listed material; they do not imply endorsement, sponsorship, or
              partnership unless expressly stated.
            </p>
            <p>
              Rights labels and automated checks provide practical information but are not legal
              advice and do not replace a publisher&apos;s own assessment of the source terms and
              the intended use.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="liability-heading">
            <h2 id="liability-heading">Content and external links</h2>
            <p>
              We prepare our own content with reasonable care. Listings can also contain information
              supplied by creators or retrieved from public sources. We do not guarantee that
              third-party data, external websites, or source-hosted embeds are complete, current, or
              continuously available. The operator of the linked service remains responsible for its
              content.
            </p>
            <p>
              If we become aware of a specific legal infringement, we will review the affected
              listing and may restrict or remove it. Please report the exact URL and the reason for
              the complaint through our <Link href="/report">notice-and-action process</Link>.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="rights-heading">
            <h2 id="rights-heading">Copyright and database rights</h2>
            <p>
              Original text, design, software, and marketplace structure are protected by applicable
              intellectual-property law. Third-party charts, data, logos, and tools remain subject
              to their respective source terms. A listing or preview does not transfer ownership and
              does not grant rights beyond the asset-specific reuse conditions shown on the service.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="disputes-heading">
            <h2 id="disputes-heading">Consumer dispute resolution</h2>
            <p>
              The operator is neither willing nor obliged to participate in dispute-resolution
              proceedings before a consumer arbitration board. The former EU online dispute
              resolution platform is no longer available and is therefore not linked here.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="documents-heading">
            <h2 id="documents-heading">Related documents</h2>
            <p>
              <Link href="/privacy">Privacy policy</Link>,{" "}
              <Link href="/creator/terms">Creator Terms</Link>, and{" "}
              <Link href="/report">Report content or a rights issue</Link>.
            </p>
          </section>
        </article>

        <aside className="legal-page__aside">
          <div className="detail-panel detail-panel--compact">
            <p className="eyebrow">Direct contact</p>
            <h2>{siteBrand.name}</h2>
            <p>
              <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
            </p>
            <p>Last updated: 22 September 2026.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
