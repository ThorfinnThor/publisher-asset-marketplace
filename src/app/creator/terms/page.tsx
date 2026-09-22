import type { Metadata } from "next";
import Link from "next/link";

import {
  currentCreatorTermsEffectiveDate,
  currentCreatorTermsVersion,
} from "@/lib/submissions/creator-terms";
import { siteBrand } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Creator terms",
  description: `Terms for submitting and publishing assets in ${siteBrand.name}.`,
  alternates: { canonical: "/creator/terms" },
};

export default function CreatorTermsPage() {
  return (
    <main className="page-shell creator-terms-page">
      <header className="creator-terms__header">
        <p className="eyebrow">Creator agreement</p>
        <h1 className="page-title">Creator Terms</h1>
        <p className="page-intro">
          These terms govern every chart, calculator, table, dataset, benchmark, widget, preview,
          and related listing information submitted to {siteBrand.name}.
        </p>
        <div className="creator-terms__version" aria-label="Current terms version">
          <span>Version {currentCreatorTermsVersion}</span>
          <span>Effective {currentCreatorTermsEffectiveDate}</span>
        </div>
      </header>

      <div className="creator-terms__layout">
        <article className="creator-terms__content">
          <TermsSection number="01" title="Acceptance and authority">
            <p>
              You accept these terms when you select the Creator Terms checkbox and submit an asset.
              You confirm that you are legally able to accept them for yourself or are authorized to
              act for the person or organization identified as the source.
            </p>
          </TermsSection>

          <TermsSection number="02" title="Your rights and declarations">
            <p>
              You confirm that you own the necessary rights or hold sufficient permission for the
              submitted tool, data, database contents, text, preview image, branding, and every
              other submitted component. Your submission and the uses you declare must not infringe
              copyright, database rights, trademark rights, privacy rights, contractual
              restrictions, or other third-party rights.
            </p>
            <p>
              Every rights answer and attribution term must be accurate for the exact asset. You may
              use properly licensed third-party material only when its terms permit the uses you
              declare and you can provide the required attribution.
            </p>
          </TermsSection>

          <TermsSection number="03" title="Permission granted to the marketplace">
            <p>
              While the listing is active, you grant {siteBrand.name} a non-exclusive, worldwide,
              royalty-free permission to store, reproduce, resize, display, make publicly
              accessible, index, and promote the submitted metadata and preview image. This
              permission is limited to operating, securing, presenting, and promoting the
              marketplace and its asset listings.
            </p>
            <p>
              You also permit the marketplace to generate and distribute attribution and iframe
              snippets that load the source-hosted embed URL under your declared terms. The
              marketplace does not acquire ownership of your tool, source code, underlying data,
              brand, or source-hosted website and does not receive rights beyond those stated here
              and in your asset-level declarations.
            </p>
          </TermsSection>

          <TermsSection number="04" title="Commercial operation">
            <p>
              {siteBrand.name} is a commercial service and may earn revenue through fees,
              subscriptions, advertising, partnerships, or similar business models. You agree that
              your listing may appear and be promoted in this commercial environment. Commercial
              operation of the marketplace does not transfer ownership of your asset to the
              marketplace.
            </p>
          </TermsSection>

          <TermsSection number="05" title="Publisher reuse">
            <p>
              Publishers may rely on the usage permissions, restrictions, attribution terms, and
              source links that you submit. If you declare commercial embedding to be allowed, you
              authorize publishers to load the source-hosted embed in commercial or editorial
              websites subject to those declared terms. Raw-data redistribution and modification are
              allowed only when you expressly declare them.
            </p>
          </TermsSection>

          <TermsSection number="06" title="Ongoing responsibilities">
            <p>
              Keep the canonical page, embed URL, preview, attribution page, and declarations
              accurate. Inform the marketplace without undue delay if your authority ends, a
              permission changes, a third party raises a rights claim, or the asset no longer meets
              the submission requirements. Do not submit credentials, private URLs, malware,
              unlawful material, deceptive attribution, or personal data you are not permitted to
              publish.
            </p>
          </TermsSection>

          <TermsSection number="07" title="Removal and account action">
            <p>
              The marketplace may hide or remove a listing, disable embed-copy actions, request
              evidence, or suspend an account when declarations appear inaccurate, rights are
              disputed, security requirements fail, or these terms are breached. Automated checks do
              not independently prove ownership or legal permission.
            </p>
            <p>
              Delisting stops new discovery and copying through the marketplace. It does not
              automatically remove snippets already copied to third-party websites; those uses
              remain governed by the permissions and restrictions applicable when they were made.
            </p>
          </TermsSection>

          <TermsSection number="08" title="Removal requests and changed terms">
            <p>
              A creator may request delisting through the creator account. Material changes to these
              Creator Terms receive a new version. New submissions require acceptance of the current
              version; previously recorded acceptances remain attached to their submission and audit
              history.
            </p>
          </TermsSection>
        </article>

        <aside className="creator-terms__aside">
          <section className="detail-panel detail-panel--compact">
            <p className="eyebrow">Plain-language summary</p>
            <h2>You keep ownership.</h2>
            <ul className="creator-guide__list">
              <li>The marketplace may list and promote your submitted asset.</li>
              <li>Publishers receive only the permissions you declare.</li>
              <li>You must control the rights or hold sufficient permission.</li>
              <li>You must report later changes to those permissions.</li>
              <li>False declarations can lead to removal or suspension.</li>
            </ul>
            <p className="creator-terms__summary-note">
              This summary helps with reading but does not replace the full terms.
            </p>
            <Link className="button button--secondary" href="/submit">
              Return to submission
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}

function TermsSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="creator-terms__section" aria-labelledby={`creator-terms-${number}`}>
      <span className="creator-terms__number">{number}</span>
      <div>
        <h2 id={`creator-terms-${number}`}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
