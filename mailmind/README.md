# MailMind

**KI-gestützte E-Mail-Zentrale für Firmen.** MailMind ruft eingehende E-Mails aus mehreren Postfächern ab und fasst sie mit Claude (Anthropic) zusammen. Jede E-Mail wird kategorisiert und priorisiert, Aufgaben und Fristen werden automatisch erkannt. So wissen Mitarbeiter morgens in zwei Minuten, was wichtig ist, was heute erledigt werden muss und was warten kann.

> **Stand: Phase 5 von 7**
> - Phase 1: Projekt-Setup, Datenbankschema, Anmeldung mit Rollen, Grundlayout (Light/Dark Mode, responsiv, Befehlspalette).
> - Phase 2: Postfach-Anbindung (IMAP, Gmail, Outlook, Demo), automatischer Abruf per Worker, Sync-Button, Abruf-Limits, Threads und Anhänge, KI-Modellwahl pro Firma, KI-Kosten im Admin-Dashboard.
> - Phase 3: KI-Pipeline – Vorsortierung mit Haiku, Analyse mit Sonnet (Zusammenfassung, Kategorie, Priorität, Stimmung, Aufgaben, erkannte Daten), Sicherheit + „Bitte prüfen“, lernt aus Korrekturen, inkrementelle Thread-Zusammenfassung, Prompt-Caching, Maskierung, KI-Tageslimit, Qualitätstest.
> - Phase 4: Posteingang im 3-Spalten-Layout (Superhuman-Stil): Vorladen, optimistische Aktionen mit Rückgängig, Detailansicht, Volltextsuche, Filter, Tastaturkürzel, Phishing-Warnung.
> - Phase 5: Dashboard („Heute wichtig“, Fristen, Kennzahlen, Diagramme), Kanban mit Drag & Drop, Aufgaben-Ansicht.
> - Als Nächstes: Phase 6 – Team-Funktionen (Zuweisen, Notizen, Kommentare), Regel-Editor, Tages-Digest.

## Tech-Stack

| Bereich | Technik |
| --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react |
| Backend | Next.js Route Handlers & Server Actions |
| Datenbank | PostgreSQL 16 + Prisma ORM |
| Auth | NextAuth (E-Mail + Passwort, Rollen Admin/Manager/Mitarbeiter) |
| KI | Anthropic Claude API (Modell per `.env`) |
| Jobs | BullMQ + Redis (eigener Worker-Prozess) |
| E-Mail | imapflow + mailparser (IMAP), Gmail REST API, Microsoft Graph |
| Tests | Vitest |

## Schnellstart mit Docker

Voraussetzung: Docker mit Docker Compose.

```bash
cd mailmind
cp .env.example .env
# Schlüssel erzeugen und in .env eintragen:
openssl rand -base64 32   # → NEXTAUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY
docker compose up --build
```

Danach **http://localhost:3000** öffnen. Beim ersten Start werden die Datenbank-Migrationen ausgeführt und, solange `DEMO_MODE="true"` gesetzt ist, Demo-Daten angelegt: zwei Firmen, drei Demo-Postfächer mit rund 50 deutschen Beispiel-E-Mails und ein Demo-KI-Kostenverlauf.

Docker Compose startet fünf Dienste: `postgres`, `redis`, `migrate` (einmalig), `app` (Web-Oberfläche) und `worker` (automatischer Abruf, ab Phase 3 auch die KI-Verarbeitung).

> **Demo-Tipp:** Einige Beispiel-E-Mails „treffen erst 10–90 Minuten nach dem Start ein“. Klicke im Posteingang auf **Abrufen** oder warte auf den automatischen Abruf.

### Demo-Zugänge (Passwort für alle: `mailmind`)

| Firma | Rolle | E-Mail |
| --- | --- | --- |
| Müller & Partner GmbH | Admin | `admin@mueller-partner.de` |
| Müller & Partner GmbH | Manager | `manager@mueller-partner.de` |
| Müller & Partner GmbH | Mitarbeiter | `mitarbeiter@mueller-partner.de` |
| Nordlicht Logistik AG | Admin | `admin@nordlicht-logistik.de` |

Die zweite Firma zeigt die strikte Mandantentrennung: Wer sich dort anmeldet, sieht keine Daten von Müller & Partner.

## Lokale Entwicklung (ohne Docker für die App)

```bash
cd mailmind
npm install
cp .env.example .env              # Werte anpassen
docker compose up -d postgres redis
npm run db:migrate                # Migrationen anwenden + Prisma Client erzeugen
npm run db:seed                   # Demo-Daten (setzt Demo-Firmen zurück)
npm run dev                       # http://localhost:3000
npm run worker                    # zweites Terminal: automatischer Abruf
```

### Nützliche Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build && npm start` | Produktions-Build |
| `npm run worker` | Hintergrund-Worker (Abruf-Scheduler, Sync- und KI-Jobs) |
| `npm run ai:eval` | KI-Qualitätstest mit allen Demo-E-Mails (echte API-Aufrufe) |
| `npm test` | Tests (Vitest) – Integrationstests brauchen eine laufende Datenbank (`DATABASE_URL`) |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm run db:migrate` | Neue Migration erstellen/anwenden |
| `npm run db:seed` | Demo-Daten neu anlegen |
| `npm run db:reset` | Datenbank komplett zurücksetzen |

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DATABASE_URL` | ja | PostgreSQL-Verbindung |
| `REDIS_URL` | ja | Redis für die Job-Queue |
| `NEXTAUTH_URL` | ja | Öffentliche URL der App |
| `NEXTAUTH_SECRET` | ja | Geheimnis für Sitzungs-Tokens (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | ja | 32 Byte base64 – verschlüsselt Postfach-Zugangsdaten (AES-256-GCM) |
| `ANTHROPIC_API_KEY` | für KI | API-Schlüssel von console.anthropic.com. Ohne Schlüssel läuft alles außer der KI-Auswertung; E-Mails bleiben auf „KI-Auswertung ausstehend“ und werden nachgeholt, sobald der Schlüssel gesetzt und der Worker neu gestartet ist. |
| `ANTHROPIC_MODEL` | nein | Hauptmodell, Standard `claude-sonnet-5-5`; optional `claude-opus-5-5` |
| `ANTHROPIC_MODEL_FAST` | nein | Modell für einfache Aufgaben, Standard `claude-haiku-5-5` |
| `DEMO_MODE` | nein | `true` = Demo-Daten und Demo-Postfächer |
| `SMTP_URL`, `MAIL_FROM` | für Digest | Versand des täglichen Digests |
| `GOOGLE_CLIENT_ID/SECRET` | für Gmail | OAuth-Client aus der Google Cloud Console |
| `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` | für Outlook | App-Registrierung im Azure-Portal |

> **Wichtig:** Geht `ENCRYPTION_KEY` verloren, können gespeicherte Postfach-Zugangsdaten nicht mehr entschlüsselt werden. Die Postfächer müssen dann neu verbunden werden.

## Postfach verbinden

Als Admin: **Einstellungen → Postfächer → Postfach verbinden**. MailMind hat **nur Lesezugriff**: Es verschickt nichts und verändert nichts im Postfach (auch keine Gelesen-Markierung).

Beim Verbinden wählst du den **Zeitraum für den ersten Abruf** (Standard: letzte 30 Tage). Ältere E-Mails werden nicht abgerufen und nicht von der KI verarbeitet.

### IMAP (IONOS, Strato, GMX, WEB.DE, T-Online, eigener Server …)

1. „Anderer Anbieter (IMAP)“ wählen, Anbieter-Schnellwahl antippen oder Server und Port eintragen (meist Port 993 mit SSL/TLS).
2. Benutzername (meist die E-Mail-Adresse) und Passwort eintragen. Wenn dein Anbieter App-Passwörter anbietet, nutze eines.
3. **Verbindung testen**: zeigt, wie viele E-Mails im gewählten Zeitraum liegen.
4. **Verbinden**: Das Passwort wird AES-256-GCM-verschlüsselt gespeichert, der erste Abruf startet sofort.

### Gmail / Google Workspace

Einmalige Einrichtung in der [Google Cloud Console](https://console.cloud.google.com/):

1. Projekt anlegen und unter *APIs & Dienste → Bibliothek* die **Gmail API** aktivieren.
2. *OAuth-Zustimmungsbildschirm* einrichten. Für Google Workspace intern genügt „Intern“. Scope: `https://www.googleapis.com/auth/gmail.readonly`.
3. *Anmeldedaten → OAuth-Client-ID → Webanwendung*, autorisierte Weiterleitungs-URI:
   `https://<deine-domain>/api/mailboxes/oauth/google/callback` (lokal: `http://localhost:3000/api/mailboxes/oauth/google/callback`)
4. Client-ID und Secret als `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in die `.env` eintragen und die App neu starten.

Danach in MailMind „Gmail / Google Workspace“ wählen und mit dem Google-Konto anmelden.

### Microsoft 365 / Outlook / Exchange Online

Einmalige Einrichtung im [Azure-Portal](https://portal.azure.com/) → *Microsoft Entra ID → App-Registrierungen*:

1. *Neue Registrierung*, Plattform **Web**, Umleitungs-URI:
   `https://<deine-domain>/api/mailboxes/oauth/microsoft/callback`
2. *API-Berechtigungen → Microsoft Graph → Delegiert*: `Mail.Read`, `User.Read`, `offline_access`.
3. *Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel*.
4. In die `.env` eintragen: `MICROSOFT_CLIENT_ID` (Anwendungs-ID), `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (eure Verzeichnis-ID, oder `common` für beliebige Konten).

Danach in MailMind „Microsoft 365 / Outlook“ wählen und anmelden. Läuft die Anmeldung ab oder wird sie widerrufen, zeigt das Postfach einen Fehler. Dann einfach erneut verbinden: Die bisherigen E-Mails bleiben erhalten.

### Abruf und Limits

| Einstellung (Einstellungen → Allgemein) | Standard | Wirkung |
| --- | --- | --- |
| Abrufintervall | alle 5 Minuten | Wie oft der Worker alle Postfächer abruft. Zusätzlich gibt es den Button **Abrufen** im Posteingang bzw. **Jetzt abrufen** je Postfach. |
| Zeitraum beim ersten Abruf | letzte 30 Tage | Ältere E-Mails werden nie abgerufen. Pro Postfach beim Verbinden änderbar. |
| Max. E-Mails pro Abruf | 100 | Pro Postfach und Durchlauf, neueste zuerst. Ein Rückstand wird in den folgenden Durchläufen (jede Minute) schrittweise nachgeladen. |

So landen auch bei großen Postfächern nie tausende alte E-Mails auf einmal in der KI-Verarbeitung.

## KI-Auswertung

Jede neue E-Mail wird **genau einmal** ausgewertet (Worker, Warteschlange `ai-process`):

1. **Vorsortierung** mit Claude Haiku 5.5: Kategorie samt Sicherheit, Massen-E-Mail ja/nein, ein Satz Zusammenfassung.
2. **Newsletter und Spam** (Kategorien mit „automatisch einklappen“) werden bei sicherer Erkennung direkt abgeschlossen und eingeklappt. Die teure Hauptanalyse entfällt.
3. **Hauptanalyse** mit Claude Sonnet 5.5: Zusammenfassung (1–3 Sätze), Kategorie und Priorität (je mit Sicherheit 0–100 %), Begründung der Priorität, Stimmung des Absenders, Aufgaben mit Fristen, erkannte Daten (Beträge, Rechnungs-/Bestellnummern, Termine, Ansprechpartner).
4. **„Bitte prüfen“**: Liegt die Sicherheit bei Kategorie oder Priorität unter 70 %, wird die E-Mail markiert. Im Posteingang gibt es dafür einen eigenen Filter.
5. **Threads**: Eine neue Antwort wird einzeln ausgewertet, mit dem bisherigen Verlauf als Kontext. Danach wird nur die Thread-Zusammenfassung **inkrementell** ergänzt (bisherige Zusammenfassung + neue Nachricht). Ältere E-Mails werden nicht erneut gesendet.

**Lernen aus Korrekturen:** Ändert jemand Kategorie oder Priorität von Hand, wird das gespeichert. Die KI überschreibt die Änderung nicht mehr. Die letzten 20 Korrekturen der Firma fließen als Beispiele in den Prompt, mit Betreff, Absender-Domain und alter → neuer Einordnung.

**Kosten sparen:**
- *Prompt-Caching*: Die Anweisungen (gleich für alle Firmen) und der Firmenkontext (Kategorien und Korrekturen) stehen in zwei gecachten System-Blöcken. Nur die E-Mail selbst wird pro Aufruf neu berechnet.
- *Vorsortierung mit Haiku*: Newsletter und Spam kosten nur einen Bruchteil.
- *KI-Tageslimit* pro Firma (Standard 500 E-Mails/Tag, Einstellungen → Allgemein). Was darüber hinausgeht, wird am Folgetag ausgewertet.
- *Abruf-Limits* (siehe oben) begrenzen, wie viel überhaupt in die Warteschlange kommt.

**Robustheit:** Die Ausgabe ist strukturiert (JSON-Schema, mit zod geprüft). Ungültige oder abgeschnittene Antworten werden bis zu 3-mal wiederholt, Überlastung und Rate-Limits übernimmt das SDK. Lehnt Sonnet oder Opus eine Auswertung ab, springt serverseitig ein Ersatzmodell ein (`fallbacks: "default"`). Lehnen alle ab, wird die E-Mail mit „Bitte prüfen“ markiert. Jeder Versuch landet mit Tokens, Cache-Nutzung und Kosten im Protokoll.

**Datenschutz:** Ist die Maskierung aktiv (Standard), werden IBANs, Kreditkarten- und Telefonnummern vor dem KI-Aufruf durch Platzhalter ersetzt.

**Kosten pro E-Mail:** Admins sehen im Posteingang bei jeder E-Mail, welche Modelle sie ausgewertet haben und was das gekostet hat (inkl. Thread-Zusammenfassung).

### Qualitätstest mit den Demo-E-Mails

```bash
npm run ai:eval              # alle 60 Demo-E-Mails echt auswerten (ca. 1–2 $), Bericht: docs/ki-qualitaetstest.md
npm run ai:eval -- --keep    # Testfirma behalten, um die Ergebnisse in der App anzusehen
npm run ai:eval -- --dry-run # nur die Mechanik prüfen, ohne API (simulierte Antworten)
```

Der Bericht enthält pro E-Mail Kategorie, Priorität (mit Sicherheit), „Bitte prüfen“, Zusammenfassung, Aufgaben, Modell und Kosten. Dazu kommen ein Abgleich mit einer menschlichen Erwartung sowie Kosten- und Cache-Statistik.

## KI-Modelle und Kosten

| Aufgabe | Modell (Standard) |
| --- | --- |
| Spam/Newsletter erkennen, Kategorie bestimmen | **Claude Haiku 5.5**: schnell und sehr günstig |
| Zusammenfassung, Priorität, Aufgaben, erkannte Daten, Antwortvorschläge, Thread-Zusammenfassung | **Claude Sonnet 5.5** |
| optional als Hauptmodell | **Claude Opus 5.5**: höchste Qualität, etwa doppelte Kosten von Sonnet |

Admins wählen die Modelle pro Firma unter **Einstellungen → Allgemein**. Ohne Firmeneinstellung gelten `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` aus der `.env`.

Jeder KI-Aufruf wird mit Tokens und Kosten protokolliert. Admins sehen im **Dashboard** die KI-Kosten von heute und vom laufenden Monat, eine Hochrechnung samt Vergleich zum Vormonat, den Verlauf der letzten 30 Tage nach Modell und eine Aufteilung nach Modell. Beträge in US-Dollar (Abrechnungswährung von Anthropic). Preise sind in `src/lib/ai/models.ts` hinterlegt.

## Dashboard, Kanban, Aufgaben

**Dashboard:** Begrüßung mit Tageszusammenfassung („2 dringende E-Mails · 1 Aufgabe heute fällig“) und Kennzahlen (Neu, Dringend, Offene Aufgaben, Heute fällig + überfällig). Jede Kachel führt in die passend gefilterte Ansicht. Außerdem:
- Hinweise auf Phishing-Verdacht und „Bitte prüfen“
- **Heute wichtig**: offene Verläufe mit Dringend/Hoch, Phishing-Verdacht oder „Bitte prüfen“, Dringendes zuerst, mit KI-Zusammenfassung
- **Fristen**: überfällig, heute, morgen, nächste 7 Tage, direkt abhakbar
- Diagramme: E-Mails pro Tag (14 Tage) und pro Kategorie (7 Tage), jeweils mit Hover-Details
- für Admins: KI-Kosten

**Kanban:** Spalten Neu, In Bearbeitung, Wartet und Erledigt (die letzten 30). Karten ziehen ändert den Status des ganzen Verlaufs, sofort und mit „Rückgängig“. Per Tastatur: Griff fokussieren, Leertaste, ← → wechselt die Spalte, Leertaste legt ab. Auf Touch-Geräten gibt es zusätzlich ein Status-Auswahlfeld auf jeder Karte. Filter: Kategorie, Priorität, Sortierung, Newsletter & Spam.

**Aufgaben:** alle von der KI erkannten und eigenen To-dos, gruppiert nach überfällig, heute, morgen, diese Woche, später und ohne Frist.
- Neue Aufgabe mit Enter anlegen.
- Titel direkt bearbeiten, Frist per Datumsfeld ändern, abhaken, löschen. Alles wirkt sofort und wird bei Fehlern zurückgenommen.
- Link zur zugehörigen E-Mail, Suche, Reiter „Erledigt“ (letzte 30 Tage).

## Posteingang

Drei Spalten: App-Seitenleiste | Liste (eine Zeile pro Verlauf) | Detail. Auf Tablet und Handy erst die Liste, dann die Detailansicht mit Zurück-Pfeil.

- **Schnell:** Die erste Seite kommt fertig vom Server. Beim Durchklicken werden die nächsten zwei E-Mails und die vorherige im Hintergrund vorgeladen, ebenso beim Überfahren mit der Maus. Ein Wechsel mit `J`/`K` braucht so keine Anfrage an den Server (gemessen: ca. 40 ms bis zur Anzeige).
- **Optimistisch:** „Erledigt“ (`E`), gelesen/ungelesen, Kategorie, Priorität und Aufgaben ändern sich sofort. Der Server wird im Hintergrund aktualisiert, bei einem Fehler wird die Änderung automatisch zurückgenommen und gemeldet. `Z` macht „Erledigt“ rückgängig.
- **Verlauf:** „Erledigt“ gilt für den ganzen Verlauf. Kommt eine neue Antwort, taucht er wieder auf.
- **Suche:** Volltextsuche über Betreff, Absender, KI-Zusammenfassung und Text, mit deutschen Wortformen („Wartungsverträge“ findet „Wartungsvertrag“) und Präfixsuche beim Tippen. Auch Nummern wie `PO-2026-8841` werden gefunden. Aus der Befehlspalette (`⌘K`) kann direkt in allen E-Mails gesucht werden.
- **Filter:** Offen / Erledigt / Alle, Kategorie, Priorität, Status, Postfach, Absender, Zeitraum, Ungelesen, „Bitte prüfen“, Phishing-Verdacht, Newsletter & Spam. Sortierung nach Datum oder Wichtigkeit. Filter und ausgewählte E-Mail stehen in der URL (teilbar, Browser-Zurück funktioniert).
- **Phishing-Warnung:** Verdächtige E-Mails tragen in Liste und Detail einen roten Badge „Möglicher Phishing-Versuch“ und zeigen einen Warnkasten mit Gründen. Sie werden nicht eingeklappt, damit die Warnung sichtbar bleibt. Die Erkennung kombiniert eine Heuristik beim Abruf (sofort, ohne KI) mit der Einschätzung der KI.
- **Sicher anzeigen:** HTML-E-Mails werden bereinigt und in einem abgeschotteten Rahmen ohne JavaScript dargestellt. Externe Bilder (Tracking-Pixel) sind blockiert, bis man sie per Klick erlaubt.
- **Datenschutz:** Vorladen ändert nichts. Erst wenn eine E-Mail wirklich angezeigt wird (ab 0,7 s), wird sie als gelesen markiert und das Öffnen im Audit-Log festgehalten (höchstens einmal pro 30 Minuten und Person).
- **Antwortvorschlag:** `R` oder Button, Ton „Förmlich“, „Locker“ oder „Kurz“. Der Text ist bearbeitbar und lässt sich kopieren oder im E-Mail-Programm öffnen. MailMind verschickt nichts.

## Tastaturkürzel

| Kürzel | Aktion |
| --- | --- |
| `J` / `↓`, `K` / `↑` | Nächste / vorherige E-Mail |
| `E` | Erledigt (bzw. wieder öffnen) |
| `Z` | Letzte Aktion rückgängig |
| `R` | Antwortvorschlag erstellen |
| `U` | Gelesen / ungelesen |
| `1` `2` `3` `4` | Priorität Dringend / Hoch / Normal / Niedrig |
| `/` | Suche |
| `?` | Alle Kürzel anzeigen |
| `⌘K` / `Strg+K` | Befehlspalette (auch E-Mail-Suche) |
| `g` `d` | Dashboard |
| `g` `i` | Posteingang |
| `g` `k` | Kanban |
| `g` `a` | Aufgaben |
| `g` `e` | Einstellungen |

## Ordnerstruktur

```
mailmind/
├── prisma/
│   ├── schema.prisma        # Datenbankschema (alle Phasen)
│   ├── migrations/
│   └── seed.ts              # Demo-Daten
├── src/
│   ├── app/
│   │   ├── (auth)/login/    # Anmeldung
│   │   ├── (app)/           # Angemeldeter Bereich (Dashboard, Inbox, Kanban, Aufgaben, Einstellungen)
│   │   └── api/             # Route Handler (Auth, Health, Postfächer, Sync, OAuth, Firmeneinstellungen)
│   ├── components/
│   │   ├── ui/              # shadcn/ui-Basiskomponenten
│   │   ├── inbox/           # Posteingang: Liste, Detail, Filter, Datenschicht (TanStack Query)
│   │   ├── layout/          # Seitenleiste, Befehlspalette, Nutzermenü
│   │   └── shared/          # Seitenkopf, leere Zustände, Logo
│   ├── hooks/               # z. B. useHotkeys
│   ├── lib/                 # Auth, DB, Verschlüsselung, Rollen, Formatierung, KI-Modelle & Preise
│   ├── server/
│   │   ├── ai/              # KI-Pipeline: Claude-Client, Prompts, Schemas, Maskierung, Pipeline
│   │   ├── mail/            # Postfach-Anbindung: Connectoren (IMAP, Gmail, Outlook, Demo), Parser, Threading, Sync
│   │   ├── jobs/            # BullMQ-Warteschlangen, Sync-Auslöser
│   │   ├── queries/         # Datenabfragen (Seitenleiste, KI-Kosten)
│   │   ├── validation/      # zod-Schemas für API-Eingaben
│   │   └── …                # Sitzung, Mandant, Audit, API-Helfer
│   ├── worker/              # Hintergrund-Worker (npm run worker)
│   └── middleware.ts        # Zugriffsschutz
├── scripts/                 # KI-Qualitätstest (npm run ai:eval)
├── tests/                   # Integrationstests (Sync, IMAP-Testserver, KI-Pipeline, KI-Kosten)
├── DECISIONS.md             # Architektur-Entscheidungen
└── docker-compose.yml
```

## Sicherheit & Datenschutz (Überblick)

- Postfach-Zugangsdaten und OAuth-Tokens werden AES-256-GCM-verschlüsselt gespeichert; MailMind hat nur Lesezugriff auf Postfächer.
- Anhänge werden nur als Metadaten (Name, Typ, Größe) gespeichert, nicht ihr Inhalt.
- Jede Abfrage ist auf die Firma des angemeldeten Nutzers beschränkt (Mandantentrennung).
- Audit-Log protokolliert Anmeldungen und (ab Phase 4) das Öffnen und Bearbeiten von E-Mails.
- Aufbewahrungsdauer und Maskierung sensibler Daten (IBAN, Telefonnummern) vor dem KI-Aufruf sind pro Firma einstellbar (Umsetzung Phase 3/7).
