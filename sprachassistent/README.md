# T.I.M.I. – dein persönlicher Assistent

Ein KI-Assistent im Stil von JARVIS, mit dem du dich ganz normal auf Deutsch unterhältst. Er kennt deinen Kalender, liest und schreibt Mails, verwaltet Aufgaben, merkt sich Dinge über dich, nutzt deine verbundenen Dienste (z. B. Notion) und zeigt alles in holografischen Fenstern an.

## Was er kann

- **Sprechen wie mit einem Menschen**: Er hört zu, antwortet laut und unterbricht sich, wenn du auf den Reaktor tippst. Im Modus **Auto** hört er nach jeder Antwort direkt wieder zu. Die **Leertaste** startet ebenfalls das Zuhören.
- **Fenster**: Kalender, Aufgaben, Gedächtnis, Mails, Protokoll und Dienste. Du öffnest sie über die Leiste links oder einfach per Sprache („Zeig mir meinen Kalender“). Die Fenster lassen sich verschieben und in der Größe ändern, und Timi merkt sich ihre Position. Für längere Infos (Mailtexte, Listen, Pläne) öffnet Timi selbst ein neues Fenster.
- **Google Kalender**: „Was steht heute an?“, „Trag mir Dienstag um 15 Uhr den Zahnarzt ein“
- **Gmail**: „Hab ich neue Mails?“, „Lies mir die Mail von Lea vor“, „Antworte ihr, dass ich Montag Zeit habe“. Vor dem Senden fragt er immer nach.
- **Aufgaben und Gedächtnis**: „Erinnere mich, Mama anzurufen“, „Merk dir, dass ich vegetarisch esse“
- **Weitere Dienste** wie Notion und Canva, oder jeder andere Dienst mit einer MCP-Schnittstelle
- **Websuche** für Wetter, Nachrichten, Öffnungszeiten …

## Installieren und starten

Du brauchst [Node.js](https://nodejs.org/) (Version 22 oder neuer) und einen [Anthropic-API-Schlüssel](https://console.anthropic.com/).

**Am einfachsten:** Doppelklick auf
- **`Timi starten.bat`** (Windows) oder
- **`Timi starten.command`** (Mac; beim ersten Mal per Rechtsklick → Öffnen)

Beim ersten Start öffnet sich die Datei `.env`. Trag dort deinen API-Schlüssel ein, speichere sie und starte noch einmal. Timi öffnet sich dann als eigenes App-Fenster.

**Oder im Terminal:**
```bash
cd sprachassistent
npm install
cp .env.example .env      # API-Schlüssel eintragen
npm start
```
Dann **http://localhost:3000** in Chrome oder Edge öffnen.

### Als App installieren

In Chrome oder Edge erscheint rechts in der Adresszeile ein **Installieren-Symbol** (⊕). Damit wird Timi zu einer echten App mit eigenem Icon im Startmenü bzw. Dock. Der Server (`Timi starten`) muss dafür laufen.

## Dienste verbinden

Öffne das Fenster **Dienste** (Leiste links, oder klick oben rechts auf die Statusanzeigen).

### Notion, Canva und andere

Ein Klick auf **Verbinden**, dann bei dem Dienst anmelden und den Zugriff erlauben. Fertig.

Über **Dienst hinzufügen** lässt sich jeder Dienst mit einer öffentlichen MCP-Adresse anbinden, z. B. Linear (`https://mcp.linear.app/mcp`) oder Asana.

> Spotify, Booking.com, Goodnotes, Shopify und Microsoft 365 sind bei Claude über eigene Integrationen angebunden, die es (noch) nicht als öffentliche Adresse für eigene Apps gibt. Sobald ein Anbieter eine MCP-Adresse veröffentlicht, kannst du sie hier eintragen.

### Google (Kalender und Gmail): einmalig, ca. 10 Minuten

Google lässt eigene Apps nur mit einem eigenen Zugang an deine Daten. Der Zugang gehört nur dir, und die Daten gehen direkt zwischen deinem Rechner und Google hin und her.

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) und lege oben ein neues Projekt an, zum Beispiel „Timi“.
2. Gehe zu **APIs & Dienste → Bibliothek** und aktiviere die **Google Calendar API** und die **Gmail API**.
3. Gehe zu **APIs & Dienste → OAuth-Zustimmungsbildschirm** (bzw. **Google Auth Platform**):
   - App-Name „Timi“, Nutzertyp **Extern**, deine E-Mail-Adresse eintragen.
   - Unter **Zielgruppe / Testnutzer** deine eigene Gmail-Adresse hinzufügen.
4. Gehe zu **Anmeldedaten / Clients → Client erstellen → OAuth-Client-ID**:
   - Anwendungstyp: **Webanwendung**
   - Autorisierte Weiterleitungs-URI: `http://localhost:3000/auth/google/callback`
5. Trag **Client-ID** und **Clientschlüssel** in deine `.env` ein:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
6. Starte Timi neu und klick unter **Dienste** bei Google auf **Verbinden**. Google warnt dabei, dass die App „nicht überprüft“ ist. Das ist normal, weil es deine eigene App ist: **Erweitert → Weiter zu Timi**.

> Solange die Google-App im Modus „Test“ ist, läuft die Anmeldung nach 7 Tagen ab. Dann einfach neu verbinden, oder auf dem Zustimmungsbildschirm **App veröffentlichen** wählen, dann bleibt sie dauerhaft gültig.

## Einstellungen (in `.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `ASSISTANT_NAME` | `Timi` | Wie der Assistent heißt |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Claude-Modell. `claude-haiku-5-5` ist schneller und deutlich günstiger |
| `ASSISTANT_EFFORT` | `low` | Denktiefe (`low` … `max`). Höher heißt gründlicher, aber langsamer |
| `TZ_USER` | `Europe/Berlin` | Zeitzone für Datum und Uhrzeit |
| `PORT` | `3000` | Port des Servers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Zugang für Google (siehe oben) |

## Aufbau

- `server.js`: Backend. Führt das Gespräch mit Claude und stellt die Werkzeuge bereit.
- `google.js`: Google Kalender und Gmail
- `mcp.js`: weitere Dienste über das Model Context Protocol
- `public/`: die Oberfläche. Spracherkennung und Sprachausgabe laufen über den Browser.
- `data/`: deine Aufgaben, Notizen und Anmeldungen. Diese Daten sind **geheim, nicht weitergeben**. Sie werden nicht ins Git-Repository übernommen.

Der Gesprächsverlauf liegt nur im Arbeitsspeicher. **Neu** beginnt ein frisches Gespräch. Aufgaben, Notizen und Verbindungen bleiben erhalten.
