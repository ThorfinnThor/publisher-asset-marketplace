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

          <PrivacySection title="3. Cloudflare Web Analytics">
            <p>
              Cite Supply uses Cloudflare Web Analytics, including Real User Measurements (RUM), to
              understand how public pages are used and how they perform in visitors&apos; browsers.
              The Cloudflare beacon can process the requested hostname and path, referring hostname,
              country, browser, operating system, device type, navigation type, page-load timings,
              and Core Web Vitals. Cloudflare Web Analytics does not record URL query strings.
            </p>
            <p>
              The beacon does not set analytics cookies and Cite Supply does not use a persistent
              browser identifier for this measurement. The information is used for aggregate traffic
              and performance analysis, troubleshooting, and improving the service—not for
              cross-site advertising or user profiling. Cloudflare describes Web Analytics as a
              privacy-first service that does not collect or use visitors&apos; personal data.
            </p>
            <p>
              The legal basis is Article 6(1)(f) GDPR: our legitimate interest in measuring whether
              the public service is used, detecting technical problems, and improving page
              performance. Cloudflare processes the measurements as our service provider and makes
              Web Analytics data available in the dashboard for up to six months. The beacon may not
              run when it is blocked by a browser, extension, or network setting. See the official{" "}
              <a href="https://developers.cloudflare.com/web-analytics/">
                Cloudflare Web Analytics documentation
              </a>{" "}
              and Cloudflare&apos;s{" "}
              <a href="https://www.cloudflare.com/privacypolicy/">Privacy Policy</a>.
            </p>
          </PrivacySection>

          <PrivacySection title="4. Google Analytics 4">
            <p>
              If you consent, Cite Supply uses Google Analytics 4, a web analytics service provided
              by Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland
              (&quot;Google&quot;). The purpose is audience measurement: understanding how many
              people visit the public pages, which pages they view, where visits come from, and how
              visitors move through the site, so that content and navigation can be improved.
            </p>
            <p>
              Google Analytics is loaded only after you click &quot;Accept&quot; in the cookie
              banner. Before that, and whenever you decline, no Google script is loaded and no data
              is sent to Google. Google Analytics is never loaded on sign-in, creator dashboard,
              submission or admin pages, and never inside Cite Supply embeds shown on other
              websites. We use Google Consent Mode v2 with all consent types set to
              &quot;denied&quot; by default; only analytics storage is granted after your consent.
              Advertising storage, ad personalisation, and Google signals are disabled. IP addresses
              are not logged or stored by Google Analytics 4.
            </p>
            <p>
              When active, Google Analytics sets the cookies <code>_ga</code> (distinguishes
              browsers, lifetime 2 years) and <code>_ga_&lt;container-id&gt;</code> (keeps the
              session state, lifetime 2 years) and processes usage data such as the pages visited,
              referrer, approximate location derived from the IP address, browser, operating system,
              device type, screen resolution, and time of visit. Event-level and user-level data is
              retained in Google Analytics for 14 months and then deleted automatically.
            </p>
            <p>
              The legal basis is your consent under Article 6(1)(a) GDPR and Section 25(1) TDDDG
              (formerly TTDSG). Google may process data in the United States. Google LLC is
              certified under the EU-US Data Privacy Framework, for which the European Commission
              has adopted an adequacy decision under Article 45 GDPR; in addition, Google relies on
              the EU Standard Contractual Clauses.
            </p>
            <p>
              Your choice is stored in your browser&apos;s localStorage. You can withdraw your
              consent at any time with effect for the future via &quot;Cookie settings&quot; in the
              footer of every page; the Google Analytics cookies are then deleted and no further
              data is sent. See Google&apos;s{" "}
              <a href="https://policies.google.com/privacy">Privacy Policy</a> and{" "}
              <a href="https://business.safety.google/adsprocessorterms/">data processing terms</a>.
            </p>
          </PrivacySection>

          <PrivacySection title="5. Accounts and sign-in">
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

          <PrivacySection title="6. Search, asset actions, and embed measurements">
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

          <PrivacySection title="7. Submissions, scans, and preview images">
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

          <PrivacySection title="8. Source previews, embeds, and external links">
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

          <PrivacySection title="9. Email and reports">
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

          <PrivacySection title="10. Cookies and browser storage">
            <p>
              Public browsing does not use Cite Supply advertising cookies. Cloudflare Web Analytics
              does not set analytics cookies or persist an analytics identifier in browser storage.
              Google Analytics cookies are set only after you accept them in the cookie banner (see
              section 4); your choice is remembered in localStorage under{" "}
              <code>citesupply-analytics-consent-v1</code> and can be changed at any time via
              &quot;Cookie settings&quot; in the footer. Necessary authentication cookies are set
              only when you start or use sign-in, account linking, or the creator dashboard. Because
              these cookies provide an expressly requested security and account function, they are
              treated as strictly necessary under Section 25(2) TDDDG.
            </p>
          </PrivacySection>

          <PrivacySection title="11. Recipients and international transfers">
            <p>
              Data is disclosed only where needed to operate the service, comply with law, or
              protect legal rights. Relevant recipients can include Cloudflare and its
              sub-processors, Google if you consent to Google Analytics, the selected OAuth
              provider, the destination email provider, professional advisers, and authorities where
              disclosure is legally required. Approved listing content is public.
            </p>
            <p>
              Where data is transferred outside the EEA without an adequacy decision, the transfer
              is based on an applicable safeguard such as the EU Standard Contractual Clauses, plus
              supplementary measures where required.
            </p>
          </PrivacySection>

          <PrivacySection title="12. Retention">
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
                Cloudflare Web Analytics data is available through the service for up to six months.
              </li>
              <li>
                Google Analytics data is retained for 14 months; the <code>_ga</code> cookies expire
                after 2 years or when you withdraw consent.
              </li>
              <li>
                Correspondence is retained until the request is resolved and longer only where legal
                claims or statutory duties require it.
              </li>
            </ul>
          </PrivacySection>

          <PrivacySection title="13. Your rights">
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

          <PrivacySection title="14. Changes">
            <p>
              We update this policy when the service, providers, or legal requirements change. The
              current version is published here. Last updated: 23 October 2026.
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
              <li>Google Analytics only with your consent.</li>
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
