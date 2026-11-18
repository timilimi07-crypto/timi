# Datenschutz-Notizen (Arbeitsstand, keine Rechtsberatung)

## Welche personenbezogenen Daten kommen vor?

E-Rechnungen enthalten u. a. Namen und Anschriften von Ansprechpartnern, E-Mail-Adressen, Telefonnummern,
Bankverbindungen (IBAN) und bei Einzelunternehmen auch Personen als Rechnungssteller.

## Rollen

- Der Kunde (Betrieb) ist **Verantwortlicher**, der E-Rechnungs-Lotse **Auftragsverarbeiter** (AVV nötig).
- Unsere Dienstleister (Hosting, Speicher, ggf. LLM) sind **Unterauftragsverarbeiter** → `subprozessoren.md`.

## Rechtsgrundlagen (zu prüfen)

- Verarbeitung der Rechnungen: Vertragserfüllung und gesetzliche Pflichten des Kunden (Art. 6 Abs. 1 lit. b/c DSGVO,
  § 147 AO, § 14 UStG).
- Optionale LLM-Erklärung: nur mit minimierten Daten, abschaltbar; Rechtsgrundlage und Information klären.

## Technische und organisatorische Maßnahmen (Ziel)

- Datenhaltung ausschließlich EU (Regel c).
- Verschlüsselung in Transit (TLS) und at rest (Datenbank, Objektspeicher).
- Mandantentrennung über `organisation_id` in allen Abfragen.
- Logs ohne Rechnungsinhalte (Regel d/e); keine personenbezogenen Daten in Fehlermeldungen an Monitoring.
- LLM: Feature-Flag (Standard aus), Feld-Allowlist je Zweck, nur EU-Endpunkte.
- Zugriff nach Rollen, Protokoll in `audit_events`.

## Spannungsfeld Löschung vs. Aufbewahrung

Auskunfts- und Löschrechte (Art. 15/17 DSGVO) gegenüber Aufbewahrungspflichten (§ 147 AO: in der Regel 8 Jahre
für Buchungsbelege, seit 2025). Während der Frist: Einschränkung der Verarbeitung statt Löschung. Nach Fristablauf:
protokollierte Löschung (Prozess noch offen).

## Offene Punkte

- [ ] AVV-Vorlage für Kunden
- [ ] Verzeichnis der Verarbeitungstätigkeiten
- [ ] Datenschutz-Folgenabschätzung für LLM-Funktion nötig?
- [ ] Löschkonzept nach Fristablauf
