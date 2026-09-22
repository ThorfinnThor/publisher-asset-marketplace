import type { Metadata } from "next";
import Link from "next/link";

import { publicContactEmail, siteBrand, siteIdentity } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${siteBrand.name} processes personal data, cookies, usage signals, and submissions.`,
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="page-shell legal-page">
      <header className="legal-page__header">
        <p className="eyebrow">Data protection</p>
        <h1 className="page-title">Privacy policy</h1>
        <p className="page-intro">
          This policy explains which personal data Cite Supply processes, why it is needed, where it
          is handled, and which choices and rights you have.
        </p>
      </header>

      <div className="legal-page__layout">
        <article className="legal-page__content">
          <PrivacySection title="1. Controller">
            <address>
              {siteIdentity.operatorName}
              <br />
              {siteIdentity.businessName}, {siteIdentity.legalForm}
              <br />
              {siteIdentity.street}
              <br />
              {siteIdentity.postalCode} {siteIdentity.city}, {siteIdentity.country}
            </address>
            <p>
              Email: <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
            </p>
          </PrivacySection>

          <PrivacySection title="2. Hosting, delivery, and security logs">
            <p>
              Cite Supply is deployed on Cloudflare&apos;s infrastructure. Cloudflare Workers
              delivers the application; D1 stores relational application data; R2 stores submitted
              preview images; Analytics Engine receives compact embed-usage measurements; and
              Cloudflare security, DNS, and network services protect and deliver the website.
            </p>
            <p>
              When you request a page, technical data such as IP address, date and time, requested
              URL, response status, referrer, user agent, and security signals can be processed to
              deliver the request, diagnose errors, prevent abuse, and maintain the service. The
              legal basis is Article 6(1)(f) GDPR (secure and reliable operation) and, where
              necessary to provide an account feature, Article 6(1)(b) GDPR.
            </p>
            <p>
              Cloudflare acts as a processor for the configured services. Processing can take place
              through Cloudflare&apos;s global network, including outside the EEA. Cloudflare&apos;s
              Data Processing Addendum describes safeguards including the EU Standard Contractual
              Clauses. See Cloudflare&apos;s{" "}
              <a href="https://www.cloudflare.com/cloudflare-customer-dpa/">
                Data Processing Addendum
              </a>{" "}
              and <a href="https://www.cloudflare.com/gdpr/subprocessors/">sub-processor list</a>.
            </p>
          </PrivacySection>

          <PrivacySection title="3. Accounts and sign-in">
            <p>
              Creator accounts can use GitHub or Google OAuth. When you choose a provider, you are
              redirected to that provider and it learns that you are attempting to sign in to Cite
              Supply. We receive the provider account identifier and, depending on the provider and
              your settings, display name, website URL, verified email address, and verification
              status. We store linked sign-in identities so that you can return to the same profile.
            </p>
            <p>
              Authentication uses secure, HttpOnly, SameSite cookies for the signed-in session and
              short-lived OAuth state, nonce, or account-linking checks. The regular session cookie
              lasts up to 30 days. These cookies are necessary to provide the sign-in and account
              service you request; they are not used for advertising.
            </p>
            <p>
              The legal basis is Article 6(1)(b) GDPR for account access and Article 6(1)(f) GDPR
              for fraud prevention and account security. GitHub and Google independently process
              data under their own privacy policies when their services are used: the{" "}
              <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
                GitHub Privacy Statement
              </a>{" "}
              and <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
            </p>
          </PrivacySection>

          <PrivacySection title="4. Search, asset actions, and embed measurements">
            <p>
              To improve search quality and show creators useful demand signals, we record search
              wording, normalized search wording, result counts, displayed asset identifiers and
              positions, detail views, source clicks, and embed or citation copy actions. A random
              identifier groups events only within the current browser page session. It is kept in
              memory and is not written to cookies, localStorage, or sessionStorage.
            </p>
            <p>
              When a Cite Supply embed is actually requested inside an iframe, we count the load. If
              a referring publisher origin is available, it is stored as a deterministic SHA-256
              hash instead of in plain text. Missing or suppressed referrers still increase the
              aggregate load count but do not create a publisher-site count. We do not store the
              referring page path in this process.
            </p>
            <p>
              These measurements are based on Article 6(1)(f) GDPR: understanding whether search and
              publishing features work, protecting the service from manipulation, and reporting
              aggregated performance to creators. They are not used for cross-site advertising or
              sold to data brokers. You can object through the contact address above.
            </p>
          </PrivacySection>

          <PrivacySection title="5. Submissions, scans, and preview images">
            <p>
              When you submit an asset, we process the canonical, embed, attribution, and preview
              URLs; title and description; source identity; rights declarations; Creator Terms
              acceptance; technical scan results; account identifier; review history; and related
              timestamps. If you upload a preview, the image and technical metadata are stored in
              Cloudflare R2. Automated scanners may retrieve the public URL you provide and record
              availability, metadata, embed restrictions, and a temporary preview.
            </p>
            <p>
              Processing is necessary to perform the creator agreement under Article 6(1)(b) GDPR
              and to protect the marketplace and publishers under Article 6(1)(f) GDPR. Public
              listing data and approved previews are visible to visitors. Do not submit credentials,
              private URLs, or personal data that should not be published.
            </p>
          </PrivacySection>

          <PrivacySection title="6. Source previews, embeds, and external links">
            <p>
              Some preview images and embeds are delivered directly by the named data source or the
              creator&apos;s approved host. Loading that content sends a request to the external
              host, which can receive technical request data such as your IP address, user agent,
              and the requested resource. Opening a source link also transfers you to that provider.
              The external provider is responsible for its own processing and terms.
            </p>
            <p>
              Cite Supply does not intentionally use third-party media for behavioural advertising.
              Asset pages identify the source. Opening some pages automatically loads an approved
              source preview; interactive embeds load only when the corresponding preview or embed
              is opened.
            </p>
          </PrivacySection>

          <PrivacySection title="7. Email and reports">
            <p>
              Messages sent to {publicContactEmail} are processed with the sender address, message,
              attachments, and related correspondence to answer the request, handle a rights notice,
              or establish, exercise, or defend legal claims. Cloudflare Email Routing forwards
              incoming mail to a verified destination mailbox; that mailbox provider also processes
              the message for delivery and storage.
            </p>
            <p>
              The legal basis is Article 6(1)(b), Article 6(1)(c), or Article 6(1)(f) GDPR depending
              on the request. Do not send passwords or unnecessary sensitive information.
            </p>
          </PrivacySection>

          <PrivacySection title="8. Cookies and browser storage">
            <p>
              Public browsing does not use Cite Supply advertising cookies or persist an analytics
              identifier in browser storage. Necessary authentication cookies are set only when you
              start or use sign-in, account linking, or the creator dashboard. Because these cookies
              provide an expressly requested security and account function, they are treated as
              strictly necessary under Section 25(2) TDDDG.
            </p>
            <p>
              If future features require non-essential cookies or comparable device storage, they
              will not be activated before the required information and consent controls are added.
            </p>
          </PrivacySection>

          <PrivacySection title="9. Recipients and international transfers">
            <p>
              Data is disclosed only where needed to operate the service, comply with law, or
              protect legal rights. Relevant recipients can include Cloudflare and its
              sub-processors, the selected OAuth provider, the destination email provider,
              professional advisers, and authorities where disclosure is legally required. Approved
              listing content is public.
            </p>
            <p>
              Where data is transferred outside the EEA without an adequacy decision, the transfer
              is based on an applicable safeguard such as the EU Standard Contractual Clauses, plus
              supplementary measures where required.
            </p>
          </PrivacySection>

          <PrivacySection title="10. Retention">
            <ul>
              <li>Authentication sessions expire after no more than 30 days.</li>
              <li>
                Account, submission, and listing records are kept while the account or listing is
                active and afterwards where needed for contractual, security, evidence, or statutory
                retention purposes.
              </li>
              <li>
                Public preview images are retained while used by a listing. Unreferenced R2 previews
                are tracked by a safety process and become eligible for deletion only after the
                configured retention and confirmation periods.
              </li>
              <li>
                Search and asset events, embed aggregates, hashed publisher origins, scan jobs, and
                operational logs are kept only for the period needed for product analysis, security,
                troubleshooting, and abuse prevention, then deleted or aggregated.
              </li>
              <li>
                Correspondence is retained until the request is resolved and longer only where legal
                claims or statutory duties require it.
              </li>
            </ul>
          </PrivacySection>

          <PrivacySection title="11. Your rights">
            <p>
              Subject to the GDPR&apos;s conditions, you can request access, correction, deletion,
              restriction, data portability, and information about recipients. You can object to
              processing based on Article 6(1)(f) GDPR. Where processing relies on consent, you can
              withdraw it for the future. You also have the right to lodge a complaint with a data
              protection supervisory authority; the competent Berlin authority is the Berlin
              Commissioner for Data Protection and Freedom of Information. You can find its current
              contact details on the{" "}
              <a href="https://www.datenschutz-berlin.de/">authority&apos;s official website</a>.
            </p>
            <p>
              Send requests to <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>. We
              may need information to verify that the request relates to you. There is no solely
              automated decision-making producing legal or similarly significant effects.
            </p>
          </PrivacySection>

          <PrivacySection title="12. Changes">
            <p>
              We update this policy when the service, providers, or legal requirements change. The
              current version is published here. Last updated: 22 September 2026.
            </p>
          </PrivacySection>
        </article>

        <aside className="legal-page__aside">
          <div className="detail-panel detail-panel--compact">
            <p className="eyebrow">Privacy contact</p>
            <h2>Your data questions</h2>
            <p>
              <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
            </p>
            <ul className="creator-guide__list">
              <li>No advertising cookies.</li>
              <li>No persistent browser analytics ID.</li>
              <li>OAuth only when you choose a provider.</li>
              <li>Cloudflare hosts and protects the service.</li>
            </ul>
            <p>
              <Link href="/legal-notice">View the legal notice</Link>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function PrivacySection({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `privacy-${title.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}`;
  return (
    <section className="legal-page__section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
