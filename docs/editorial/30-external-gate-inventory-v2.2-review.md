# Schritt 31 – Abschließende Prüfung der externen Gate-Inventur v2.2

**Datum:** 2026-09-26  
**Workflow-Rolle:** Sol  
**Prüfgegenstand:** `data/editorial/private-eurostat-external-gate-inventory-v2.2.json`  
**Entscheidungsdatei:** `data/editorial/private-eurostat-external-gate-inventory-v2.2-review-decisions.json`  
**Produktionswirkung:** keine.

## Entscheidung

Die v2.2-Inventur ist nach einer rein mechanischen Projektionskorrektur für die read-only externen
Gates freigegeben. Die Entscheidung lautet
`approved_for_read_only_external_gate_execution`. Sie ist ausdrücklich keine redaktionelle
Veröffentlichungsfreigabe.

Bei der Abschlussprüfung fiel auf, dass der Attributionsvertrag einen nicht leeren
`citation_text` verlangt, die SQL-Abfrage das Feld aber noch nicht auswählte. Deshalb wurde
`a.citation_text` sowohl in die SELECT-Projektion als auch in `required_columns` aufgenommen. Die
Korrektur ändert keine Rechte- oder Veröffentlichungspolitik und vermeidet lediglich einen
nicht ausführbaren Gate-Vertrag.

## Bestätigte Korrekturen

`rights_json` wird jetzt ausschließlich gegen den tatsächlichen TypeScript-Vertrag
`AssetRights` geprüft. `evidence_conflict` und `chart_reuse_prohibited` bleiben korrekt unter
`metadata_json.$.rights_evidence`. Sämtliche Metadatenanforderungen besitzen exakte JSON-Pfade;
`$.source` wird getrennt von der Rechteprovenienz geprüft.

Die Attribution-Prüfung entspricht dem aktuellen Importpfad: `attribution_terms` wird sichtbar
erfasst, darf für Eurostat aber leer sein. Stattdessen werden Citation Text, Eurostat-Name,
exakte Dataset-URL, offizielle Reuse-Policy und der Hinweis auf veränderte Daten gemeinsam
geprüft.

Der spätere Gate-Lauf liest den tatsächlich gespeicherten Embed-Origin, vergleicht ihn mit dem
Origin von `embed_url` und akzeptiert nur die zwei explizit überprüften Cite-Supply-Origins. Für
die Veröffentlichung bleibt ausschließlich `rights_status=safe` zulässig; ein aufgelöstes
`restricted`-Asset dient nur der Diagnose und bleibt blockiert.

Die Hash-Verträge für Drafts, Render-Previews, Analyse und Eurostat-Antworten sind eindeutig. Der
private Preview-Vertrag enthält die nötigen Token-, Ablauf-, Replay-, Cache-, Referrer- und
Indexierungsschutzregeln. Seine Implementierung und Browser-QA sind noch nicht erfolgt.

## Weiterhin blockiert

Alle realen Gate-Zustände bleiben `not_run`. Dieser Schritt hat weder Production D1 gelesen noch
Eurostat oder die Source-Policy neu abgerufen. Es wurden keine Assets, Rechte, Routen,
Sitemap-Einträge, Commits oder Deployments verändert. Beide Artikel bleiben blockiert, bis die
folgenden Schritte nachweislich bestanden sind.

## Nächster Schritt

**Schritt 32 – Sol:** die freigegebenen read-only Gates ausführen: Produktions-D1-Identität und
Rechte, offizielle Eurostat-API-Freshness sowie die Eurostat-Reuse-Policy per HTTPS prüfen und
reproduzierbare Evidenz speichern. Produktionsschreibzugriffe bleiben verboten.
