# Test-Fixtures

Alle Dateien in `fixtures/synthetic/` sind **synthetisch** (frei erfundene Firmen, Muster-IBAN `DE02120300000000202051`,
die öffentlich als Beispiel-IBAN verwendet wird). Keine echten Kundendaten – siehe CLAUDE.md Regel e).

Hinweis: Die Minimal-Fixtures enthalten keine Rechnungspositionen und sind daher **nicht schema-valide** –
sie testen nur den Parser. Für Validator-Tests sollen später Dateien aus der offiziellen XRechnung-Testsuite
(KoSIT, Apache-2.0) ergänzt werden.
