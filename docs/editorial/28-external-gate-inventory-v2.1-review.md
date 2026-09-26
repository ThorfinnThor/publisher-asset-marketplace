# Schritt 29 – Unabhängige Prüfung der externen Gate-Inventur v2.1

**Datum:** 2026-09-25  
**Workflow-Rolle:** Sol  
**Prüfgegenstand:** `data/editorial/private-eurostat-external-gate-inventory-v2.1.json`  
**Entscheidungsdatei:** `data/editorial/private-eurostat-external-gate-inventory-v2.1-review-decisions.json`  
**Produktionswirkung:** keine.

## Entscheidung

Vier der fünf Step-27-Korrekturen sind belastbar umgesetzt. Der Rechtevertrag enthält jedoch noch
Persistenzannahmen, die nicht zum aktuellen Code passen. Deshalb lautet die Entscheidung erneut
`revision_required_before_gate_execution`. Die Artikel und sämtliche externen Gates bleiben
blockiert.

## Bestätigte Korrekturen

Die SQL-Projektion ist vollständig, und beide Artikel sind ausdrücklich an die aktive Quelle
`source_eurostat`/`eurostat` gebunden. Der Response-Hash ist bytegenau definiert. Der private
Preview-Vertrag verlangt nun einen signierten, einmaligen, kurzlebigen Token oder eine
authentifizierte Reviewer-Session und enthält die erforderlichen Noindex-, No-store-, Referrer- und
Replay-Regeln. Auch alle Draft-, Preview- und Analyse-Hashes stimmen mit den aktuellen Dateien
überein.

## Verbleibende Abweichungen

### Zwei Felder stehen im falschen JSON

`rights_json` entspricht dem TypeScript-Typ `AssetRights`. Dieser enthält weder
`evidence_conflict` noch `chart_reuse_prohibited`. Beide Werte liegen im vollständigen
`RightsEvidence`-Objekt unter `metadata_json.rights_evidence`. Ein korrekt klassifiziertes Asset
kann die v2.1-Anforderung deshalb nicht erfüllen. Die Assertions müssen an die tatsächlichen
JSON-Pfade verschoben werden.

### Die Metadatenpfade sind noch nicht ausführbar beschrieben

Der Eurostat-Importer speichert `source` unter `metadata_json.$.source`. Die Rechteprovenienz liegt
separat unter `metadata_json.$.rights_evidence`. v2.1 mischt beide Ebenen in einem beschrifteten
Objekt. v2.2 muss für jede Prüfung den genauen JSON-Pfad angeben, einschließlich der Origins in
`indicator_evidence`.

### `attribution_terms` wird für Eurostat nicht befüllt

Die Spalte ist im Schema vorhanden, hat aber standardmäßig einen leeren String. Die aktuellen
Eurostat-Import- und Review-Pfade schreiben keinen Wert hinein. Ein Non-empty-Gate würde daher
ordnungsgemäß importierte Assets ablehnen. Für Eurostat müssen stattdessen Attribution Name,
Dataset-URL, Citation Text, Reuse-Policy und der Disclaimer für veränderte Daten gemeinsam geprüft
werden. Die Spalte bleibt zur Transparenz in der SELECT-Ausgabe.

### Der Embed-Origin darf nicht geraten werden

Der Katalogimport nutzt standardmäßig den `workers.dev`-Host; ältere geprüfte Manifeste enthalten
diesen ebenfalls. v2.1 verlangt dagegen pauschal `https://citesupply.com`. Der Gate-Lauf muss den
tatsächlich gespeicherten HTTPS-Origin lesen, ihn mit dem Origin von `embed_url` und der passenden
Embed-Review-Version vergleichen und protokollieren. Eine Migration bestehender Embeds auf die
Custom Domain wäre eine separate Produktionsänderung.

### Release-Rechte müssen für diese Artikel `safe` sein

Die dokumentierte Eurostat-Klassifikation hat keine erlaubte Restriktion. Deshalb soll der spätere
Release-Gate für diese zwei Artikel ausschließlich `rights_status=safe` akzeptieren. Ein
`restricted`-Asset muss blockiert bleiben, bis die konkrete Einschränkung separat geprüft wurde.

## Umfang

Die Prüfung hat keine Production-D1-Abfrage, keinen neuen Eurostat-Abruf und keine Browser- oder
Assistive-QA ausgeführt. Es wurden keine Assets, Rechte, Routen, Sitemap-Einträge, Commits oder
Deployments verändert.

## Nächster Schritt

**Schritt 30 – Luna:** v2.2 mit exakten JSON-Pfaden, korrekter Feldzuordnung,
pipeline-kompatibler Attribution-Prüfung, beobachtetem Embed-Origin und Safe-only-Release-Status
erstellen. Die externen Gates werden dabei weiterhin nicht ausgeführt.
