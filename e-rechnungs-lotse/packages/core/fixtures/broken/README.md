# Absichtlich fehlerhafte Testdateien

Erzeugt mit `pnpm --filter @erl/core fixtures:broken` (Skript: `scripts/generate-broken-fixtures.ts`).
Grundlage sind die offizielle KoSIT-Testrechnung 01.01a (fiktive Daten, Apache-2.0) bzw. die synthetische
Datei `synthetic/zugferd-cii-minimal.xml`. PDFs werden mit pdf-lib und festem Datum erzeugt (reproduzierbar).

| Datei                          | Änderung                                                    | Erwartete Regel          | Status           |
| ------------------------------ | ----------------------------------------------------------- | ------------------------ | ---------------- |
| `falsche-summe.xml`            | Brutto (BT-112) 336.9 → 346.9                               | `ERL-RECHNUNG-BRUTTO`    | fehlerhaft       |
| `fehlende-ustid.xml`           | USt-IdNr. des Verkäufers entfernt, keine Steuernummer       | `ERL-UST14-STEUERNR`     | fehlerhaft       |
| `fehlende-rechnungsnummer.xml` | BT-1 entfernt                                               | `ERL-UST14-NUMMER`       | fehlerhaft       |
| `pdf-xml-abweichung.pdf`       | PDF-Text nennt andere Nummer und anderen Betrag als das XML | `ERL-PDF-XML-ABWEICHUNG` | warnungen        |
| `minimum-profil.pdf`           | Profil MINIMUM                                              | `ERL-PROFIL-MINIMUM`     | warnungen        |
| `pdf-ohne-xml.pdf`             | reines PDF ohne Anhang                                      | `ERL-KEINE-E-RECHNUNG`   | keine_e_rechnung |
