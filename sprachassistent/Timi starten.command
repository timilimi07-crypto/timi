#!/bin/bash
# Startet Timi auf dem Mac: Doppelklick genügt.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt. Bitte installieren: https://nodejs.org/"
  read -p "Enter zum Schließen…"
  exit 1
fi
[ -d node_modules ] || npm install
[ -f .env ] || { cp .env.example .env; echo "Bitte trag deinen API-Schlüssel in die Datei .env ein."; open -e .env; }
URL="http://localhost:${PORT:-3000}"
(
  sleep 2
  # Als eigenes App-Fenster öffnen (Chrome oder Edge), sonst im Standardbrowser
  open -na "Google Chrome" --args --app="$URL" 2>/dev/null \
    || open -na "Microsoft Edge" --args --app="$URL" 2>/dev/null \
    || open "$URL"
) &
npm start
