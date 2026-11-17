# MailMind

**KI-gestützte E-Mail-Zentrale für Firmen.** MailMind ruft eingehende E-Mails aus mehreren Postfächern ab und fasst sie mit Claude (Anthropic) zusammen. Jede E-Mail wird kategorisiert und priorisiert, Aufgaben und Fristen werden automatisch erkannt. So wissen Mitarbeiter morgens in zwei Minuten, was wichtig ist, was heute erledigt werden muss und was warten kann.

> **Stand: Phase 2 von 7**
> - Phase 1: Projekt-Setup, Datenbankschema, Anmeldung mit Rollen, Grundlayout (Light/Dark Mode, responsiv, Befehlspalette).
> - Phase 2: Postfach-Anbindung (IMAP, Gmail, Outlook, Demo), automatischer Abruf per Worker, Sync-Button, Abruf-Limits, Threads und Anhänge, KI-Modellwahl pro Firma, KI-Kosten im Admin-Dashboard.
> - Als Nächstes: Phase 3 – KI-Pipeline (Zusammenfassung, Kategorie, Priorität, Aufgaben).

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
| `npm run worker` | Hintergrund-Worker (Abruf-Scheduler, Sync-Jobs) |
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
| `ANTHROPIC_API_KEY` | für KI | API-Schlüssel von console.anthropic.com |
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

## KI-Modelle und Kosten

| Aufgabe | Modell (Standard) |
| --- | --- |
| Spam/Newsletter erkennen, Kategorie bestimmen | **Claude Haiku 5.5**: schnell und sehr günstig |
| Zusammenfassung, Priorität, Aufgaben, erkannte Daten, Antwortvorschläge, Thread-Zusammenfassung | **Claude Sonnet 5.5** |
| optional als Hauptmodell | **Claude Opus 5.5**: höchste Qualität, etwa doppelte Kosten von Sonnet |

Admins wählen die Modelle pro Firma unter **Einstellungen → Allgemein**. Ohne Firmeneinstellung gelten `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` aus der `.env`.

Jeder KI-Aufruf wird mit Tokens und Kosten protokolliert. Admins sehen im **Dashboard** die KI-Kosten von heute und vom laufenden Monat, eine Hochrechnung samt Vergleich zum Vormonat, den Verlauf der letzten 30 Tage nach Modell und eine Aufteilung nach Modell. Beträge in US-Dollar (Abrechnungswährung von Anthropic). Preise sind in `src/lib/ai/models.ts` hinterlegt.

## Tastaturkürzel

| Kürzel | Aktion |
| --- | --- |
| `⌘K` / `Strg+K` | Befehlspalette |
| `g` `d` | Dashboard |
| `g` `i` | Posteingang |
| `g` `k` | Kanban |
| `g` `a` | Aufgaben |
| `g` `e` | Einstellungen |

*(j/k, e, r und / folgen mit dem Posteingang in Phase 4.)*

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
│   │   ├── layout/          # Seitenleiste, Befehlspalette, Nutzermenü
│   │   └── shared/          # Seitenkopf, leere Zustände, Logo
│   ├── hooks/               # z. B. useHotkeys
│   ├── lib/                 # Auth, DB, Verschlüsselung, Rollen, Formatierung, KI-Modelle & Preise
│   ├── server/
│   │   ├── mail/            # Postfach-Anbindung: Connectoren (IMAP, Gmail, Outlook, Demo), Parser, Threading, Sync
│   │   ├── jobs/            # BullMQ-Warteschlangen, Sync-Auslöser
│   │   ├── queries/         # Datenabfragen (Seitenleiste, KI-Kosten)
│   │   ├── validation/      # zod-Schemas für API-Eingaben
│   │   └── …                # Sitzung, Mandant, Audit, API-Helfer
│   ├── worker/              # Hintergrund-Worker (npm run worker)
│   └── middleware.ts        # Zugriffsschutz
├── tests/                   # Integrationstests (Sync, IMAP-Testserver, KI-Kosten)
├── DECISIONS.md             # Architektur-Entscheidungen
└── docker-compose.yml
```

## Sicherheit & Datenschutz (Überblick)

- Postfach-Zugangsdaten und OAuth-Tokens werden AES-256-GCM-verschlüsselt gespeichert; MailMind hat nur Lesezugriff auf Postfächer.
- Anhänge werden nur als Metadaten (Name, Typ, Größe) gespeichert, nicht ihr Inhalt.
- Jede Abfrage ist auf die Firma des angemeldeten Nutzers beschränkt (Mandantentrennung).
- Audit-Log protokolliert Anmeldungen und (ab Phase 4) das Öffnen und Bearbeiten von E-Mails.
- Aufbewahrungsdauer und Maskierung sensibler Daten (IBAN, Telefonnummern) vor dem KI-Aufruf sind pro Firma einstellbar (Umsetzung Phase 3/7).
