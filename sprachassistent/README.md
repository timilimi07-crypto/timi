# T.I.M.I. – dein persönlicher Assistent

Ein KI-Assistent im Stil von JARVIS, mit dem du dich ganz normal auf Deutsch unterhältst. Er kennt deinen Kalender, liest und schreibt Mails, verwaltet Aufgaben, merkt sich Dinge über dich, nutzt deine verbundenen Dienste (z. B. Notion) und zeigt alles in holografischen Fenstern an.

## Was er kann

- **Sprechen wie mit einem Menschen**: Er hört zu, antwortet laut und unterbricht sich, wenn du auf den Reaktor tippst. Im Modus **Auto** hört er nach jeder Antwort direkt wieder zu. Die **Leertaste** startet ebenfalls das Zuhören.
- **Fenster**: Kalender, Aufgaben, Gedächtnis, Mails, Protokoll und Dienste. Du öffnest sie über die Leiste links oder einfach per Sprache („Zeig mir meinen Kalender“). Die Fenster lassen sich verschieben und in der Größe ändern, und Timi merkt sich ihre Position. Für längere Infos (Mailtexte, Listen, Pläne) öffnet Timi selbst ein neues Fenster.
- **Google Kalender**: „Was steht heute an?“, „Trag mir Dienstag um 15 Uhr den Zahnarzt ein“
- **Gmail**: „Hab ich neue Mails?“, „Lies mir die Mail von Lea vor“, „Antworte ihr, dass ich Montag Zeit habe“. Vor dem Senden fragt er immer nach.
- **Spotify**: „Spiel Get Lucky“, „Mach was zum Entspannen an“, „Lauter“, „Nächster Song“, „Was läuft gerade?“, dazu ein Musik-Fenster mit Cover und Steuerung
- **Designs**: JARVIS, Mark (Iron-Man-Rot und Gold), Matrix, Synthwave, Nordlicht und ein helles Tag-Design. Schriftart und Schriftgröße sind einstellbar, per Fenster **Design** oder per Sprache („Wechsel auf Matrix“).
- **Aufgaben und Gedächtnis**: „Erinnere mich, Mama anzurufen“, „Merk dir, dass ich vegetarisch esse“
- **Weitere Dienste** wie Notion und Canva, oder jeder andere Dienst mit einer MCP-Schnittstelle
- **Websuche** für Wetter, Nachrichten, Öffnungszeiten …

## Kostenlos nutzen

Timi braucht ein „KI-Gehirn“. Du wählst es in der App unter dem **Zahnrad → KI-Gehirn**:

| Gehirn | Kosten | Was du brauchst |
|---|---|---|
| **Google Gemini** | **gratis** (mit Tageslimit) | Kostenlosen Schlüssel auf [aistudio.google.com/apikey](https://aistudio.google.com/apikey) mit deinem Google-Konto erstellen, ohne Kreditkarte. Im Gratis-Tarif darf Google die Gespräche zur Verbesserung seiner KI nutzen. |
| **Ollama** | **komplett gratis**, privat | [Ollama](https://ollama.com/download) installieren und einmal `ollama pull qwen2.5:7b` in der Eingabeaufforderung ausführen. Läuft auf deinem Computer (mind. 8 GB Arbeitsspeicher), es geht nichts ins Internet. |
| **Claude** | nach Verbrauch | Guthaben und API-Schlüssel auf [console.anthropic.com](https://console.anthropic.com). Am klügsten; mit dem Modell `claude-haiku-5-5` deutlich günstiger. |

Kalender, Mails, Spotify, Aufgaben und Fenster funktionieren mit allen drei. Die **Websuche** gibt es nur mit Claude.

## App herunterladen (empfohlen)

Die fertige App für **Windows** und **Mac** (Apple-Chip, M1 oder neuer) wird automatisch gebaut. Sie liegt auf der Seite **[Timi – Download](https://github.com/timilimi07-crypto/timi/releases/tag/timi-app)**.

1. `Timi-Windows.zip` oder `Timi-Mac.zip` herunterladen und entpacken.
2. **Windows:** `Timi.exe` doppelklicken. Erscheint „Der Computer wurde durch Windows geschützt“, dann **Weitere Informationen → Trotzdem ausführen**.
   **Mac:** `Timi.app` in den Programme-Ordner ziehen und beim ersten Mal per **Rechtsklick → Öffnen** starten.
3. Timi öffnet sich als eigenes Fenster. Beim ersten Start wählst du das KI-Gehirn, z. B. das kostenlose Gemini (siehe oben). Node.js brauchst du nicht.

Deine Daten liegen im normalen App-Ordner (Windows: `%APPDATA%\Timi`, Mac: `~/Library/Application Support/Timi`). Beenden kannst du Timi über das Zahnrad oben rechts.

> Die Warnungen von Windows und macOS erscheinen, weil die App nicht bei Microsoft bzw. Apple gegen Gebühr signiert ist. Das ist bei selbst gebauten Apps normal.

## iPad und iPhone

Auf dem iPad läuft Timi im Internet auf deinem eigenen kleinen Server, geschützt mit deinem Passwort. Auf dem iPad öffnest du ihn wie eine App vom Home-Bildschirm. Das geht auch auf dem iPhone und auf jedem anderen Computer, auch unterwegs.

### Einrichten (einmalig, ca. 10 Minuten)

1. Erstelle auf **[render.com](https://render.com)** ein Konto. Am einfachsten mit **„Sign up with GitHub“**.
2. Klick oben auf **New → Blueprint** und wähle das Repository **timilimi07-crypto/timi**. Render liest die Einstellungen automatisch aus der Datei `render.yaml`.
3. Render fragt nach zwei Werten:
   - **TIMI_PASSWORT**: dein Passwort für Timi. Nimm ein **langes, sicheres** Passwort, denn Timi kommt damit an deine Mails und Termine.
   - **ANTHROPIC_API_KEY**: dein API-Schlüssel
4. Klick auf **Apply**. Nach ein paar Minuten bekommst du eine Adresse wie `https://timi-xxxx.onrender.com`.

> **Kosten:** Render berechnet für Dauerbetrieb mit Speicherplatz für deine Daten etwa 7–8 US-Dollar im Monat (Tarif „Starter“ plus 1 GB Festplatte). Die Abrechnung läuft direkt über Render.

### Auf dem iPad installieren

1. Öffne die Adresse in **Safari** und melde dich mit deinem Passwort an.
2. Tippe auf **Teilen** (□↑) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Ab jetzt öffnest du Timi über das Symbol auf dem Home-Bildschirm.

Damit die Spracherkennung funktioniert, muss auf dem iPad unter **Einstellungen → Allgemein → Tastatur** die **Diktierfunktion** eingeschaltet sein. Beim ersten Sprechen fragt Safari nach dem Mikrofon. Falls die Spracheingabe in der Home-Bildschirm-App nicht klappt, öffne Timi direkt in Safari. Das liegt an Apple, nicht an Timi.

### Google und Spotify in der Cloud

Trag die neue Adresse zusätzlich als Weiterleitung ein:
- Google Cloud Console → deine OAuth-Client-ID → **Autorisierte Weiterleitungs-URIs**: `https://DEINE-ADRESSE/auth/google/callback`
- Spotify Developer Dashboard → deine App → **Redirect URIs**: `https://DEINE-ADRESSE/auth/spotify/callback`

Client-IDs und Schlüssel trägst du dann in Timi unter dem **Zahnrad** ein.

## Selbst starten (für Entwickler)

Du brauchst [Node.js](https://nodejs.org/) (Version 22 oder neuer) und einen [Anthropic-API-Schlüssel](https://console.anthropic.com/).

**Am einfachsten:** Doppelklick auf
- **`Timi starten.bat`** (Windows) oder
- **`Timi starten.command`** (Mac; beim ersten Mal per Rechtsklick → Öffnen)

Timi öffnet sich als eigenes App-Fenster. Den API-Schlüssel und die Zugänge für Google und Spotify kannst du direkt in der App unter dem Zahnrad eintragen, alternativ in der Datei `.env`.

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

> Booking.com, Goodnotes, Shopify und Microsoft 365 sind bei Claude über eigene Integrationen angebunden, die es (noch) nicht als öffentliche Adresse für eigene Apps gibt. Sobald ein Anbieter eine MCP-Adresse veröffentlicht, kannst du sie hier eintragen.

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
5. Trag **Client-ID** und **Clientschlüssel** in Timi unter dem **Zahnrad (Einstellungen)** ein, oder in deine `.env`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
6. Starte Timi neu und klick unter **Dienste** bei Google auf **Verbinden**. Google warnt dabei, dass die App „nicht überprüft“ ist. Das ist normal, weil es deine eigene App ist: **Erweitert → Weiter zu Timi**.

> Solange die Google-App im Modus „Test“ ist, läuft die Anmeldung nach 7 Tagen ab. Dann einfach neu verbinden, oder auf dem Zustimmungsbildschirm **App veröffentlichen** wählen, dann bleibt sie dauerhaft gültig.

### Spotify: einmalig, ca. 5 Minuten

1. Öffne das [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), melde dich an und klick auf **Create app**.
2. Name „Timi“, Beschreibung beliebig. Als **Redirect URI** trägst du genau `http://127.0.0.1:3000/auth/spotify/callback` ein (Spotify erlaubt hier kein „localhost“). Bei den APIs wählst du **Web API**. Dann speichern.
3. Unter **Settings** findest du **Client ID** und **Client secret**. Trag beide in Timi unter dem **Zahnrad (Einstellungen)** ein, oder in deine `.env`:
   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```
4. Falls es dort **User Management** gibt, trag deine Spotify-E-Mail-Adresse ein.
5. Starte Timi neu und klick unter **Dienste** bei Spotify auf **Verbinden**.

> Abspielen und Steuern geht nur mit **Spotify Premium**, so legt es Spotify fest. Außerdem muss Spotify auf irgendeinem Gerät (Handy, Computer, Lautsprecher) einmal geöffnet sein, damit Timi weiß, wo die Musik laufen soll.

## Einstellungen (in `.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `ASSISTANT_NAME` | `Timi` | Wie der Assistent heißt |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Claude-Modell. `claude-haiku-5-5` ist schneller und deutlich günstiger |
| `ASSISTANT_EFFORT` | `low` | Denktiefe (`low` … `max`). Höher heißt gründlicher, aber langsamer |
| `TZ_USER` | `Europe/Berlin` | Zeitzone für Datum und Uhrzeit |
| `PORT` | `3000` | Port des Servers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Zugang für Google (siehe oben) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | – | Zugang für Spotify (siehe oben) |

## Aufbau

- `server.js`: Backend. Führt das Gespräch mit Claude und stellt die Werkzeuge bereit.
- `google.js`: Google Kalender und Gmail
- `spotify.js`: Spotify
- `mcp.js`: weitere Dienste über das Model Context Protocol
- `providers.js`: kostenlose KI-Anbieter (Gemini, Ollama)
- `paths.js`: Datenordner und Einstellungen
- `auth.js`: Passwortschutz für den Cloud-Betrieb (`TIMI_CLOUD=1`, `TIMI_PASSWORT`)
- `../render.yaml`: Einrichtung für Render (iPad-/Cloud-Version)
- `build/`: baut die fertige App (`npm run build`); auf GitHub passiert das automatisch.
- `public/`: die Oberfläche. Spracherkennung und Sprachausgabe laufen über den Browser.
- `data/`: deine Aufgaben, Notizen und Anmeldungen. Diese Daten sind **geheim, nicht weitergeben**. Sie werden nicht ins Git-Repository übernommen.

Der Gesprächsverlauf liegt nur im Arbeitsspeicher. **Neu** beginnt ein frisches Gespräch. Aufgaben, Notizen und Verbindungen bleiben erhalten.
