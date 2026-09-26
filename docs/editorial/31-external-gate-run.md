# Schritt 32 – Read-only Produktions- und Eurostat-Gates

**Datum:** 2026-09-26  
**Workflow-Rolle:** Sol  
**Ergebnisdatei:** `data/editorial/private-eurostat-external-gate-results-step32.json`  
**SQL:** `scripts/editorial/sql/eurostat-external-gates.sql`  
**HTTPS-Prüfer:** `scripts/editorial/run-eurostat-external-http-gates.ts`  
**Produktionswirkung:** keine.

## Ergebnis

Die Rechte-, Freshness- und Source-Policy-Gates sind für beide Eurostat-Artikel bestanden. Die
formale Identitätsprüfung bleibt jedoch fail-closed, weil der v2.2-Vertrag zwei unterschiedliche
URL-Konzepte vermischt. Die Artikel werden deshalb noch nicht zur Veröffentlichung freigegeben.

## Produktions-D1

Wrangler 4.131.1 ist installiert, aber die lokale Cloudflare-Authentifizierung war abgelaufen.
Wrangler hat daher keine Abfrage ausgeführt. Als read-only Fallback wurden die drei dokumentierten
`SELECT`-Abfragen in der bereits authentifizierten Cloudflare-D1-Konsole ausgeführt. Es gab keine
Migration, kein `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, DDL oder sonstigen Schreibzugriff.

Beide Zeilen existieren genau einmal, sind `published`, stammen aus der aktiven Quelle
`source_eurostat`, besitzen die erwarteten Dataset-Codes und haben `rights_status=safe`. Citation,
Attribution, Embed-Origin und Review-Versionen sind vorhanden und konsistent. Die vollständigen
`AssetRights`- und `RightsEvidence`-Assertions liefern für beide Assets jeweils `pass=1`.

## Gefundener Vertragsfehler

In D1 ist `assets.canonical_url` die kanonische Quell-URL im Eurostat Data Browser. Die öffentliche
Cite-Supply-Seite wird dagegen aus dem Slug als `/asset/<slug>` gebildet. v2.2 nennt die
Cite-Supply-Seite fälschlich den erwarteten Wert von `assets.canonical_url`.

Die Produktion ist hier korrekt und konsistent:

- `canonical_url` entspricht der Eurostat-Dataset- und Attribution-URL.
- Beide `https://citesupply.com/asset/<slug>`-Routen antworten separat mit HTTP 200.
- Beide Embed-URLs gehören zum gespeicherten und freigegebenen `workers.dev`-Origin.

Der Vertrag muss deshalb `expected_source_canonical_url` und `expected_public_asset_url` getrennt
modellieren. Bis diese Korrektur erneut geprüft ist, bleibt das Identitäts-Gate blockiert.

## Eurostat-Freshness

Beide API-Antworten wurden über verifiziertes TLS, mit `Accept-Encoding: identity`, HTTP 200 und
`application/json` abgerufen. Ihre SHA-256-Hashes sind exakt identisch mit den Snapshots, aus denen
die Artikelberechnungen stammen.

`tec00118` entspricht vollständig dem erwarteten EU27-HICP-Ausschnitt 2018–2025. `nrg_ind_ren`
enthält zusätzlich zwei nicht verwendete Kategorien und provisorische 2025-Werte. Das ist kein
stiller Datenwechsel: Derselbe Response war bereits gepinnt, der Fact Pack beschränkt die Analyse
ausdrücklich auf vier Kategorien und 2020–2024, und die Artikelberechnung nutzt die provisorischen
2025-Werte nicht.

## Reuse-Policy

Die offizielle Eurostat-Reuse-Seite antwortete über verifiziertes TLS mit HTTP 200. Sie erlaubt die
kommerzielle und nichtkommerzielle Wiederverwendung statistischer Daten bei Quellenangabe, enthält
aber dokumentierte Ausnahmen. Außerdem verlangt sie bei modifizierten Daten eine klare Kennzeichnung
und einen Eurostat-Haftungsausschluss. Beide Drafts verlinken die Policy und enthalten den
entsprechenden Hinweis.

Die zwei Artikel verwenden ausschließlich EU27-Aggregate. Sie übernehmen keine nicht-europäischen
Länderdaten, Handelsdaten-Ausnahmen, Logos, Marken, Fotos, Illustrationen oder separat
gekennzeichnetes Drittmaterial.

## Gate-Status

- Asset-Rechte: bestanden.
- Eurostat-Freshness: bestanden.
- Eurostat-Reuse-Policy: bestanden.
- Produktionsidentität: technisch konsistent, formal wegen des URL-Vertragsfehlers blockiert.
- Private Artikelroute und responsive/assistive Browser-QA: noch nicht ausgeführt.
- Veröffentlichung: blockiert.

## Nächster Schritt

**Schritt 33 – Luna:** Source-Canonical und öffentliche Cite-Supply-Assetroute im Vertrag trennen,
das Identitäts-Gate ohne Produktionsänderung neu bewerten und danach die geschützte,
nicht-indexierbare Artikel-Preview-Route lokal implementieren. Noch kein Deployment.
