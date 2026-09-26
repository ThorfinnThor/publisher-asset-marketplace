# Schritt 26 – Überarbeitete externe Gate-Inventur

**Datum:** 2026-09-25  
**Workflow-Rolle:** Luna  
**Entscheidungsdatei:** `data/editorial/private-eurostat-external-gate-inventory-v2.json`  
**Produktionswirkung:** keine.

## Entscheidung

Die externe Gate-Inventur ist jetzt reproduzierbar beschrieben, bleibt aber absichtlich blockiert.
Die Revision führt vier getrennte Beweisketten ein: eine read-only Auflösung der persistenten
Asset-ID, die live deklarierten Rechte, die offizielle Eurostat-Quelle mit exakt reproduzierbaren
Dimensionen und eine noch nicht vorhandene, private HTTPS-Vorschau des eigentlichen Artikels.

Es wurde kein Produktionscode geändert, kein Asset oder Recht verändert, kein Sitemap-Eintrag
angelegt, kein Commit erstellt und nichts deployed.

## 1. Persistente Asset-Identität

Das neue Inventar enthält die SELECT-Abfrage aus `src/lib/assets/get-asset.ts` mit dem gebundenen
Slug. Sie muss in der Produktions-D1 read-only ausgeführt werden und genau eine veröffentlichte
Zeile zurückgeben. Die Rückgabe muss mindestens `a.id`, `a.slug`, `a.external_id`, `a.status`,
`a.source_id`, `a.canonical_url`, die Zeitstempel, `a.rights_status`, die Rechte- und
Metadatenfelder sowie `s.policy_url` enthalten. Null Zeilen, Duplikate, ein anderer Datensatz oder
ein nicht veröffentlichter Status blockieren den Artikel.

Die öffentliche Asset-Seite genügt dafür nicht: Sie belegt den Slug und die Darstellung, gibt aber
keine persistent aufgelöste Datenbank-ID als externen Gate-Nachweis aus.

## 2. Rechtebeleg statt Rechteannahme

Die live sichtbaren Cite-Supply-Rechte und der offizielle Eurostat-Reuse-Hinweis werden getrennt
gespeichert. Der Datensatz-Link (`nrg_ind_ren` beziehungsweise `tec00118`) belegt die
Quellidentität; `https://ec.europa.eu/eurostat/help/copyright-notice` ist die dazugehörige
Policy-Quelle. Ein Artikel darf nur weiter, wenn beide URLs erreichbar, zeitgestempelt und
inhaltlich konsistent sind. Die allgemeine Eurostat-Policy wird nicht als pauschale Freigabe für
jede einzelne Darstellung behandelt; Ausnahmen und der Hinweis zu veränderten Daten bleiben
maßgeblich.

Die Step-25-Browserprüfung beobachtete auf beiden Asset-Seiten: Source-hosted embed nicht erlaubt,
Marketplace-rendered embed erlaubt, kommerzielle Nutzung und Modification erlaubt, Attribution und
Citation erforderlich sowie Raw-data redistribution erlaubt. Diese Beobachtung ist nur ein
Ausgangspunkt; das Gate muss sie erneut am aktuellen Asset erfassen.

## 3. Exakte Eurostat-Abfragen

Für jeden Preview-Eintrag ist nun die vollständige API-URL, das erwartete JSON-stat-Dimensionsset,
die Periodenregel und die Flag-Policy hinterlegt:

- `nrg_ind_ren`: `geo=EU27_2020`, `freq=A`, `unit=PC`, die vier `nrg_bal`-Werte `REN`,
  `REN_ELC`, `REN_TRA`, `REN_HEAT_CL`, Zeitraum 2020–2024. Provisorische spätere Werte werden
  für den aktuellen Artikel nicht stillschweigend übernommen.
- `tec00118`: `geo=EU27_2020`, `freq=A`, `unit=RCH_A_AVG`, `coicop18=TOTAL`, Zeitraum 2018–2025.
  Die ECOICOP-v2-Zuordnung und alle Eurostat-Statusflags müssen erhalten bleiben.

Der Gate-Lauf muss HTTP-Status, JSON-stat-Form, Dimensionen, Beobachtungen, Flags, Aktualisierungs-
und Abrufzeitpunkt sowie einen SHA-256 der vollständigen Antwort aufzeichnen. Der begrenzte
Marketplace-Auszug darf nicht als Ersatz für die vollständige API-Antwort dienen.

## 4. Artikel-Preview ist nicht Asset-Preview

Die geprüften `/asset/<slug>`-Seiten und `/embed/<slug>`-Seiten sind keine Editorial-Artikel. Im
aktuellen Repository existiert keine Editorial-Route. Deshalb darf aus einer Asset-Seite kein
responsive oder assistiver QA-Nachweis für den Artikel abgeleitet werden.

Das Inventar definiert deshalb einen künftigen, nicht implementierten Vertrag, beispielsweise
`https://citesupply.com/_editorial/preview/<brief-id>/<token>`. Das ist keine bereits vorhandene
URL. Eine spätere Implementierung muss HTTPS, Zugriffsschutz oder kurzlebige Tokens,
`Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, keinen
Sitemap-/Navigations-Eintrag sowie eine Bindung an Draft-, Preview-, Analyse- und Source-Hashes
garantieren. Erst dort darf der exakte Artikel bei 390×844, 768×1024, 1280×800 und 1440×900 mit
Keyboard-, Fokus-, Überschriften-, SVG- und Tabellenäquivalenz geprüft werden.

## Ergebnis und Übergabe

Alle fünf per Preview geführten Gate-Zustände (`live_asset_identity`, `asset_level_rights`,
`source_freshness`, `private_article_preview`, `responsive_and_assistive_qa`) bleiben `not_run`;
beide Release-Entscheidungen bleiben `blocked`. Das ist ein bewusstes Fail-closed-Ergebnis, keine
fehlende Freigabe.

**Als Nächstes: Schritt 27 – Sol.** Sol soll diese Revision unabhängig prüfen und verbleibende
Mehrdeutigkeiten im SQL-, API-, Rechte- oder Preview-Vertrag zurückweisen, bevor ein externer Gate-
Lauf gestartet wird.
