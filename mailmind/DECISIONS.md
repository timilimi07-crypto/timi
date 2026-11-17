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

16. ~~Standard-KI-Modell `claude-opus-5-5`~~ – ersetzt durch Entscheidung 19.

17. **Docker: eigener `migrate`-Dienst** führt `prisma migrate deploy` aus und legt bei leerer DB Demo-Daten an (`--if-empty`), bevor die App startet. Das Produktions-Image selbst bleibt schlank (Next.js `standalone`).

18. **Zwei Demo-Firmen im Seed** (Müller & Partner GmbH, Nordlicht Logistik AG), um die Mandantentrennung direkt ausprobieren zu können. Die ~50 Beispiel-E-Mails kommen in Phase 2 zusammen mit dem Demo-Postfach-Provider.

## Phase 2 – Postfach-Anbindung & Sync

19. **Zwei Modellstufen statt eines Modells** (Wunsch nach Phase 1):
    - *Schnell* = **Claude Haiku 5.5** für einfache Aufgaben: Spam/Newsletter erkennen, Kategorie bestimmen („Triage“).
    - *Haupt* = **Claude Sonnet 5.5** für Zusammenfassung, Priorität, Stimmung, Aufgaben, erkannte Daten, Antwortvorschläge, Thread-Zusammenfassungen.
    - **Claude Opus 5.5** ist pro Firma als Hauptmodell wählbar (Einstellungen → Allgemein), nicht Standard.
    - Reihenfolge: Firmeneinstellung → `.env` (`ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_FAST`) → Standard. Ungültige Werte fallen auf den Standard zurück. Routing zentral in `src/lib/ai/models.ts` (`OPERATION_TIER`).
    - Geplant für Phase 3: Erkennt die Triage Newsletter/Spam, wird die teure Hauptanalyse übersprungen.

20. **KI-Kosten in US-Dollar.** Anthropic rechnet in USD ab; eine Umrechnung in Euro wäre ein schwankender Schätzwert. Preise pro Modell stehen an einer Stelle (`AI_MODELS` in `src/lib/ai/models.ts`). Annahmen: Cache-Schreibzugriffe = 1,25 × Eingabepreis, Haiku-Cache-Lesen = 10 % des Eingabepreises.

21. **KI-Kosten nur für Admins sichtbar** (neue Berechtigung `ai.costs`). Dashboard zeigt heute, laufender Monat, Hochrechnung (Monatswert ÷ vergangene Tage × Tage im Monat) mit Vergleich zum Vormonat, Tagesverlauf (30 Tage, gestapelt nach Modell) und Aufteilung nach Modell. Tages-/Monatsgrenzen in Europe/Berlin. Jedes Modell hat eine feste Farbe (validiert für Farbfehlsichtigkeit, hell und dunkel).

22. **Demo-Kostenverlauf im Seed.** Damit das Admin-Dashboard ohne API-Schlüssel etwas zeigt, erzeugt der Seed für die Demo-Firma Müller & Partner einen plausiblen, deterministischen Kostenverlauf der letzten 45 Tage. Echte Aufrufe ab Phase 3 landen in derselben Tabelle.

23. **Abruf-Limit in zwei Stufen** (Wunsch nach Phase 1):
    1. *Zeitfenster:* Beim ersten Abruf nur E-Mails der letzten **30 Tage** (`Organization.initialSyncDays`, pro Postfach beim Verbinden wählbar). Das Fenster wird im Sync-Zustand gespeichert und gilt dauerhaft für dieses Postfach.
    2. *Limit pro Lauf:* Höchstens **100 E-Mails** pro Postfach und Durchlauf (`maxEmailsPerSync`, 10–1000). Neueste zuerst; der Rest steht in `syncState.pending` und wird in den nächsten Durchläufen (Scheduler jede Minute bei Rückstand) nachgeladen.
    Damit gelangen auch höchstens so viele E-Mails pro Lauf in die KI-Warteschlange. Ein zusätzliches Tageslimit für KI-Aufrufe folgt in Phase 3.

24. **Einheitliche Connector-Schnittstelle** (`listChanges` → IDs neueste zuerst + Cursor, `fetchMessage` → normalisierte Nachricht). Cursor: IMAP UIDVALIDITY + höchste UID, Gmail `historyId` (Fallback auf Datumssuche bei abgelaufener ID), Outlook Graph `deltaLink`. IMAP und Gmail werden als RFC-822-Rohdaten geladen und mit `mailparser` einheitlich geparst.

25. **Nur Lesezugriff.** Gmail-Scope `gmail.readonly`, Microsoft `Mail.Read`. MailMind verändert nichts im Postfach (keine Gelesen-Markierung, kein Verschieben). Antworten werden später als Vorschlag zum Kopieren erzeugt, nicht versendet.

26. **Anhänge: nur Metadaten** (Name, Typ, Größe, Provider-Referenz). Inhalte werden nicht gespeichert (Datensparsamkeit, Speicherplatz) und können später bei Bedarf beim Provider nachgeladen werden. In HTML eingebettete Bilder zählen nicht als Anhang.

27. **Dubletten-Schutz:** eindeutiger Schlüssel `(mailboxId, providerMessageId)`. Bei IMAP ist die ID die Message-ID (stabil, auch wenn sich UIDVALIDITY ändert), ersatzweise `uid:<uidvalidity>:<uid>`.

28. **Threads:** Gmail `threadId` bzw. Graph `conversationId`; bei IMAP über References/In-Reply-To (Wurzel = erste Referenz), sonst normalisierter Betreff (AW:/WG:/Re:/Fwd: entfernt) + Absender.

29. **Sperre gegen parallele Abrufe** über `Mailbox.syncStartedAt` (atomares `updateMany`), nach 15 Minuten gilt eine Sperre als verwaist. Zusätzlich verhindert eine feste BullMQ-`jobId` doppelte Jobs.

30. **Sync-Button ohne Worker:** Läuft kein Worker (lokale Entwicklung ohne `npm run worker` bzw. Redis nicht erreichbar), wird der Abruf direkt im Request ausgeführt – mit denselben Limits. Mit Worker wird er mit hoher Priorität eingereiht.

31. **OAuth-State signiert** (HMAC mit `NEXTAUTH_SECRET`, 10 Minuten gültig, an Nutzer und Firma gebunden) – Schutz vor CSRF beim Rücksprung. Erneutes Verbinden desselben Kontos aktualisiert nur die Tokens. Erneuerte Tokens (Microsoft rotiert Refresh-Tokens) werden sofort verschlüsselt gespeichert.

32. **Demo-Postfächer nutzen den echten Sync-Pfad** (eigener `DEMO`-Connector). 60 Beispiel-E-Mails: 3 sind älter als 30 Tage (zeigen das Zeitfenster), 5 „treffen erst 10–90 Minuten nach dem Seed ein“ (zeigen den automatischen Abruf). Der Posteingang ist bis Phase 4 eine einfache Liste.

33. **Worker als eigener Prozess** (`npm run worker`, eigener Docker-Dienst). Der Scheduler ist ein BullMQ-Job-Scheduler (jede Minute, auch bei mehreren Workern nur einmal aktiv) und stellt fällige Postfächer ein; 3 Postfächer werden parallel abgerufen.

34. **IMAP-Ende-zu-Ende-Test mit lokalem Testserver** (`hoodiecrow-imap`, nur Dev-Abhängigkeit). Gmail/Outlook werden mit simulierten API-Antworten getestet, da echte Konten im Test nicht verfügbar sind.
