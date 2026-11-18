# Offizielle Testrechnungen

Die Dateien hier sind **unverändert** heruntergeladen. Sie werden nur als Testdaten gelesen und nie ausgeführt.
Alle Dateien enthalten fiktive Beispieldaten von Normungs- und Branchengremien, keine echten Kundendaten (CLAUDE.md, Regel e).
Abgerufen am 2026-11-18.

| Ordner                       | Herkunft                                                                                                                                                                                             | Version / Commit                                                                       | Lizenz                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- |
| `kosit-xrechnung-testsuite/` | [itplr-kosit/xrechnung-testsuite](https://github.com/itplr-kosit/xrechnung-testsuite), `src/test/business-cases/standard/` (Fälle 01.01a–01.21a ohne 01.15a, dazu 03.03a und 03.06a; je UBL und CII) | Tag `v2026-08-31` (XRechnung 3.0.2), Commit `44c3905c69ca236aa3b94c04be1b7e9bd066ba03` | Apache-2.0                          |
| `ferd-zugferd-2.2/`          | Beispiele aus dem FeRD-Infopaket ZUGFeRD 2.2 (Referenzprofile EN 16931 und XRECHNUNG), bezogen über [ZUGFeRD/corpus](https://github.com/ZUGFeRD/corpus) `XML-Rechnung/FX/`                           | Commit `34d5a0d1137bfd89525f99b35fd16d520d67a7ac`                                      | Apache-2.0 (Corpus) – siehe Hinweis |
| `intarsys-zugferd-2.0/`      | intarsys-Beispiele ZUGFeRD 2.0 (BASIC, EXTENDED) aus [ZUGFeRD/corpus](https://github.com/ZUGFeRD/corpus) `ZUGFeRDv2/correct/intarsys/`                                                               | wie oben                                                                               | Apache-2.0 (Corpus)                 |
| `fnfe-factur-x/`             | FNFE-MPE-Beispiele Factur-X (MINIMUM, BASIC WL) aus [ZUGFeRD/corpus](https://github.com/ZUGFeRD/corpus) `ZUGFeRDv2/correct/FNFE-factur-x-examples/`                                                  | wie oben                                                                               | Apache-2.0 (Corpus)                 |

Die Lizenz liegt in `LICENSE-Apache-2.0.txt`. Keines der Quellrepositorien enthält eine NOTICE-Datei.

**Hinweis zur Lizenz der FeRD-Beispiele:** Das ZUGFeRD-Corpus verteilt die Dateien unter Apache-2.0. Die Originale
stammen aus dem FeRD-Infopaket (AWV e. V.). Vor einer Veröffentlichung des Repositorys sollte geklärt werden, ob die
Nutzungsbedingungen des Infopakets die Weitergabe abdecken (offener Punkt in `docs/architektur.md`).

## Bekannte Eigenheiten (wichtig für Tests)

- FeRD `XRECHNUNG_Einfach.pdf` nutzt noch **XRechnung 2.1** → Warnung `ERL-XRECHNUNG-VERSION`; der Validator
  (Konfiguration für 3.0.2) hat kein Szenario → `KOSIT-KEIN-SZENARIO`.
- BASIC, EXTENDED, BASIC WL und MINIMUM sind in der KoSIT-XRechnung-Konfiguration nicht enthalten → `KOSIT-KEIN-SZENARIO`.
- `EN16931_Innergemeinschaftliche_Lieferungen.pdf` und `zugferd_2p0_EXTENDED_Fremdwaehrung.pdf` enthalten die
  formal ungültige Platzhalter-IBAN `DE12 1234 4321 9876 00` → Warnung `ERL-IBAN` (gewollt).
- In der KoSIT-Testsuite fehlt oft das Leistungsdatum → Warnung `ERL-UST14-ZEITPUNKT` (entspricht KoSIT `BR-DE-TMP-32`).
- In der KoSIT-Testsuite ist die CII-Positionsnummer (`LineID`) teils mit der Artikelbezeichnung belegt – das ist so in den Daten.

## Aktualisieren

Bei einer neuen XRechnung-Version die Testsuite mit dem passenden Tag neu beziehen, Tabelle oben anpassen,
`pnpm --filter @erl/core test -- -u` (Snapshots) und `pnpm test:integration` ausführen.
