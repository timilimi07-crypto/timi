# Restaurant Xanthi – Demo-Website

Unverbindlicher Entwurf für die Neugestaltung von „Restaurant Xanthi – Der Mecklenburger Grieche“ (Kritzmow).
Reines HTML/CSS/JS, kein Build-Schritt.

```
xanthi/
├── index.html    Inhalte, SEO-Meta-Tags, JSON-LD, SVG-Icons/-Grafiken
├── style.css     Design-Tokens, Layout (mobile-first), Animationen
├── script.js     OBEN: Hinweisfeld, Öffnungszeiten, Speisekarte (vom Inhaber pflegbar)
│                 UNTEN: Live-Status, Tabs, Scroll-Animationen, Navigation
├── fonts/        Cormorant Garamond + Inter, lokal (SIL Open Font License)
├── favicon.svg
├── robots.txt    Demo: alles gesperrt
└── netlify.toml  Netlify-Konfiguration (noindex-Header, Caching)
```

## Lokal ansehen

- Schnell: `index.html` doppelklicken. Chrome lädt über `file://` aber keine lokalen Schriften, dann erscheinen Ersatzschriften.
- Originalgetreu: im Ordner `xanthi` `python3 -m http.server 8000` starten und <http://localhost:8000> öffnen
  (oder die VS-Code-Erweiterung „Live Server“ nutzen).
- Vorschau des Urlaubs-Hinweises: `index.html?hinweis-vorschau`

## Auf Netlify veröffentlichen

Repo in Netlify verbinden, **Base directory: `xanthi`**, Build-Befehl leer lassen, Publish directory `.`.

## Vor dem Livegang

1. `noindex` entfernen (Meta-Tag in `index.html`, Header in `netlify.toml`, `robots.txt` öffnen).
2. Alle gelb markierten `[Platzhalter]` ersetzen, Foto-Platzhalter gegen echte Fotos (WebP, mit Alt-Text) tauschen.
3. Preise aktualisieren (`SPEISEKARTE` in `script.js`), Impressum und Datenschutz verlinken, Facebook-Link eintragen.
4. Im JSON-LD `url` und gegebenenfalls `image` ergänzen.
