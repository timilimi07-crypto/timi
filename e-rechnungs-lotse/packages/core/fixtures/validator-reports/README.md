# Aufgezeichnete KoSIT-Prüfberichte

Echte Antworten des Validator-Containers (KoSIT 1.6.3, XRechnung-Konfiguration 2026-08-31) für Unit-Tests
ohne laufenden Container. Aufgenommen mit `curl -X POST --data-binary @datei.xml localhost:8081/`.

| Datei                                | Eingabe                                                 | Ergebnis                                |
| ------------------------------------ | ------------------------------------------------------- | --------------------------------------- |
| `accept-01.01a-ubl.xml`              | KoSIT 01.01a UBL                                        | HTTP 200, accept, Info BR-DE-TMP-32     |
| `reject-schematron-ohne-leitweg.xml` | 01.01a UBL ohne BuyerReference                          | HTTP 406, Fehler BR-DE-15               |
| `reject-xsd-synthetic.xml`           | `synthetic/xrechnung-ubl-minimal.xml` (ohne Positionen) | HTTP 406, Schemafehler mit Zeile/Spalte |
| `no-scenario.xml`                    | 01.01a CII mit GuidelineID MINIMUM                      | HTTP 406, noScenarioMatched             |

Nach einem Validator-Update neu aufnehmen.
