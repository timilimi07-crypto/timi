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

## Phase 3 – KI-Pipeline

35. **Zweistufige Pipeline:** Erst Vorsortierung mit Haiku 5.5. Ist das Ergebnis Newsletter/Spam mit Sicherheit ≥ 70 %, ist die Auswertung fertig (Priorität „Niedrig“, eingeklappt), ohne Sonnet. Sonst folgt die Hauptanalyse mit Sonnet 5.5. Sonnet legt die endgültige Kategorie fest und bekommt die Vorsortierung als Hinweis.

36. **„Nur einmal auswerten“:** E-Mails mit `aiStatus` DONE/SKIPPED werden nie erneut verarbeitet. Eine atomare Statusänderung (PENDING/FAILED → PROCESSING) verhindert Doppelverarbeitung durch parallele Worker. Antworten in einem Thread sind eigene E-Mails und werden einzeln ausgewertet, mit der bisherigen Thread-Zusammenfassung als Kontext.

37. **Inkrementelle Thread-Zusammenfassung:** `Thread.summarizedUntil` merkt sich die neueste berücksichtigte Nachricht. Bei neuen Antworten bekommt das Modell nur die bisherige Zusammenfassung und die neuen Nachrichten (deren Einzel-Zusammenfassung, für die neueste zusätzlich 1.500 Zeichen Wortlaut). Der Job ist pro Thread entprellt (15 s), damit mehrere schnelle Antworten nur einen Aufruf auslösen. Die Kosten werden der neuesten E-Mail zugerechnet.

38. **Prompt-Caching:** zwei gecachte System-Blöcke. (1) Statische Anweisungen, byte-identisch für alle Firmen. (2) Der Firmenkontext (Kategorien und letzte 20 Korrekturen) ist deterministisch sortiert und ändert sich nur bei neuen Korrekturen. Variable Daten (Empfangsdatum, E-Mail) stehen ausschließlich in der Nutzer-Nachricht. TTL 5 Minuten (Standard): Bei laufendem Abruf folgen Aufrufe dicht aufeinander. Caches gelten pro Modell, Haiku und Sonnet haben also je einen eigenen Cache.

39. **Sicherheit (Confidence) als Selbsteinschätzung des Modells (0–1)** für Kategorie und Priorität, mit Kalibrierungshinweisen im Prompt. Schwelle für „Bitte prüfen“: **0,7** (`REVIEW_THRESHOLD`). Der Grund wird mitgespeichert (z. B. „Kategorie unsicher (58 %)“). Auch Ablehnungen der KI führen zu „Bitte prüfen“.

40. **Korrekturen** (`ClassificationCorrection`) werden bei jeder manuellen Änderung von Kategorie oder Priorität gespeichert, mit maskiertem, gekürztem Betreff und Absender-Domain (keine vollständige Adresse, kein Text). Die E-Mail erhält `manualOverride` und wird von der KI nicht mehr umsortiert. Die letzten 20 Korrekturen der Firma stehen im gecachten Firmenblock.

41. **Effort:** Vorsortierung und Thread-Zusammenfassung `low`, Hauptanalyse `medium` (Qualität vor Kosten bei der wichtigsten Einschätzung). Thinking bleibt adaptiv (Standard der Modelle).

42. **Ersatzmodell bei Ablehnung:** Für Sonnet und Opus wird `fallbacks: "default"` gesendet (Beta `server-side-fallback-2026-07-01`). Lehnt das Modell eine Anfrage ab (z. B. bei Phishing-Mails), übernimmt serverseitig ein Ersatzmodell. Kosten werden mit dem tatsächlich antwortenden Modell berechnet. Haiku 5.5 hat keinen Fallback; dort wird die Ablehnung als „Bitte prüfen“ gemeldet.

43. **Strukturierte Ausgabe** über `client.beta.messages.parse` + `betaZodOutputFormat`. Kategorien sind pro Firma ein Enum, das Modell kann also keine unbekannten Kategorien liefern. Ungültige Fristen (kein ISO-Datum) werden verworfen, Platzhalter wie `[IBAN]` nicht als erkannte Daten gespeichert.

44. **Fehlerbehandlung:** Ungültige oder abgeschnittene Ausgabe wird bis zu 3-mal wiederholt (bei `max_tokens` mit verdoppeltem Limit). API-Fehler (nach den SDK-Wiederholungen) setzen die E-Mail auf FAILED zurück; BullMQ versucht den Job bis zu 3-mal mit exponentiellem Abstand erneut. Jeder Versuch steht im Kostenprotokoll.

45. **KI-Tageslimit** pro Firma (`aiDailyEmailLimit`, Standard 500, Tag = Europe/Berlin). Darüber hinaus wird der Job auf den Folgetag verschoben (zählt nicht als Fehlversuch).

46. **Nachholen:** Der Scheduler reiht jede Minute E-Mails mit Status PENDING ein, die nicht in der Warteschlange stehen (Seed, Abruf ohne Worker). Ohne `ANTHROPIC_API_KEY` startet der KI-Worker nicht; Admins sehen einen Hinweis im Posteingang.

47. **Keine Ersatz-Ergebnisse ohne API-Schlüssel.** Im Demo-Modus ohne Schlüssel bleiben E-Mails „ausstehend“, statt erfundene Zusammenfassungen zu zeigen. Der Qualitätstest (`npm run ai:eval`) läuft nur mit echten Aufrufen; `--dry-run` prüft ausschließlich die Mechanik und ist deutlich als Trockenlauf gekennzeichnet.

48. **Kosten pro E-Mail denormalisiert** (`Email.aiCostUsd`, `Email.aiModels`), damit die Liste ohne Aggregation über das Protokoll auskommt. Sichtbar nur für Admins (Berechtigung `ai.costs`).

## Phase 4 – Posteingang, Suche, Filter

49. **Phishing-Warnung zweistufig:** (1) Heuristik beim Abruf (`src/server/mail/phishing.ts`): ungewöhnliche Domains, Markenname im Absender ohne passende Domain, abweichende Antwortadresse, Zugangsdaten-/Drohformulierungen, Links auf IP-Adressen, riskante Anhänge (ZIP, EXE, Makro-Office …). Warnung ab 3 Punkten, bewusst konservativ: Keine der 56 harmlosen Demo-Mails schlägt an. (2) Die KI-Vorsortierung meldet zusätzlich `phishing` + Begründung. Markiert wird, wenn eins von beiden anschlägt. Phishing-Mails werden **nicht eingeklappt**, damit der rote Badge sichtbar bleibt. Das Ersatzmodell bei Ablehnungen bleibt aktiv (Wunsch des Nutzers).

50. **TanStack Query als Client-Cache.** Liste (unendliche Abfrage pro Filter) und Details (ein Eintrag pro E-Mail) liegen getrennt im Cache. Das ermöglicht Vorladen, sofortiges Umschalten und optimistische Updates mit automatischem Zurückrollen. Die erste Listenseite kommt serverseitig gerendert als `initialData`, es gibt also kein Lade-Flackern.

51. **Eine Zeile pro Verlauf** (neueste passende E-Mail), ermittelt per `DISTINCT ON` in einer SQL-Abfrage. „Erledigt“ gilt für den ganzen Verlauf (wie bei Superhuman). Eine neue Antwort hat Status „Neu“ und holt den Verlauf zurück in „Offen“.

52. **Cursor-Paginierung** über (Rang, Empfangszeit, ID) statt OFFSET: stabil, auch wenn währenddessen neue E-Mails eintreffen, und für beide Sortierungen (Datum, Wichtigkeit) gleich.

53. **Volltextsuche in Postgres** über eine generierte `tsvector`-Spalte (deutsch für Betreff, Zusammenfassung und Text; „simple“ für Namen und Adressen), gewichtet A/B/C, mit GIN-Index. Präfixsuche beim Tippen (`wort:*`), ergänzt um ILIKE für Nummern und Adressen. Kein externer Suchdienst nötig.

54. **Detail-Abfrage ohne Seiteneffekte**, damit Vorladen nichts verfälscht. „Gelesen“ und der Audit-Eintrag `email.view` kommen erst über `POST /open`, wenn die E-Mail 0,7 s angezeigt wurde. Schnelles Durchblättern mit J/K markiert also nicht alles als gelesen. Audit-Einträge pro Person und E-Mail höchstens alle 30 Minuten.

55. **Rückgängig serverseitig abgesichert:** Der Status-Endpunkt liefert die vorherigen Status aller betroffenen E-Mails; `restore-status` setzt sie zurück, beschränkt auf die eigene Firma.

56. **HTML-Mails:** serverseitig mit `sanitize-html` bereinigt und im Client in einem iframe mit `sandbox` ohne `allow-scripts` und strenger CSP angezeigt. Externe Bilder sind standardmäßig blockiert (Tracking-Schutz) und lassen sich pro E-Mail freigeben.

57. **Filter und Auswahl in der URL** per `history.replaceState`, also ohne Seitenwechsel. Links aus der Seitenleiste (Kategorie, Postfach) bauen die Ansicht neu auf.

58. **Globale Tastenkürzel laufen in der Capture-Phase** und markieren behandelte Tasten, damit Sequenzen wie `G E` nicht zusätzlich das `E` (Erledigt) des Posteingangs auslösen.

59. **Antwortvorschläge** mit dem Hauptmodell (Effort `low` für schnelle Antwort), Platzhalter in eckigen Klammern statt erfundener Fakten, gespeichert als `ReplyDraft`. Kosten erscheinen im KI-Kostenprotokoll (Dashboard), nicht in den Auswertungskosten der einzelnen E-Mail.

## Phase 5 – Dashboard, Kanban, Aufgaben

60. **Status eines Verlaufs = Status seiner neuesten E-Mail.** Der Statusfilter wird erst nach der Auswahl der neuesten E-Mail je Verlauf angewendet. Vorher stand ein erledigter Verlauf mit neuer Antwort in „Offen“ und „Erledigt“ gleichzeitig (im Kanban in zwei Spalten). Mit Regressionstest.

61. **„Heute wichtig“** = offene Verläufe mit Priorität Dringend/Hoch, Phishing-Verdacht oder „Bitte prüfen“, sortiert nach Wichtigkeit (max. 8). Nutzt dieselbe Abfrage wie der Posteingang, die Ergebnisse sind also deckungsgleich.

62. **Fristen werden als 12:00 UTC des Kalendertags gespeichert** (KI und manuell gleich). Der Tag ist damit in jeder Zeitzone eindeutig; „heute“, „morgen“ und „überfällig“ werden in Europe/Berlin bestimmt.

63. **Dashboard-Diagramme einfarbig** (je eine Datenreihe, Farbe `--series-1`, hell/dunkel abgestimmt). Keine Legende nötig, Werte per Hover bzw. als Beschriftung. Kategorien als horizontale Balken, sortiert nach Anzahl.

64. **Kanban mit `@dnd-kit/core`** (zugänglich, Tastatursteuerung). Pfeiltasten springen direkt in die Nachbarspalte statt in Pixelschritten. Auf Touch-Geräten (`hover: none`) zeigen Karten zusätzlich ein Status-Auswahlfeld, weil Ziehen über den Bildschirmrand auf schmalen Displays unzuverlässig ist. „Erledigt“ zeigt die letzten 30 Verläufe.

65. **Aufgaben-Ansicht** zeigt alle offenen Aufgaben und die in den letzten 30 Tagen erledigten. Aufgaben gelöschter E-Mails werden ausgeblendet. Löschen ist auch für KI-Aufgaben erlaubt (z. B. wenn die KI etwas Unnötiges erkannt hat). Zuweisen an Personen folgt in Phase 6.

66. **Regressionstest für die Client/Server-Grenze** (`src/lib/client-boundary.test.ts`): Server-Module dürfen aus `"use client"`-Modulen nur Komponenten und Typen importieren. Dieser Fehler trat zweimal auf (Funktion `shortDate`, Konstante `STATUSES`) und zeigt sich sonst erst zur Laufzeit. Gemeinsame Hilfsfunktionen liegen deshalb in neutralen Modulen (`lib/format.ts`, `components/kanban/statuses.ts`).
