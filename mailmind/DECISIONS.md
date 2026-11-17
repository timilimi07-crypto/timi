# Architektur-Entscheidungen (DECISIONS.md)

Hier werden Entscheidungen festgehalten, die in der Aufgabenstellung offen waren.
Format: **Entscheidung** – Begründung. Neue Einträge unten anhängen.

## Phase 1 – Setup, Schema, Auth, Layout

1. **Projekt liegt im Unterordner `mailmind/`.** – Das Repository enthält bereits andere Projekte (Shopify, Trading). So bleibt MailMind sauber getrennt.

2. **Next.js 15.5 statt 16.** – Next 16 ist neu (u. a. `middleware` → `proxy`); 15.5 ist ausgereift und wird von NextAuth v4 offiziell unterstützt. Upgrade später unkompliziert.

3. **NextAuth v4 (stabil) statt Auth.js v5 (Beta).** – Produktionsreife vor Neuheit. Login per E-Mail + Passwort (bcrypt), Sitzung als JWT (12 h). Rolle und `organizationId` stehen im Token, damit jede Seite den Mandanten ohne Extra-Abfrage kennt. SSO (Google/Microsoft-Login) kann später als weiterer Provider ergänzt werden.

4. **Prisma 6.19 statt 7.x.** – Prisma 7 ändert Konfiguration und Client-Generierung grundlegend (Driver-Adapter, `prisma.config.ts`). 6.x ist stabil und gut dokumentiert.

5. **Ein Nutzer gehört genau einer Firma.** – Einfacheres und sichereres Mandantenmodell (`User.organizationId`). Wer für mehrere Firmen arbeitet, bekommt je Firma ein Konto. Eine spätere Umstellung auf eine `Membership`-Tabelle ist möglich.

6. **Mandantentrennung auf Anwendungsebene.** – Jede fachliche Tabelle hat `organizationId`; alle Abfragen laufen über `scoped(session, where)` (`src/server/tenant.ts`). Row-Level-Security in Postgres wäre eine zusätzliche Absicherung, erschwert aber Migrationen/Worker – als mögliche Härtung in Phase 7 notiert.

7. **Rollen als statische Matrix** (`src/lib/rbac.ts`): Admin (alles), Manager (zuweisen, Regeln, Kategorien, Team-Statistik), Mitarbeiter (E-Mails/Aufgaben bearbeiten). Leicht testbar, an einer Stelle nachvollziehbar.

8. **Vollständiges Schema schon in Phase 1.** – Alle Tabellen (Threads, Aufgaben, erkannte Daten, Regeln, Audit-Log, KI-Kostenlog, Digest-Log) sind angelegt, damit spätere Phasen nur kleine Migrationen brauchen.

9. **Status-Workflow = Kanban-Spalten** (`NEW`, `IN_PROGRESS`, `WAITING`, `DONE`) direkt an der E-Mail. „Wer bearbeitet was“ = `assigneeId` + Audit-Log.

10. **Kommentare und interne Notizen in einer Tabelle** (`Comment.isNote`). – Notizen sind angeheftete Kommentare; eine zweite Tabelle brächte keinen Mehrwert.

11. **Zugangsdaten: AES-256-GCM mit versioniertem Format (`v1:…`).** – Schlüssel aus `ENCRYPTION_KEY` (32 Byte, base64). Das Präfix ermöglicht spätere Schlüsselrotation.

12. **Soft-Delete für E-Mails (`deletedAt`)** – Löschung erfolgt sofort für Nutzer unsichtbar; ein Job entfernt die Daten endgültig (Phase 7, Aufbewahrungsdauer).

13. **Zeitzone fest Europe/Berlin** für alle Anzeigen (`src/lib/format.ts`), unabhängig von der Server-Zeitzone.

14. **Schrift Geist als npm-Paket** statt `next/font/google` – kein Netzwerkzugriff beim Docker-Build nötig.

15. **shadcn/ui-Komponenten manuell eingebunden** (Code liegt in `src/components/ui`, wie bei shadcn üblich), Tailwind CSS v4 mit CSS-Variablen für Light/Dark Mode. `components.json` ist vorhanden, sodass `npx shadcn add …` weiterhin funktioniert.

16. **Standard-KI-Modell `claude-opus-5-5`**, über `ANTHROPIC_MODEL` und pro Firma (`Organization.aiModel`) überschreibbar.

17. **Docker: eigener `migrate`-Dienst** führt `prisma migrate deploy` aus und legt bei leerer DB Demo-Daten an (`--if-empty`), bevor die App startet. Das Produktions-Image selbst bleibt schlank (Next.js `standalone`).

18. **Zwei Demo-Firmen im Seed** (Müller & Partner GmbH, Nordlicht Logistik AG), um die Mandantentrennung direkt ausprobieren zu können. Die ~50 Beispiel-E-Mails kommen in Phase 2 zusammen mit dem Demo-Postfach-Provider.
