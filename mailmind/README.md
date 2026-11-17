# MailMind

**KI-gestützte E-Mail-Zentrale für Firmen.** MailMind ruft eingehende E-Mails aus mehreren Postfächern ab und fasst sie mit Claude (Anthropic) zusammen. Jede E-Mail wird kategorisiert und priorisiert, Aufgaben und Fristen werden automatisch erkannt. So wissen Mitarbeiter morgens in zwei Minuten, was wichtig ist, was heute erledigt werden muss und was warten kann.

> **Stand: Phase 1 von 7** – Projekt-Setup, Datenbankschema, Anmeldung mit Rollen, Grundlayout (Light/Dark Mode, responsiv, Befehlspalette). Postfach-Anbindung und KI-Pipeline folgen in den nächsten Phasen.

## Tech-Stack

| Bereich | Technik |
| --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react |
| Backend | Next.js Route Handlers & Server Actions |
| Datenbank | PostgreSQL 16 + Prisma ORM |
| Auth | NextAuth (E-Mail + Passwort, Rollen Admin/Manager/Mitarbeiter) |
| KI | Anthropic Claude API (Modell per `.env`) |
| Jobs | BullMQ + Redis (ab Phase 2) |
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

Danach **http://localhost:3000** öffnen. Beim ersten Start werden die Datenbank-Migrationen ausgeführt und, solange `DEMO_MODE="true"` gesetzt ist, Demo-Daten angelegt.

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
```

### Nützliche Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build && npm start` | Produktions-Build |
| `npm test` | Tests (Vitest) |
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
| `ANTHROPIC_MODEL` | nein | Standard `claude-opus-5-5`; z. B. `claude-sonnet-5-5` oder `claude-haiku-5-5` für geringere Kosten |
| `DEMO_MODE` | nein | `true` = Demo-Daten und Demo-Postfächer |
| `SMTP_URL`, `MAIL_FROM` | für Digest | Versand des täglichen Digests |
| `GOOGLE_CLIENT_ID/SECRET` | für Gmail | OAuth-Client aus der Google Cloud Console |
| `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` | für Outlook | App-Registrierung im Azure-Portal |

> **Wichtig:** Geht `ENCRYPTION_KEY` verloren, können gespeicherte Postfach-Zugangsdaten nicht mehr entschlüsselt werden. Die Postfächer müssen dann neu verbunden werden.

## Postfach verbinden

*(Wird in Phase 2 umgesetzt und hier ausführlich beschrieben: IMAP, Gmail per OAuth, Microsoft 365/Outlook per Microsoft Graph.)*

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
│   │   └── api/             # Route Handler (Auth, Health)
│   ├── components/
│   │   ├── ui/              # shadcn/ui-Basiskomponenten
│   │   ├── layout/          # Seitenleiste, Befehlspalette, Nutzermenü
│   │   └── shared/          # Seitenkopf, leere Zustände, Logo
│   ├── hooks/               # z. B. useHotkeys
│   ├── lib/                 # Auth, DB, Verschlüsselung, Rollen, Formatierung
│   ├── server/              # Serverseitige Logik: Sitzung, Mandant, Audit, Abfragen
│   └── middleware.ts        # Zugriffsschutz
├── DECISIONS.md             # Architektur-Entscheidungen
└── docker-compose.yml
```

## Sicherheit & Datenschutz (Überblick)

- Postfach-Zugangsdaten werden AES-256-GCM-verschlüsselt gespeichert.
- Jede Abfrage ist auf die Firma des angemeldeten Nutzers beschränkt (Mandantentrennung).
- Audit-Log protokolliert Anmeldungen und (ab Phase 4) das Öffnen und Bearbeiten von E-Mails.
- Aufbewahrungsdauer und Maskierung sensibler Daten (IBAN, Telefonnummern) vor dem KI-Aufruf sind pro Firma einstellbar (Umsetzung Phase 3/7).
