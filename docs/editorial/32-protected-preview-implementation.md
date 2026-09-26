# Schritt 33 – Korrigierter Identitätsvertrag und geschützte Artikelvorschau

**Datum:** 2026-09-26  
**Workflow-Rolle:** Luna  
**Vertrag:** `data/editorial/private-eurostat-external-gate-inventory-v2.3.json`  
**Ergebnis:** `data/editorial/private-eurostat-preview-implementation-step33.json`  
**Produktionswirkung:** keine; kein Commit und kein Deployment.

## Korrigierte URL-Semantik

Der v2.3-Vertrag trennt jetzt die zwei zuvor vermischten URL-Arten. `assets.canonical_url` wird
gegen die offizielle Eurostat-Dataset-URL geprüft. Die Cite-Supply-Seite
`https://citesupply.com/asset/<slug>` ist eine separat abgeleitete öffentliche Assetroute und wird
unabhängig geprüft. Auf Grundlage der read-only Produktionsbelege aus Schritt 32 besteht das
Identitäts-Gate für beide Artikel nach dieser Korrektur. Eine Änderung der Produktionsdaten ist
nicht erforderlich.

## Geschützte Preview-Route

Die lokale Route lautet `/_editorial/preview/<brief-id>`. Der tatsächliche Dateisystemordner heißt
`%5Feditorial`, weil Next/Vinext führende Unterstriche sonst als nicht routbare private Ordner
behandelt. Der Build weist die gewünschte öffentliche URL trotzdem korrekt als
`/_editorial/preview/:briefId` aus.

Die Route verwendet keine statische Geheim-URL. Sie prüft die vorhandene Cite-Supply-Sitzung gegen
D1 und liefert nur für ein nicht abgelaufenes Profil mit der Rolle `admin` die Vorschau aus.
Creator, unbekannte Brief-IDs und Fehler der Sitzungsprüfung erhalten ein identisches `404`. Dadurch
wird weder die Existenz eines Entwurfs noch sein Inhalt gegenüber nicht berechtigten Aufrufern
bestätigt.

Die zwei ausgelieferten HTML-Dateien sind genau die bereits redaktionell geprüften Renderings. Vor
jeder Auslieferung berechnet die Route ihren SHA-256-Hash und vergleicht ihn mit dem freigegebenen
Manifestwert. Bei einer Abweichung wird die Vorschau nicht ausgeliefert.

## Indexierungs- und Browser-Schutz

Route und Worker setzen übereinstimmend `Cache-Control: private, no-store`,
`X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`,
`X-Frame-Options: DENY` und eine CSP ohne Skripte oder Framing. `robots.txt` sperrt
`/_editorial/`. Es existiert kein Eintrag in Navigation oder Sitemap und keine kanonische,
indexierbare Artikel-URL.

## Prüfungen

- Sechs gezielte Vitest-Dateien: 36 Tests bestanden.
- Route, Hash-Bindung und Security-Header: 13 Tests in drei Dateien bestanden.
- Vollständige Vitest-Suite: 67 Dateien und 372 Tests bestanden.
- ESLint: bestanden.
- TypeScript: bestanden.
- Produktions-Build: bestanden; die Route wurde als `/_editorial/preview/:briefId` erkannt.
- Lokaler unauthentifizierter Smoke-Test: `404` mit sämtlichen privaten Cache-, Robots-,
  Referrer- und Framing-Headern.
- Beide statischen Eurostat-Preview-Prüfungen: bestanden.
- Draft-Schema: bestanden.
- Inhaltstiefe: Renewables 586 und HICP 715 substantielle Wörter; beide über der Mindestgrenze von
  500 Wörtern.

Der lokale Sitemap-Aufruf war ohne migrierte lokale D1-Tabellen nicht ausführbar und ist daher kein
Sitemap-QA-Beleg. Die Route wird aber weder vom Sitemap-Code referenziert noch von dessen Query
erzeugt. Eine unabhängige Codeprüfung und die spätere Browser-/Accessibility-QA bleiben absichtlich
offen.

## Status und nächster Schritt

Die Implementierung ist lokal vorhanden, aber weiterhin nicht veröffentlicht. Das Release bleibt
blockiert.

**Schritt 34 – Sol:** Vertrag und Implementierung unabhängig auf Codequalität, SEO-Isolation,
Rechteintegrität und Sicherheit prüfen. Noch kein Deployment.
