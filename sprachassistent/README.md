# Timi – dein Sprachassistent

Ein persönlicher Sprachassistent, mit dem du dich ganz normal auf Deutsch unterhalten kannst. Er hilft dir bei deinen Aufgaben, merkt sich Dinge über dich und kann im Web nachschauen.

## Was er kann

- **Freie Unterhaltung** per Sprache oder Text. Die Antworten werden vorgelesen, schon während sie entstehen.
- **Freihändig-Modus**: Nach jeder Antwort hört er automatisch wieder zu, wie bei einem echten Gespräch. Tippst du aufs Mikrofon, während er spricht, unterbrichst du ihn.
- **Aufgaben**: „Erinnere mich, morgen Mama anzurufen“, „Was steht noch an?“, „Hak das Einkaufen ab“
- **Gedächtnis**: „Merk dir, dass ich vegetarisch esse“. Diese Notizen bleiben auch nach einem Neustart erhalten.
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

## Einstellungen (in `.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `ASSISTANT_NAME` | `Timi` | Wie der Assistent heißt |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Claude-Modell. `claude-haiku-5-5` ist schneller und deutlich günstiger |
| `ASSISTANT_EFFORT` | `low` | Denktiefe (`low` … `max`). Höher heißt gründlicher, aber langsamer |
| `TZ_USER` | `Europe/Berlin` | Zeitzone für Datum und Uhrzeit |
| `PORT` | `3000` | Port des Servers |

## Aufbau

- `server.js`: Backend. Spricht mit Claude, hält den API-Schlüssel geheim und stellt die Werkzeuge bereit (Aufgaben, Notizen, Websuche).
- `public/`: Oberfläche. Spracherkennung und Sprachausgabe laufen über die Web Speech API des Browsers.
- `data/store.json`: Aufgaben und Notizen. Wird automatisch angelegt.

Der Gesprächsverlauf liegt nur im Arbeitsspeicher. Mit „Neu“ beginnst du ein frisches Gespräch, und nach einem Neustart des Servers fängt das Gespräch ebenfalls neu an. Aufgaben und Notizen bleiben erhalten.
