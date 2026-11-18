# E-Rechnungs-Lotse – Hinweise für Claude und Entwickler

## Produktziel

Der E-Rechnungs-Lotse hilft deutschen Kleinbetrieben, eingehende E-Rechnungen (XRechnung UBL/CII,
ZUGFeRD/Factur-X) zu empfangen, mit dem offiziellen KoSIT-Validator zu prüfen und verständlich anzuzeigen.
Das Original wird unverändert und GoBD-konform archiviert und lässt sich an Buchhaltung oder Steuerbüro
exportieren. Das Modul ist eigenständig nutzbar und wird später in MailMind integriert.

**Zielgruppe:** Handwerksbetriebe und andere Kleinbetriebe mit 1–20 Beschäftigten, ohne eigene IT-Abteilung,
meist mit externem Steuerbüro (DATEV-Umfeld).

**Nicht-Ziele (MVP):**

- Kein Buchhaltungsprogramm (keine Kontierung, keine Buchungssätze, keine UStVA).
- Kein Editor für Ausgangsrechnungen.
- Keine Zahlungsabwicklung.
- Keine Steuerberatung – Prüfergebnisse sind technische Hinweise.

## Architektur

```
e-rechnungs-lotse/
├── apps/web/            Next.js (App Router, TS strict, Tailwind), deutschsprachige UI, Playwright-E2E in e2e/
├── packages/core/       Reine TS-Bibliothek: Parsing (UBL/CII), Normalisierung, Prüfregeln, Hash, Dezimal, IBAN
│   └── src/llm/         EINZIGER Zugang zu LLMs (Feature-Flag, EU-Endpunkt-Allowlist, Datenminimierung)
├── packages/db/         Drizzle-Schema + versionierte SQL-Migrationen (drizzle/), GoBD-Trigger
├── services/validator/  Docker-Image KoSIT-Validator im HTTP-Daemon-Modus + XRechnung-Konfiguration
├── infra/               docker-compose.yml (web, migrate, postgres, minio, validator)
├── docs/                Architektur, Subprozessoren, Datenschutz, GoBD
└── compose.yaml         bindet infra/docker-compose.yml ein → `docker compose up` im Projekt-Root
```

Ablauf: Eingang → SHA-256 über Original-Bytes → Original in Objektspeicher (Object Lock) → Parsing in
`@erl/core` → Prüfung durch KoSIT-Validator (maßgeblich) + eigene Plausibilitätsregeln → Anzeige → Export.
Details: `docs/architektur.md`.

## HARTE REGELN (nicht verhandelbar)

a) **Rechnungsdaten nur deterministisch aus dem XML.** Beträge, Steuersätze, IBAN, Rechnungsnummer und
Datumsangaben werden ausschließlich per Parser aus dem XML gelesen (`packages/core/src/parse`). Sie werden
niemals von einem LLM erzeugt, ergänzt, geschätzt oder „korrigiert“. Fehlt ein Wert, bleibt er `null`.
Beträge sind Dezimal-Strings, nie JavaScript-`number`.

b) **Das Original-XML ist rechtlich maßgeblich** und wird bytegenau unverändert gespeichert. Bei Eingang wird
der SHA-256 berechnet und gespeichert (`invoices.original_sha256`). Original-Referenz und Hash sind per
DB-Trigger unveränderlich; Löschen ist gesperrt. Abgeleitete Daten (Anzeige, Export) dürfen das Original
nie ersetzen.

c) **Nur EU.** Hosting, Datenbank, Objektspeicher und LLM-Endpunkte ausschließlich in der EU. Kein
US-Subprozessor ohne Eintrag (inkl. Rechtsgrundlage/Transfermechanismus) in `docs/subprozessoren.md`.
Neue externe Dienste immer zuerst dort eintragen.

d) **LLM nur über `packages/core/src/llm`.** Mit Feature-Flag `LLM_ENABLED` (Standard: aus), Endpunkt-Allowlist
`LLM_ALLOWED_HOSTS`, Datenminimierung (nur freigegebene Felder je Zweck) und Logging ohne personenbezogene
Inhalte (nur Metadaten wie Zweck, Dauer, Feldnamen). LLM-SDKs außerhalb dieses Moduls sind per ESLint
verboten. LLM-Ausgaben sind nur Erklärtexte, nie Datenquelle.

e) **Keine echten Kundendaten** in Tests, Logs, Fixtures, Screenshots oder Issues. Fixtures sind synthetisch
(Muster-IBAN `DE02120300000000202051`, erfundene Firmen). Logs enthalten keine Rechnungsinhalte.

f) **UI-Texte in einfachem Deutsch**, kurze Sätze, durchgehend „Sie“. Fachbegriffe beim ersten Auftreten erklären.

Weitere Grundsätze:

- Die formale Prüfung macht der KoSIT-Validator. Eigene Regeln in `core/rules.ts` sind nur Zusatzhinweise.
- XML mit DOCTYPE wird abgelehnt (XXE-Schutz). Keine weiteren XML-Parser ohne denselben Schutz einführen.
- Keine Secrets committen. Konfiguration über `.env` (Vorlage: `.env.example`).

## Befehle (im Ordner `e-rechnungs-lotse/`)

| Zweck                 | Befehl                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| Abhängigkeiten        | `pnpm install`                                                                      |
| Alles in Docker       | `docker compose up --build` → http://localhost:3000                                 |
| Dev-Server (Web)      | `pnpm dev` (Postgres/Validator via `docker compose up -d postgres validator minio`) |
| Unit-Tests            | `pnpm test`                                                                         |
| E2E-Tests             | `pnpm --filter @erl/web build && pnpm test:e2e`                                     |
| Lint                  | `pnpm lint`                                                                         |
| Typecheck             | `pnpm typecheck`                                                                    |
| Migration erzeugen    | `pnpm db:generate` (nach Änderung an `packages/db/src/schema.ts`)                   |
| Migrationen ausführen | `pnpm migrate` (benötigt `DATABASE_URL`)                                            |

Validator-Update: Versionen in `.env` ändern (`VALIDATOR_VERSION`, `XRECHNUNG_VERSION`,
`XRECHNUNG_CONFIG_RELEASE`), dann `docker compose build validator`. Siehe `services/validator/README.md`.

## Definition of Done

- `pnpm lint`, `pnpm typecheck` und `pnpm test` sind grün (CI: `.github/workflows/e-rechnungs-lotse-ci.yml`).
- Neue Funktionen haben Tests (Core: Vitest; UI-Abläufe: Playwright).
- Schemaänderungen haben eine versionierte Migration in `packages/db/drizzle/`.
- `docs/` ist aktualisiert (Architektur, Subprozessoren, Datenschutz, GoBD – soweit betroffen).
- Harte Regeln a)–f) sind eingehalten.
