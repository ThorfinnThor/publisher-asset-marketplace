# Schritt 28 – Externe Gate-Inventur v2.1

**Datum:** 2026-09-25  
**Workflow-Rolle:** Luna  
**Entscheidungsdatei:** `data/editorial/private-eurostat-external-gate-inventory-v2.1.json`  
**Produktionswirkung:** keine.

## Ergebnis

Die v2.1-Inventur löst die fünf Befunde aus Schritt 27 auf. Sie bleibt trotzdem absichtlich
blockiert, weil sie nur die Ausführung der Gates definiert; sie führt kein Produktions-D1-Query,
keinen neuen Eurostat-Abruf und keine Browser-QA aus.

Es wurden kein Produktionscode, kein Asset, keine Rechte, keine Sitemap, kein Commit und kein
Deployment verändert.

## Korrekturen

Die read-only Asset-Abfrage projiziert nun alle für den Vertrag benötigten Asset-Felder:
Attribution, Attribution Terms, Embed Origin, Rechte- und Metadaten-JSON sowie `sources.key`,
`sources.name` und `sources.active`. Beide Previews binden ausdrücklich an
`source_eurostat`/`eurostat` und verlangen eine aktive Quelle.

Für die Rechteprüfung sind jetzt konkrete Datenbankassertions festgelegt. Der Gate-Lauf muss die
persistierten `rights_json`-Werte und die `metadata_json.rights_evidence`-Provenienz prüfen, nicht
nur die sichtbaren Labels der Asset-Seite. Dazu gehören die Trennung von source-hosted und
marketplace-rendered embedding, die beiden Review-Versionen, Attribution/Citation, kommerzielle
Nutzung, Modification, Raw-data redistribution, Evidence-Zeitpunkt und Konflikt-/Prohibitions-
Flags. Die Dataset-Seite und die [Eurostat-Reuse-Policy](https://ec.europa.eu/eurostat/help/copyright-notice)
bleiben getrennte Belege.

Die API-Hashregel ist deterministisch: SHA-256 wird über die exakt vom HTTP-Client dekodierten
Response-Body-Bytes vor JSON-Parsing oder Re-Serialisierung berechnet. Byte-Länge, Content-Type,
Abrufzeitpunkt und Hash werden gemeinsam gespeichert; die JSON-stat-Semantik wird danach geprüft.

Die noch nicht implementierte Artikel-Preview erlaubt nur eine authentifizierte Reviewer-Session
oder einen signierten, einmaligen Token mit maximal 300 Sekunden Lebensdauer, Hash-/Brief-Bindung,
Replay-Sperre, `Referrer-Policy: no-referrer`, `private, no-store` und `noindex, nofollow,
noarchive`. Eine bloß schwer erratbare statische URL ist ausdrücklich nicht zulässig.

## Gate-Zustand

Für beide Artikel bleiben `live_asset_identity`, `asset_level_rights`, `source_freshness`,
`private_article_preview` und `responsive_and_assistive_qa` auf `not_run`; die Release-Entscheidung
bleibt `blocked`. Das ist ein bewusstes Fail-closed-Ergebnis.

## Übergabe

**Als Nächstes: Schritt 29 – Sol.** Sol prüft v2.1 unabhängig gegen alle fünf Befunde aus Schritt 27.
Erst nach einer positiven Prüfung darf ein separater Gate-Lauf geplant werden.
