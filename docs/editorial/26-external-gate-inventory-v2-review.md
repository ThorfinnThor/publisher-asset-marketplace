# Schritt 27 – Unabhängige Prüfung der externen Gate-Inventur v2

**Datum:** 2026-09-25  
**Workflow-Rolle:** Sol  
**Prüfgegenstand:** `data/editorial/private-eurostat-external-gate-inventory-v2.json`  
**Entscheidungsdatei:** `data/editorial/private-eurostat-external-gate-inventory-v2-review-decisions.json`  
**Produktionswirkung:** keine.

## Entscheidung

Die v2-Inventur ist deutlich präziser, kann aber noch nicht für einen externen Gate-Lauf
freigegeben werden. Die Prüfung endet mit `revision_required_before_gate_execution`. Beide Artikel
bleiben blockiert; kein Gate wurde als bestanden markiert.

## Was belastbar ist

Die Hash-Bindung stimmt bytegenau: beide Drafts, beide gerenderten privaten Previews und die
gemeinsame Analysedatei entsprechen den im Inventar gespeicherten SHA-256-Werten. Die
Asset-Identitätsabfrage ist ausschließlich lesend. Das Schema erzwingt einen eindeutigen Slug und
zusätzlich eine eindeutige Kombination aus `source_id` und nicht leerer `external_id`.

Die Eurostat-Abfragen sind je Artikel vollständig angegeben. Datensatz, Geografie, Einheit,
Dimensionen, Periodenregel, Dataset-Seite, Methodikquellen und getrennte Reuse-Policy sind
nachvollziehbar. Ebenso korrekt ist die Grenze zwischen einer Asset-Seite und dem noch nicht
vorhandenen Editorial-Preview: Eine Asset- oder Embed-Seite darf nicht als Browser-QA des Artikels
ausgegeben werden.

## Blockierende Korrekturen

### Der SQL-Projektionsumfang ist kleiner als der Rechtevertrag

Der Rechtevertrag verlangt `attribution_name`, `attribution_url`, `attribution_terms` und
`embed_origin`. Die gespeicherte SELECT-Abfrage gibt diese Felder nicht zurück. Zusätzlich sollte
sie `sources.key`, `sources.name` und `sources.active` liefern. Ohne diese Felder lässt sich der
Rechte- und Quellenbeleg nicht vollständig aus genau dem angegebenen read-only Pfad
rekonstruieren.

### Die erwartete Quelle ist nicht ausführbar festgelegt

Die Akzeptanzregel fordert, dass `source_id` zum Brief passt. In den beiden Preview-Einträgen fehlt
jedoch der erwartete Wert. Beide müssen `expected_source_id: source_eurostat` und
`expected_source_key: eurostat` erhalten; die Quelle muss aktiv sein.

### Menschenlesbare Rechtewerte reichen nicht als Datenbanknachweis

Die beobachteten Labels sind sinnvoll, aber der Gate-Vertrag muss die entsprechenden JSON-Pfade
festschreiben. Dazu gehören mindestens die kommerzielle Nutzung, Modification, Attribution,
Citation, Raw-data redistribution, Source-hosted und Marketplace-rendered embedding, Provenance,
Evidence-URL und -Zeitpunkt sowie die automatisierte Review- und Embed-Review-Version. Konflikt-
oder Prohibitionsfelder müssen ausdrücklich `false` sein. Andernfalls könnte eine aktuelle
Oberfläche eine veraltete oder unvollständige Persistenz verdecken.

### Der private Preview-Zugriff ist noch zu offen formuliert

Ein bloß schwer erratbarer Link ist kein ausreichender Zugriffsschutz. Die nächste Revision muss
entweder eine authentifizierte Reviewer-Session oder einen signierten, kurzlebigen und
zweckgebundenen Token verlangen. Laufzeit, Bindung an Brief und Hashes, Invalidierung,
`Referrer-Policy: no-referrer`, Frame-Regel und Fehlerverhalten müssen festgelegt sein. Statische
Secret-URLs dürfen nicht genügen.

### Der Response-Hash braucht eine Byte-Definition

„SHA-256 der vollständigen Antwort“ kann Transportbytes, dekomprimierte Bytes oder neu
serialisiertes JSON bedeuten. Reproduzierbar ist: SHA-256 über die vom HTTP-Client dekodierten
Response-Body-Bytes vor dem JSON-Parsing, ergänzt um Byte-Länge und `Content-Type`. Die semantische
Prüfung erfolgt danach am geparsten JSON-stat-Dokument.

## Umfang

Diese Prüfung war lokal und read-only gegenüber Produktionsdaten. Sie hat keine D1-Abfrage gegen
Production ausgeführt, keine Eurostat-Antwort neu gepinnt, keine Preview-Route implementiert und
keine Browser-/Assistive-QA behauptet. Kein Produktionscode, Asset, Recht, Sitemap-Eintrag, Commit
oder Deployment wurde verändert.

## Nächster Schritt

**Schritt 28 – Luna:** eine eng begrenzte v2.1-Inventur erstellen, die S27-01 bis S27-05 auflöst.
Die externen Gates bleiben bis zur erneuten unabhängigen Prüfung unangetastet.
