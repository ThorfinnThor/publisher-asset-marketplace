import type { Metadata } from "next";
import Link from "next/link";

import { ArrowUpRightIcon } from "@/components/design-system";

export const metadata: Metadata = {
  title: "Creator guide",
  description: "Prepare a chart, calculator, table, dataset, benchmark or widget for review.",
  alternates: { canonical: "/creator/guide" },
};

const embedSnippet = `<iframe\n  src="https://your-domain.example/embed/my-calculator"\n  title="My calculator"\n  loading="lazy"\n  referrerpolicy="strict-origin-when-cross-origin"\n  sandbox="allow-scripts"\n></iframe>`;

const rightsSnippet = `Embedding and commercial editorial use are allowed for this asset.\nThe preview image may be displayed in the marketplace.\nModification is [allowed/not allowed]. Attribution: [brand] — [terms].\nThis permission does not grant raw-data redistribution rights.`;

export default function CreatorGuidePage() {
  return (
    <main className="page-shell creator-guide">
      <header className="creator-guide__header">
        <p className="eyebrow">For creators</p>
        <h1 className="page-title">Make your tool ready to publish.</h1>
        <p className="page-intro">
          Publishers need a stable embed, a real preview and rights they can understand before they
          copy your asset. This guide shows the exact format that passes the marketplace checks.
        </p>
        <div className="creator-guide__actions">
          <Link className="button button--primary" href="/submit">
            Submit an asset
          </Link>
          <Link className="text-link" href="/#for-creators">
            See how publishing works <ArrowUpRightIcon />
          </Link>
        </div>
      </header>

      <section className="creator-guide__overview" aria-labelledby="four-resources-heading">
        <div>
          <p className="eyebrow">The four-resource rule</p>
          <h2 id="four-resources-heading">One asset, four public resources.</h2>
        </div>
        <ol>
          <li>
            <strong>Canonical page</strong>
            <span>Human-readable page that explains the asset.</span>
          </li>
          <li>
            <strong>Embed route</strong>
            <span>Dedicated page that renders inside a publisher iframe.</span>
          </li>
          <li>
            <strong>Preview image</strong>
            <span>Uploaded image or direct URL showing the actual result.</span>
          </li>
          <li>
            <strong>Rights evidence</strong>
            <span>Public page confirming reuse and attribution terms.</span>
          </li>
        </ol>
      </section>

      <div className="creator-guide__layout">
        <div className="creator-guide__steps">
          <GuideStep number="01" title="Choose a useful, self-contained asset">
            <p>
              Submit a chart, calculator, table, dataset, benchmark or widget that solves one clear
              publisher problem. Keep the title specific and the description useful without
              requiring a sales call or a login.
            </p>
            <ul className="creator-guide__list">
              <li>Title: 3–160 characters.</li>
              <li>Description: 20–2,000 characters.</li>
              <li>Use a real source or brand name, not SEO keywords.</li>
              <li>Do not submit raw HTML, uploaded JavaScript or private URLs.</li>
            </ul>
          </GuideStep>

          <GuideStep number="02" title="Build a stable /embed/ route">
            <p>
              Create a dedicated HTTPS route such as
              <code>https://your-domain.example/embed/my-calculator</code>. It must render the tool
              directly, without a login, cookie banner, consent wall or navigation detour.
            </p>
            <div className="creator-guide__callout">
              <strong>Design for the iframe viewport.</strong>
              <span>
                Test at 320 px, 768 px and 1280 px wide. Keep calculations in memory; do not depend
                on cookies, localStorage, sessionStorage, IndexedDB, forms, popups, downloads,
                same-origin access or credentials.
              </span>
            </div>
            <pre className="creator-guide__code">
              <code>{embedSnippet}</code>
            </pre>
            <p className="creator-guide__hint">
              The marketplace adds a responsive width and a 720 px starting height. Your embed page
              should still handle content that grows beyond that height gracefully.
            </p>
          </GuideStep>

          <GuideStep number="03" title="Publish a real preview image">
            <p>
              On the submission form, upload a PNG, JPG or WebP (maximum 2 MB). The marketplace
              stores it securely and attaches the public preview URL automatically. You can also
              provide a direct HTTPS image URL hosted on your own domain.
            </p>
            <ul className="creator-guide__list">
              <li>PNG or JPG is preferred; 1200 × 675 px works well.</li>
              <li>The image must show the calculator, chart or table with real data.</li>
              <li>For external URLs, the URL must return an image directly, without a login.</li>
            </ul>
          </GuideStep>

          <GuideStep number="04" title="Write rights evidence a publisher can verify">
            <p>
              Link to a stable public page that covers this exact asset and its preview image. State
              embedding, commercial editorial use, preview display, modification, attribution and
              any exclusions separately. Only claim a standard license when it actually applies.
            </p>
            <p className="creator-guide__hint">
              The attribution terms field is the short credit line shown to publishers, for example
              <code>
                Credit Your Brand — commercial use and embedding permitted with attribution
              </code>
              . It describes the required credit; your public rights page remains the evidence.
            </p>
            <pre className="creator-guide__code">
              <code>{rightsSnippet}</code>
            </pre>
            <p className="creator-guide__hint">
              A rights page can be your terms page, an asset-specific license notice or a signed
              owner-controlled policy. It cannot be a private document or a vague “fair use” claim.
            </p>
          </GuideStep>

          <GuideStep number="05" title="Run the checks and publish">
            <p>
              Sign in and paste the four URLs plus your metadata and declarations. The marketplace
              checks URL safety, host relationships, the preview, attribution, declared reuse rights
              and sandbox confirmation. If every check passes, the asset is published immediately.
              Otherwise, correct the reported fields and submit again.
            </p>
            <p>
              The marketplace is a commercial service and may earn revenue through fees,
              subscriptions, advertising or similar models. Your submission may be listed and
              promoted in that commercial context, but ownership of your tool, source code and data
              remains with you.
            </p>
            <div className="creator-guide__callout creator-guide__callout--caution">
              <strong>Declarations are asset-level.</strong>
              <span>
                Publishing one calculator does not authorize every tool on your domain. False
                declarations can lead to removal or account suspension. A canonical URL cannot be
                submitted twice, and each GitHub account is limited to 10 submissions per 24 hours.
              </span>
            </div>
          </GuideStep>
        </div>

        <aside className="creator-guide__aside">
          <section className="creator-guide__checklist" aria-labelledby="ready-heading">
            <p className="eyebrow">Before you submit</p>
            <h2 id="ready-heading">Ready checklist</h2>
            <ul>
              <li>Canonical page loads over HTTPS.</li>
              <li>Embed route is stable and source-hosted.</li>
              <li>The interactive sandbox test passes with exactly allow-scripts.</li>
              <li>Preview URL returns PNG or JPG data.</li>
              <li>Rights page names the asset and owner.</li>
              <li>Commercial and embedding permissions are explicit.</li>
              <li>Attribution text is accurate and publisher-readable.</li>
              <li>You have read the current Creator Terms.</li>
            </ul>
            <Link className="button button--secondary" href="/submit">
              Open submission form
            </Link>
          </section>

          <section className="creator-guide__example" aria-labelledby="example-heading">
            <p className="eyebrow">Pilot example</p>
            <h2 id="example-heading">PassendPlanen · Gartenhaus-Planer</h2>
            <dl>
              <div>
                <dt>Canonical</dt>
                <dd>passendplanen.de/garten/gartenhaus-planer/</dd>
              </div>
              <div>
                <dt>Embed</dt>
                <dd>passendplanen.de/embed/gartenhaus-planer/</dd>
              </div>
              <div>
                <dt>Preview</dt>
                <dd>passendplanen.de/previews/gartenhaus-planer.png</dd>
              </div>
            </dl>
            <p>
              These are the required shapes for the pilot. The embed and preview URLs must exist and
              the rights page must explicitly authorize their use before submission.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function GuideStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="creator-guide__step" aria-labelledby={`guide-step-${number}`}>
      <div className="creator-guide__step-number">{number}</div>
      <div>
        <h2 id={`guide-step-${number}`}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
