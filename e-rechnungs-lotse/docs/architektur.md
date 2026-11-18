# Architektur

## Komponenten

| Komponente           | Technik                                                               | Aufgabe                                                                                                    |
| -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js 16 (App Router), React 19, Tailwind 4                         | UI, API-Routen (Upload, Anzeige, Export)                                                                   |
| `packages/core`      | TypeScript, `fast-xml-parser`, `pdfjs-dist`                           | `analyseInvoice()`: Format-Erkennung, PDF-Extraktion, Parsing, Regeln, Validator-Client, Hash, LLM-Gateway |
| `packages/db`        | Drizzle ORM, PostgreSQL 17                                            | Schema, Migrationen, GoBD-Trigger                                                                          |
| `services/validator` | KoSIT-Validator 1.6.3 + XRechnung 3.0.2 (Konfig. 2026-08-31), Java 21 | Formale Prüfung (XSD + Schematron) per HTTP                                                                |
| Objektspeicher       | S3-kompatibel (lokal: MinIO-Fork `pgsty/minio`)                       | Unveränderte Originale + Prüfberichte (Object Lock)                                                        |

## Datenfluss Eingangsrechnung (Zielbild MVP)

1. **Eingang** über Upload (später E-Mail-Postfach / MailMind-Anbindung).
2. **Hash:** SHA-256 über die unveränderten Bytes (`@erl/core` → `sha256Hex`).
3. **Ablage Original:** Objektspeicher mit Object Lock (WORM), Schlüssel enthält den Hash. Datenbankeintrag in
   `invoices` (Hash, Größe, MIME-Typ, Eingangszeit). Duplikate je Organisation über Unique-Index auf Hash.
4. **Analyse:** `analyseInvoice()` (siehe „Prüfablauf“) – erkennt das Format, löst bei ZUGFeRD das XML aus dem
   PDF, liest die Daten deterministisch aus (Regel a) und prüft sie. Das PDF bleibt als Original erhalten.
5. **Prüfung:** POST an den Validator (`VALIDATOR_URL`). Ergebnis + Bericht → `validation_runs`, Bericht
   in den Objektspeicher. Versionen von Validator und Konfiguration werden je Prüfung gespeichert.
6. **Plausibilität:** `checkPlausibility()` liefert zusätzliche, verständliche Hinweise.
7. **Anzeige:** Übersicht in einfachem Deutsch. Optional (Feature-Flag) Erklärtexte über `core/llm`.
8. **Export:** an Steuerbüro/Buchhaltung (Format offen, z. B. DATEV-Belegtransfer oder ZIP mit Original + CSV).
9. **Protokoll:** jede Aktion als Eintrag in `audit_events` (append-only).

## Prüfablauf `analyseInvoice(file, filename, options)`

```
Datei (Bytes)
 │  SHA-256 über die Original-Bytes (immer zuerst)
 ├─ > 25 MB? ───────────────────────────────► ERL-DATEI-ZU-GROSS
 ├─ beginnt mit %PDF- ?
 │    ├─ pdf.js: Anhänge, Text (max. 20 Seiten), XMP (PDF/A-Kennung)
 │    ├─ Anhang factur-x.xml | zugferd-invoice.xml | xrechnung.xml | zugferd_invoice.xml
 │    │   (sonst: einziger .xml-Anhang, Hinweis ERL-ZUGFERD-ANHANGNAME)
 │    ├─ kein Anhang ───────────────────────► format pdf_ohne_xml, Status keine_e_rechnung
 │    └─ PDF defekt/verschlüsselt ──────────► ERL-PDF-DEFEKT, Status keine_e_rechnung
 ├─ sonst XML? (nein ───────────────────────► ERL-FORMAT-UNBEKANNT, keine_e_rechnung)
 │
 ├─ parseInvoice(xml)       DOCTYPE ► ERL-XML-UNSICHER · nicht wohlgeformt ► ERL-XML-DEFEKT
 │                          kein UBL/CII ► ERL-FORMAT-UNBEKANNT · ZUGFeRD 1.0 ► ERL-ZUGFERD-1
 ├─ checkPlausibility()     Profil · Pflichtfelder · IBAN · § 14 UStG · Rechenprüfung
 ├─ PDF-Text ↔ XML          Rechnungsnummer + Brutto im PDF-Text? sonst ERL-PDF-XML-ABWEICHUNG
 ├─ KoSIT-Validator         POST / → Bericht → ValidationFinding[] (geprueft | kein_szenario | nicht_erreichbar)
 └─ Status
```

**Status-Regeln** (`computeStatus`), in dieser Reihenfolge:

1. Keine Rechnung erkannt (reines PDF, fremde Datei, ZUGFeRD 1.0) → `keine_e_rechnung`
2. mindestens ein Fehler (eigene Regel oder Validator) → `fehlerhaft`
3. Validator nicht erreichbar oder nicht konfiguriert → `pruefung_ausstehend`
4. mindestens eine Warnung → `warnungen`
5. sonst → `ok`

Hinweise (`info`) ändern den Status nie. Hat der Validator für ein Profil **kein Prüfszenario** (MINIMUM, BASIC WL,
BASIC, EXTENDED, XRechnung < 3.0), gibt es die Warnung `KOSIT-KEIN-SZENARIO`; die eigenen Regeln laufen trotzdem.

### Eigene Regeln (Auswahl der Regel-IDs)

| Bereich           | Regel-IDs                                                                                                                                                                                                                                                          | Schwere |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Profil            | `ERL-PROFIL-MINIMUM`, `ERL-PROFIL-BASICWL` („in Deutschland keine vollwertige E-Rechnung“), `ERL-XRECHNUNG-VERSION`                                                                                                                                                | Warnung |
| Rechenprüfung     | `ERL-RECHNUNG-POSITIONEN` (Σ BT-131 = BT-106), `-NETTO` (BT-106 − BT-107 + BT-108 = BT-109), `-BRUTTO` (BT-109 + BT-110 = BT-112), `-STEUERSUMME` (Σ BT-117 = BT-110), `-STEUERSATZ` (BT-116 × BT-119 ≈ BT-117), `-ZAHLBETRAG` (BT-112 − BT-113 + BT-114 = BT-115) | Fehler  |
| § 14 Abs. 4 UStG  | `ERL-UST14-LEISTENDER`, `-EMPFAENGER` (Nr. 1), `-STEUERNR` (Nr. 2), `-DATUM` (Nr. 3), `-NUMMER` (Nr. 4), `-LEISTUNG` (Nr. 5), `-ENTGELT` (Nr. 7), `-STEUER`, `-BEFREIUNG` (Nr. 8, inkl. Reverse Charge)                                                            | Fehler  |
| § 14 Abs. 4 Nr. 6 | `ERL-UST14-ZEITPUNKT` (Leistungsdatum fehlt)                                                                                                                                                                                                                       | Warnung |
| ZUGFeRD           | `ERL-PDF-XML-ABWEICHUNG` (Warnung), `ERL-PDF-KEIN-TEXT`, `ERL-PDFA3`, `ERL-ZUGFERD-XML-MASSGEBLICH` (Hinweise)                                                                                                                                                     |         |
| Sonstiges         | `ERL-PFLICHT` (BT-5, BT-115), `ERL-BETRAG-FORMAT` (Fehler), `ERL-IBAN`, `ERL-FAELLIGKEIT` (Warnung)                                                                                                                                                                |         |

Rechenprüfung: exakte Dezimalarithmetik in BigInt (Skala 6), keine Floats. **Toleranz 0,01 je Steuersatz**
(Anzahl der BG-23-Einträge, mindestens 1); beim Steuerbetrag je Satz 0,01. EXTENDED-Unterpositionen
(`ParentLineID`) und Info-Positionen (`LineStatusReasonCode = INFORMATION`) zählen nicht zur Positionssumme.
Bei MINIMUM und BASIC WL prüft § 14 nur Nummer und Datum (übrige Angaben stehen dort nur im PDF);
bei MINIMUM entfällt die Zahlbetragsprüfung (BT-113/BT-114 existieren dort nicht).

PDF/XML-Abgleich: Leerzeichen werden ignoriert; Beträge werden in den Schreibweisen `1480,43`, `1.480,43`,
`1480.43`, `1,480.43` gesucht. Rechtlich maßgeblich ist immer das XML – das PDF wird nie als Datenquelle genutzt.

## Datenmodell

### `InvoiceAnalysis` (Ergebnis von `analyseInvoice`)

| Feld                              | Bedeutung                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `sha256`, `sizeBytes`, `filename` | Original-Bytes (Regel b)                                                                                               |
| `format`                          | `ubl` · `cii` (reines XML) · `zugferd_pdf` · `pdf_ohne_xml` · `unbekannt`                                              |
| `profile`                         | `MINIMUM` · `BASIC_WL` · `BASIC` · `EN16931` · `EXTENDED` · `XRECHNUNG` · `UNBEKANNT` (aus BT-24)                      |
| `embeddedXmlFilename`             | bei ZUGFeRD der Name des XML-Anhangs                                                                                   |
| `invoice`                         | `NormalizedInvoice` (fehlt, wenn keine Rechnung erkannt)                                                               |
| `validation`                      | `status` (`geprueft` · `kein_szenario` · `nicht_erreichbar` · `nicht_durchgefuehrt`), `accepted`, `scenario`, `engine` |
| `findings`                        | `ValidationFinding[]`                                                                                                  |
| `status`                          | `ok` · `warnungen` · `fehlerhaft` · `keine_e_rechnung` · `pruefung_ausstehend`                                         |

### `ValidationFinding`

`{ severity: 'error' | 'warning' | 'info', ruleId, location, technicalMessage, message, source }` –
`location` ist ein vereinfachter XPath (Validator), „Zeile x, Spalte y“ (Schemafehler) oder eine BT-/BG-ID
(eigene Regeln). `message` ist einfaches Deutsch für die Anzeige, `technicalMessage` die Originalmeldung.
`source`: `validator` · `regel` · `format`.

### `NormalizedInvoice` (EN 16931)

Jedes Feld ist im Code mit seiner BT-/BG-ID dokumentiert; maschinenlesbar in `BT_IDS` (z. B.
`"totals.netAmount" → "BT-109"`). Beträge sind Dezimal-Strings, Daten ISO `yyyy-mm-dd`, fehlende Werte `null`.

| Bereich          | Felder (BT/BG)                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kopf             | `invoiceNumber` BT-1, `issueDate` BT-2, `typeCode` BT-3, `currency` BT-5, `taxPointDate` BT-7, `dueDate` BT-9, `buyerReference` BT-10, `format.specificationId` BT-24                                    |
| Leistungszeit    | `deliveryDate` BT-72, `invoicingPeriod` BG-14 (BT-73/74)                                                                                                                                                 |
| Parteien         | `seller` BG-4 (Name BT-27, USt-IdNr. BT-31, Steuernummer BT-32, Anschrift BG-5), `buyer` BG-7 (BT-44, BT-48, BG-8), `taxRepresentativeVatId` BT-63                                                       |
| Summen BG-22     | `lineTotal` BT-106, `allowanceTotal` BT-107, `chargeTotal` BT-108, `netAmount` BT-109, `taxAmount` BT-110, `grossAmount` BT-112, `prepaidAmount` BT-113, `roundingAmount` BT-114, `payableAmount` BT-115 |
| Steuer BG-23     | `taxableAmount` BT-116, `taxAmount` BT-117, `category` BT-118, `rate` BT-119, `exemptionReason` BT-120, `exemptionReasonCode` BT-121                                                                     |
| Positionen BG-25 | `id` BT-126, `quantity` BT-129, `unitCode` BT-130, `netAmount` BT-131, `periodStart/End` BT-134/135, `taxCategory` BT-151, `taxRate` BT-152, `name` BT-153                                               |
| Zahlung          | `ibans` BT-84                                                                                                                                                                                            |

### Datenbank (Migration `0002_analyse_kern`)

`invoices` erhält `file_format`, `analysis_status`, `embedded_xml_filename`; Enum `invoice_profile` entspricht
`InvoiceProfile` (Altwert `ZUGFERD_FACTURX` → `UNBEKANNT`). Prüfergebnisse gehören in `validation_runs.findings` (JSON).

## Validator

- Daemon-Modus: `java -jar validator.jar -s config/scenarios.xml -r config -D -H 0.0.0.0 -P 8080`
- `GET /server/health` (Health-Check), `POST /` mit XML-Body → Prüfbericht. HTTP 200 = annehmen,
  HTTP 406 = Ablehnung empfohlen.
- Versionen als Build-Argumente, siehe `services/validator/README.md`. Der Build prüft die SHA-256-Summen
  von Validator-JAR und XRechnung-Konfiguration (Standardwerte im Dockerfile, überschreibbar per `.env`).
- Die XRechnung-Konfiguration enthält Szenarien für XRechnung 3.0 (UBL/CII) und EN 16931 (UBL/CII) –
  nicht für ZUGFeRD BASIC/EXTENDED/MINIMUM/BASIC WL.

## Entscheidungen

- **pnpm-Workspace** ohne Turborepo (bewusst schlank; bei Bedarf nachrüstbar).
- **Drizzle statt Prisma:** SQL-nahe, versionierte SQL-Migrationen, eigene Trigger einfach als Custom-Migration.
- **Beträge als Dezimal-Strings / `numeric(19,4)`**, Rechnen in BigInt (`core/decimal.ts`).
- **pdf.js (`pdfjs-dist`) für PDFs:** liest Anhänge (EmbeddedFiles), Text und Metadaten in einer Bibliothek;
  ab v6 ohne `eval`-Pfad. PDF/A-Kennung wird direkt aus dem XMP-Paket gelesen (pdf.js versteht die
  Attributschreibweise nicht). `pdf-lib` nur als Entwicklungsabhängigkeit für Test-PDFs.
- **Tests:** Unit (Vitest, Validator gemockt bzw. aufgezeichnete Berichte, Abdeckung ≥ 80 % erzwungen) und
  Integration (`test/integration`, gegen den Container; in CI per `docker compose`).
- **Projekt liegt im Unterordner** `e-rechnungs-lotse/` des Repos `timi`; CI filtert per `paths`.

## Offene Punkte

- Eigene Prüfszenarien für ZUGFeRD BASIC/EXTENDED (FeRD-Schematron) in den Validator aufnehmen.
- Lizenz der FeRD-Beispiele (über ZUGFeRD-Corpus, Apache-2.0) vor Veröffentlichung klären.
- PDF/A-3-Konformität wird nur an der XMP-Kennung erkannt, nicht vollständig geprüft (z. B. veraPDF).
- Gutschriften (381) mit negativen Beträgen im PDF-Abgleich: Vorzeichen wird ignoriert.
