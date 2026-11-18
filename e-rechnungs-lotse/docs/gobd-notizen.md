# GoBD-Notizen (Arbeitsstand, keine Steuerberatung)

## Rahmen

- Seit 1.1.2025 müssen Unternehmen im Inland (B2B) E-Rechnungen **empfangen** können (§ 14 UStG,
  Wachstumschancengesetz). Übergangsregeln für den Versand bis Ende 2026/2027.
- Eine E-Rechnung ist ein strukturierter Datensatz (EN 16931). Bei ZUGFeRD/Factur-X ist das **XML** der
  maßgebliche Teil, das PDF eine Sichtkomponente. Laut BMF-Schreiben ist der strukturierte Teil aufzubewahren.
- Aufbewahrung: Buchungsbelege in der Regel **8 Jahre** (§ 147 AO, seit 2025), Prüfung durch Steuerberater.

## Umsetzung im Projekt

| GoBD-Anforderung                           | Umsetzung                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unveränderbarkeit                          | Original bytegenau im Objektspeicher mit Object Lock; SHA-256 bei Eingang; DB-Trigger sperrt Änderung von Hash/Objektschlüssel und Löschen |
| Vollständigkeit                            | Jeder Eingang erzeugt einen Datensatz; Duplikaterkennung über Hash                                                                         |
| Nachvollziehbarkeit                        | `audit_events` (append-only, per Trigger geschützt), Validator- und Konfigurationsversion je Prüfung                                       |
| Lesbarmachung / Maschinelle Auswertbarkeit | Original-XML bleibt erhalten; verständliche Anzeige; Export für Steuerbüro (Datenzugriff Z3)                                               |
| Ordnung / Auffindbarkeit                   | Index auf Organisation + Rechnungsdatum; Suche nach Rechnungsnummer, Absender                                                              |
| Verfahrensdokumentation                    | Diese Notizen + `architektur.md` als Grundlage; Kunden-Vorlage noch offen                                                                  |

## Offene Punkte

- [ ] Object-Lock-Modus (Governance vs. Compliance) und Aufbewahrungsdauer je Objekt festlegen.
- [ ] Verfahrensdokumentation als Vorlage für Kunden.
- [ ] Umgang mit Rechnungen, die der Validator ablehnt (trotzdem aufbewahren? Ja, als Eingang dokumentieren).
- [ ] Export-Format für Steuerbüro (DATEV-Belegbilder/Unternehmen online, ZIP + CSV).
- [ ] Zeitstempel/Integritätsnachweis über Hash hinaus (z. B. qualifizierter Zeitstempel) nötig?
