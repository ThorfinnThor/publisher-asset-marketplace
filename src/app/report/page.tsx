import type { Metadata } from "next";
import Link from "next/link";

import { publicContactEmail } from "@/lib/site-identity";

export const metadata: Metadata = {
  title: "Meldung und Entfernung",
  description: "Meldeweg für rechtswidrige Inhalte und Entfernung von Marketplace-Listings.",
  alternates: { canonical: "/report" },
  robots: { index: false, follow: true },
};

export default function ReportPage() {
  return (
    <main className="page-shell legal-page">
      <header className="legal-page__header">
        <p className="eyebrow">Notice and action</p>
        <h1 className="page-title">Meldung und Entfernung</h1>
        <p className="page-intro">
          Melde einen konkreten Marketplace-Eintrag, wenn du ihn für rechtswidrig hältst oder eine
          Berechtigung bestreitest.
        </p>
      </header>

      <div className="legal-page__layout">
        <article className="legal-page__content">
          <section className="legal-page__section" aria-labelledby="submit-heading">
            <h2 id="submit-heading">So reichst du eine Meldung ein</h2>
            {publicContactEmail ? (
              <p>
                Sende die Meldung ausschließlich elektronisch an{" "}
                <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>.
              </p>
            ) : (
              <p className="notice notice--warning">
                Die elektronische Meldeadresse wird nach Aktivierung der Domain ergänzt. Der
                Meldeweg ist vorbereitet, aber noch nicht vollständig live.
              </p>
            )}
            <p>Eine ausreichend konkrete Meldung sollte enthalten:</p>
            <ul>
              <li>die genaue Asset-URL im Marketplace,</li>
              <li>die beanstandete Information und den Grund der Beanstandung,</li>
              <li>die konkrete Rechts- oder Berechtigungsgrundlage, soweit bekannt,</li>
              <li>deine Kontaktmöglichkeit für Rückfragen und</li>
              <li>eine Erklärung, dass die Angaben nach bestem Wissen richtig sind.</li>
            </ul>
          </section>

          <section className="legal-page__section" aria-labelledby="process-heading">
            <h2 id="process-heading">Bearbeitung</h2>
            <p>
              Wir prüfen die Meldung, können Nachweise anfordern und den betroffenen Eintrag
              vorübergehend ausblenden oder entfernen. Maßnahmen werden dokumentiert und, soweit
              erforderlich, den betroffenen Parteien mitgeteilt. Eine Meldung führt nicht
              automatisch zu einer Entfernung.
            </p>
          </section>

          <section className="legal-page__section" aria-labelledby="creator-heading">
            <h2 id="creator-heading">Eigene Einträge entfernen</h2>
            <p>
              Creator können die Entfernung eigener Einträge über ihr Konto anfordern. Für die
              inhaltlichen Pflichten und Rechte gilt zusätzlich die{" "}
              <Link href="/creator/terms">Creator Terms</Link>.
            </p>
          </section>
        </article>

        <aside className="legal-page__aside">
          <div className="detail-panel detail-panel--compact">
            <p className="eyebrow">Wichtig</p>
            <p>
              Bitte keine Zugangsdaten, privaten URLs oder unnötigen personenbezogenen Daten in eine
              Meldung aufnehmen.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
