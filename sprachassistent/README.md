# Timi – dein Sprachassistent

Ein persönlicher Sprachassistent, mit dem du dich ganz normal auf Deutsch unterhalten kannst. Er hilft dir bei deinen Aufgaben, merkt sich Dinge über dich und kann im Web nachschauen.

## Was er kann

- **Freie Unterhaltung** per Sprache oder Text. Die Antworten werden vorgelesen, schon während sie entstehen.
- **Freihändig-Modus**: Nach jeder Antwort hört er automatisch wieder zu, wie bei einem echten Gespräch. Tippst du aufs Mikrofon, während er spricht, unterbrichst du ihn.
- **Aufgaben**: „Erinnere mich, morgen Mama anzurufen“, „Was steht noch an?“, „Hak das Einkaufen ab“
- **Gedächtnis**: „Merk dir, dass ich vegetarisch esse“. Diese Notizen bleiben auch nach einem Neustart erhalten.
- **Google Kalender**: „Was steht heute an?“, „Hab ich Freitag Nachmittag Zeit?“, „Trag mir Dienstag um 15 Uhr Zahnarzt ein“
- **Websuche** für aktuelle Infos (Wetter, Nachrichten, Öffnungszeiten …)

## Starten

Du brauchst [Node.js](https://nodejs.org/) (Version 22 oder neuer) und einen Anthropic-API-Schlüssel.

```bash
cd sprachassistent
npm install
cp .env.example .env      # dann den API-Schlüssel in .env eintragen
npm start
```

Danach **http://localhost:3000** in **Chrome, Edge oder Safari** öffnen und das Mikrofon erlauben.

## Google Kalender verbinden (einmalig, ca. 10 Minuten)

Damit Timi deine Termine lesen und eintragen darf, brauchst du einen eigenen Google-Zugang. Er gehört nur dir, und die Daten bleiben zwischen deinem Rechner und Google.

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) und lege oben ein neues Projekt an, zum Beispiel „Timi“.
2. Gehe zu **APIs & Dienste → Bibliothek**, suche **Google Calendar API** und klicke auf **Aktivieren**.
3. Gehe zu **APIs & Dienste → OAuth-Zustimmungsbildschirm** (bzw. **Google Auth Platform**):
   - App-Name: „Timi“, Nutzertyp **Extern**, deine E-Mail-Adresse eintragen.
   - Unter **Zielgruppe / Testnutzer** deine eigene Gmail-Adresse hinzufügen.
4. Gehe zu **Anmeldedaten / Clients → Client erstellen → OAuth-Client-ID**:
   - Anwendungstyp: **Webanwendung**
   - Autorisierte Weiterleitungs-URI: `http://localhost:3000/auth/google/callback`
5. Kopiere **Client-ID** und **Clientschlüssel** in deine `.env`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
6. Server neu starten (`npm start`), in der App oben auf **Kalender verbinden** tippen und den Zugriff erlauben. Google warnt dabei, dass die App „nicht überprüft“ ist. Das ist normal, weil es deine eigene App ist: **Erweitert → Weiter zu Timi**.

Danach bleibt die Verbindung bestehen, auch nach einem Neustart. Ein Klick auf **Kalender ✓** trennt sie wieder.

> Hinweis: Solange die App im Google-Modus „Test“ ist, läuft die Anmeldung nach 7 Tagen ab. Dann einfach neu verbinden, oder auf dem Zustimmungsbildschirm **App veröffentlichen** wählen, dann bleibt sie dauerhaft gültig.

## Einstellungen (in `.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `ASSISTANT_NAME` | `Timi` | Wie der Assistent heißt |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Claude-Modell. `claude-haiku-5-5` ist schneller und deutlich günstiger |
| `ASSISTANT_EFFORT` | `low` | Denktiefe (`low` … `max`). Höher heißt gründlicher, aber langsamer |
| `TZ_USER` | `Europe/Berlin` | Zeitzone für Datum und Uhrzeit |
| `PORT` | `3000` | Port des Servers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Zugang für den Google Kalender (siehe oben) |

## Aufbau

- `server.js`: Backend. Spricht mit Claude, hält den API-Schlüssel geheim und stellt die Werkzeuge bereit (Aufgaben, Notizen, Websuche).
- `public/`: Oberfläche. Spracherkennung und Sprachausgabe laufen über die Web Speech API des Browsers.
- `google.js`: Anbindung an den Google Kalender.
- `data/store.json`: Aufgaben und Notizen. Wird automatisch angelegt.
- `data/google-token.json`: deine Google-Anmeldung. Diese Datei ist geheim, nicht weitergeben.

Der Gesprächsverlauf liegt nur im Arbeitsspeicher. Mit „Neu“ beginnst du ein frisches Gespräch, und nach einem Neustart des Servers fängt das Gespräch ebenfalls neu an. Aufgaben und Notizen bleiben erhalten.
