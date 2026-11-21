# Restaurant Xanthi – Demo-Website

Unverbindlicher Entwurf für die Neugestaltung von „Restaurant Xanthi – Der Mecklenburger Grieche“ (Kritzmow).
Reines HTML/CSS/JS, kein Build-Schritt.

```
xanthi-demo/
├── index.html    Inhalte inkl. kompletter SPEISEKARTE, SEO-Meta-Tags, JSON-LD, SVG-Grafiken
├── style.css     Design-Tokens, Layout (mobile-first), Animationen
├── script.js     OBEN: Hinweisfeld (Betriebsurlaub) + Öffnungszeiten für den Live-Status
│                 UNTEN: Live-Status, Speisekarten-Tabs, Scroll-Animationen, Navigation
├── fonts/        Cormorant Garamond, Inter, GFS Didot (griechisch), lokal (SIL Open Font License)
├── vendor/       GSAP + ScrollTrigger (fixierte Bühne) und Lenis (sanftes Scrollen), lokal gehostet
├── favicon.svg
├── robots.txt    Demo: alles gesperrt
└── netlify.toml  Netlify-Konfiguration (noindex-Header, Caching)
```

## Speisekarte pflegen

Die Karte steht direkt in `index.html`, im Abschnitt `id="speisekarte"` (am Kommentar
„SPEISEKARTE – HIER PFLEGEN“ zu erkennen). Jedes Gericht ist eine Zeile:

```html
<li class="dish"><span class="dish__name">Gyros Teller</span><span class="dish__price">16,50 €</span><span class="dish__desc">mit Salat, Tzatziki und Pommes</span></li>
```

- **Preis ändern:** die Zahl in `dish__price` anpassen. Mit der Suche (Strg+F) nach dem Gericht springen.
- **Gericht hinzufügen oder löschen:** eine `<li>`-Zeile kopieren oder entfernen.
- **Vegetarisch:** `<abbr class="veg" title="vegetarisch">veg.</abbr>` hinter den Namen setzen.
- **Neue Kategorie:** einen `<section class="menu__cat">`-Block kopieren. `data-tab` ist die Beschriftung des Tabs, die `id` muss eindeutig sein.

Die Tabs und die Anzahl der Gerichte erzeugt JavaScript automatisch. Ohne JavaScript steht die ganze Karte untereinander da.

## Hausspezialitäten (die farbige Bühne)

Die vier großen Platten stehen in `index.html` im Bereich `data-stage` als `<article class="stage__slide …">`.
Titel, Untertitel, Spruch, Zutaten und `[Preis]` lassen sich dort direkt ändern. Die Farbe kommt aus der
Klasse (`stage__slide--blue`, `--terracotta`, `--olive`, `--night`). Ohne JavaScript stehen die Platten einfach untereinander.

## Lokal ansehen

- Schnell: `index.html` doppelklicken. Chrome lädt über `file://` aber keine lokalen Schriften, dann erscheinen Ersatzschriften.
- Originalgetreu: im Repo-Ordner `python3 -m http.server 8000` starten und <http://localhost:8000> öffnen
  (oder die VS-Code-Erweiterung „Live Server“ nutzen).
- Vorschau des Urlaubs-Hinweises: `index.html?hinweis-vorschau`

## Auf Netlify veröffentlichen

Repo in Netlify verbinden. Build-Befehl und Base directory leer lassen, Publish directory `.`.

## Vor dem Livegang

1. `noindex` entfernen (Meta-Tag in `index.html`, Header in `netlify.toml`, `robots.txt` öffnen).
2. Alle gelb markierten `[Platzhalter]` ersetzen, Foto-Platzhalter gegen echte Fotos (WebP, mit Alt-Text) tauschen.
3. Preise aktualisieren, Impressum und Datenschutz verlinken, Facebook-Link eintragen.
4. Im JSON-LD `url` und gegebenenfalls `image` ergänzen.
