import type { Metadata } from "next";
import Link from "next/link";

import { publicContactEmail, siteIdentity } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung von Publisher Asset Marketplace.",
};

export default function LegalNoticePage() {
  return (
    <main className="page-shell legal-page">
      <header className="legal-page__header">
        <p className="eyebrow">Rechtliche Informationen</p>
        <h1 className="page-title">Impressum</h1>
        <p className="page-intro">Anbieterkennzeichnung für den Publisher Asset Marketplace.</p>
      </header>

      <div className="legal-page__layout">
        <article className="legal-page__content">
          <section className="legal-page__section" aria-labelledby="provider-heading">
            <h2 id="provider-heading">Anbieter</h2>
            <address>
              {siteIdentity.operatorName}
              <br />
              {siteIdentity.legalForm} {siteIdentity.businessName}
              <br />
              {siteIdentity.street}
              <br />
              {siteIdentity.postalCode} {siteIdentity.city}
              <br />
              {siteIdentity.country}
            </address>
          </section>

          <section className="legal-page__section" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Kontakt</h2>
            {publicContactEmail ? (
              <p>
                E-Mail: <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
              </p>
            ) : (
              <p className="notice notice--warning">
                Die öffentliche Kontakt-E-Mail wird nach Aktivierung der Domain ergänzt. Diese Seite
                ist bis dahin noch nicht vollständig für den Livebetrieb.
              </p>
            )}
          </section>

          <section className="legal-page__section" aria-labelledby="register-heading">
            <h2 id="register-heading">Register und Umsatzsteuer</h2>
            <p>
              Für dieses Einzelunternehmen wurden keine Handelsregister- oder Umsatzsteuerangaben
              übermittelt. Falls eine USt-IdNr. oder Registereintragung besteht, wird sie hier
              ergänzt.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="links-heading">
            <h2 id="links-heading">Weitere Informationen</h2>
            <p>
              <Link href="/creator/terms">Creator Terms</Link> und{" "}
              <Link href="/report">Meldung und Entfernung</Link>.
            </p>
          </section>
        </article>

        <aside className="legal-page__aside">
          <div className="detail-panel detail-panel--compact">
            <p className="eyebrow">Hinweis</p>
            <p>
              Die Kontakt-E-Mail muss vor dem produktiven Launch ergänzt und erreichbar sein. Bitte
              keine vertraulichen Daten an diese vorläufige Seite senden.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
