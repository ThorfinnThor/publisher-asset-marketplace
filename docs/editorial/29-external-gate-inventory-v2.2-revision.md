# Schritt 30 – Externe Gate-Inventur v2.2

**Datum:** 2026-09-26  
**Workflow-Rolle:** Luna  
**Entscheidungsdatei:** `data/editorial/private-eurostat-external-gate-inventory-v2.2.json`  
**Produktionswirkung:** keine.

## Ergebnis

Die v2.2-Inventur korrigiert die fünf Befunde aus Schritt 29 und bleibt fail-closed. Sie beschreibt
die späteren Prüfungen, führt aber weder Produktions-D1-Abfragen noch neue Eurostat-Abrufe oder
Browser-QA aus.

`rights_json` wird ausschließlich als `AssetRights` geprüft. `evidence_conflict` und
`chart_reuse_prohibited` werden ausschließlich unter `metadata_json.$.rights_evidence` verlangt;
`metadata_json.$.source` ist separat als `eurostat` festgelegt.

`attribution_terms` wird aus der Produktionszeile gelesen und dokumentiert, aber nicht fälschlich
als Pflichtwert behandelt, da der Eurostat-Import diesen Wert derzeit nicht schreibt. Stattdessen
müssen Citation Text, Eurostat-Name, exakte Dataset-URL, Reuse-Policy und der Hinweis auf
veränderte Daten im Artikel zusammenpassen.

Der Embed-Origin wird aus `embed_url` und `embed_origin` gelesen, miteinander verglichen und gegen
die beiden aktuell freigegebenen Cite-Supply-Origins geprüft. Die historische `workers.dev`-
Adresse bleibt berücksichtigt; eine Umstellung auf `citesupply.com` wäre eine separate
Produktionsänderung.

Die Identitätsabfrage darf `restricted` zunächst auflösen, aber die Rechteprüfung verlangt für
diese zwei Veröffentlichungen anschließend `rights_status=safe`.

## Gate-Zustand

Beide Artikel bleiben blockiert. Alle fünf Gate-Zustände pro Artikel stehen auf `not_run`. Es wurde
kein Produktionscode, Asset, Recht, Sitemap-Eintrag, Commit oder Deployment geändert.

## Nächster Schritt

**Schritt 31 – Sol:** v2.2 unabhängig prüfen. Erst danach darf der read-only External-Gate-Lauf
beginnen.
