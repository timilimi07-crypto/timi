# Architektur

## Komponenten

| Komponente           | Technik                                                               | Aufgabe                                                                             |
| -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/web`           | Next.js 16 (App Router), React 19, Tailwind 4                         | UI, API-Routen (Upload, Anzeige, Export)                                            |
| `packages/core`      | TypeScript, `fast-xml-parser`                                         | Format-Erkennung, Parsing UBL/CII, Normalisierung, Plausibilität, Hash, LLM-Gateway |
| `packages/db`        | Drizzle ORM, PostgreSQL 17                                            | Schema, Migrationen, GoBD-Trigger                                                   |
| `services/validator` | KoSIT-Validator 1.6.3 + XRechnung 3.0.2 (Konfig. 2026-08-31), Java 21 | Formale Prüfung (XSD + Schematron) per HTTP                                         |
| Objektspeicher       | S3-kompatibel (lokal: MinIO-Fork `pgsty/minio`)                       | Unveränderte Originale + Prüfberichte (Object Lock)                                 |

## Datenfluss Eingangsrechnung (Zielbild MVP)

1. **Eingang** über Upload (später E-Mail-Postfach / MailMind-Anbindung).
2. **Hash:** SHA-256 über die unveränderten Bytes (`@erl/core` → `sha256Hex`).
3. **Ablage Original:** Objektspeicher mit Object Lock (WORM), Schlüssel enthält den Hash. Datenbankeintrag in
   `invoices` (Hash, Größe, MIME-Typ, Eingangszeit). Duplikate je Organisation über Unique-Index auf Hash.
4. **Parsing:** `parseInvoice()` liest die Kerndaten deterministisch aus dem XML (Regel a).
   ZUGFeRD/Factur-X-PDFs: eingebettetes XML extrahieren (noch offen), PDF bleibt als Original erhalten.
5. **Prüfung:** POST an den Validator (`VALIDATOR_URL`). Ergebnis + Bericht → `validation_runs`, Bericht
   in den Objektspeicher. Versionen von Validator und Konfiguration werden je Prüfung gespeichert.
6. **Plausibilität:** `checkPlausibility()` liefert zusätzliche, verständliche Hinweise.
7. **Anzeige:** Übersicht in einfachem Deutsch. Optional (Feature-Flag) Erklärtexte über `core/llm`.
8. **Export:** an Steuerbüro/Buchhaltung (Format offen, z. B. DATEV-Belegtransfer oder ZIP mit Original + CSV).
9. **Protokoll:** jede Aktion als Eintrag in `audit_events` (append-only).

## Validator

- Daemon-Modus: `java -jar validator.jar -s config/scenarios.xml -r config -D -H 0.0.0.0 -P 8080`
- `GET /server/health` (Health-Check), `POST /` mit XML-Body → Prüfbericht. HTTP 200 = annehmen,
  HTTP 406 = Ablehnung empfohlen.
- Versionen als Build-Argumente, siehe `services/validator/README.md`.

## Entscheidungen

- **pnpm-Workspace** ohne Turborepo (bewusst schlank; bei Bedarf nachrüstbar).
- **Drizzle statt Prisma:** SQL-nahe, versionierte SQL-Migrationen, eigene Trigger einfach als Custom-Migration.
- **Beträge als Dezimal-Strings / `numeric(19,4)`**, Rechnen in BigInt (`core/decimal.ts`).
- **Projekt liegt im Unterordner** `e-rechnungs-lotse/` des Repos `timi`; CI filtert per `paths`.
