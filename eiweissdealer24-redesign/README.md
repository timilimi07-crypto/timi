# Eiweissdealer24 – Redesign-Prototyp (Pitch)

Zwei Teile:

- **`landing.html`**: die Erlebnis-Startseite mit Scroll- und 3D-Effekten
- **`index.html`**: der Shop mit dem kompletten echten Sortiment (471 Produkte, 64 Marken, 144 Kategorien)

Beide Dateien lassen sich direkt im Browser öffnen, ein Server ist nicht nötig.

## Shop (`index.html`)

Seiten (Hash-Routen): Start `#/` · Kategorie `#/k/<pfad>` · Produkt `#/p/<id>` · Suche `#/suche/<begriff>` · Marken `#/marken` · Marke `#/marke/<name>` · Angebote `#/angebote` · Merkzettel `#/merkzettel` · Coaching `#/coaching` · Laden `#/laden` · Warenkorb `#/warenkorb` · Kasse `#/kasse`

**Was funktioniert:**
- Alle Kategorien mit Unterkategorien, Kategoriebaum, Filtern (Marke, Preis, „sofort versandfertig“, Angebote), Sortierung und „Mehr laden“
- Produktseiten mit Original-Fotos, Varianten (Geschmack, Größe, Farbe …), Pflichtauswahl, Menge, Beschreibung inkl. Nährwerttabellen, Lieferstatus und „Passt dazu“
- Live-Suche im Header über Name, Marke, Kategorie und Varianten
- Merkzettel und Warenkorb, beide im Browser gespeichert. Der Warenkorb zeigt den Fortschritt bis zur „Überraschung ab 100 €“.
- Kasse in 3 Schritten: Lieferung (Versand oder Abholung), Zahlart, Prüfen. Fightwear und Coaching erzwingen automatisch Abholung bzw. Termin.
- Coaching-Leistungen (Ernährungs- und Trainingspläne, Personal Training, Fettmessung, Wettkampf) sind direkt buchbar.

**Bewusst nicht echt:** Die Kasse fragt keine Adress- oder Zahlungsdaten ab und schickt nichts ab. Am Ende verlinkt sie die Artikel im aktuellen Shop.

**Daten:** `catalog.js` (Produktliste) und `details.js` (Beschreibungen, wird nachgeladen) wurden aus der Sitemap und den öffentlichen Seiten von eiweissdealer24.de erzeugt (Stand Nov. 2026). Die Produktbilder werden direkt vom Original-Shop geladen.

## Was sich ändert (Pitch-Argumente)

| Problem heute | Lösung im Prototyp |
|---|---|
| **Veraltetes Design**: Slider, Standard-Theme, uneinheitliche Typo | Kraftvoller Look in Schwarz und Rot. Markenfarben und Rostocker Skyline bleiben, wirken aber moderner. Große, sportliche Typografie. |
| **Unübersichtliches Menü**: 9 Hauptpunkte mit sehr vielen Unterkategorien | 6 Hauptpunkte. Das Mega-Menü sortiert alles in 4 Gruppen. Dazu kommen der Einstieg **„Was ist dein Ziel?“** und eine Live-Suche. |
| **Schlecht auf dem Handy**: Header, Slider und Cookie-Banner füllen den ersten Bildschirm | Mobile first: kompakter Header, Navigation unten (Start, Kategorien, Suche, Merken, Warenkorb), Filter als Schublade, mitlaufende Kaufen-Leiste, kleiner Cookie-Hinweis |
| **Coaching geht unter**: als Menüpunkt versteckt, nur Fließtext | Großer Bereich auf der Startseite, eigene Coaching-Seite, Leistungen mit Preisen direkt buchbar |
| Laden und Team kaum sichtbar | Team, Live-Öffnungsstatus, Route, Treuekarte und „Überraschung ab 100 €“ |

## Erlebnis-Startseite (`landing.html`)

- **Kein Ladebildschirm:** Schriftzug und Hintergrund sind sofort da. 3D-Objekte und Effekte laden im Hintergrund und erscheinen dann.
- **Fließender WebGL-Hintergrund** in den Markenfarben, der beim Scrollen die Farbe wechselt
- **3D-Objekte** (Three.js): Dosen der Eigenmarke, Hantel, Kettlebell, Shaker und Messlöffel
- **Fixierter Produkt-Showcase** mit den echten „Classic“-Produkten der Eigenmarke (Whey → Creatin → EAA → L-Glutamin). Jedes Kapitel verlinkt direkt auf die Produktseite im Shop.
- **Story mit Stempel-Typo**, Objekte schweben in verschiedenen Geschwindigkeiten vorbei
- **Coaching-Panel**, das sich beim Scrollen auf volle Fläche aufzieht
- **Physik-Marken** (Matter.js) zum Werfen
- **Footer** mit Laufschrift, die mit der Scroll-Geschwindigkeit schneller wird

**Performance:**
- **Nicht blockierend:** Die Bibliotheken laden im Hintergrund (CDN, sonst `vendor/`).
- **Leichter Hintergrund:** Der Shader läuft in niedriger Auflösung.
- **Nur Sichtbares zeichnen:** Die 3D-Ebene rendert nur, wenn Objekte im Bild sind.
- **Automatische Qualität:** Kommt ein Gerät nicht hinterher, sinkt die Auflösung stufenweise.
- **Nur GPU-Animationen:** Animiert werden nur `transform` und `opacity`, ohne Layout-Neuberechnung pro Bild. Dazu kommt eine Stempel-Maske statt eines SVG-Filters.

## Hinweise

- Team-Fotos und „Im Laden abholen“ sind Vorschläge bzw. Platzhalter.
- `screenshots/` enthält Vorher-Nachher-Bilder für die Präsentation.

## Auf Netlify veröffentlichen

`python3 build_netlify.py` baut den Ordner `netlify/` und die Datei `../eiweissdealer24-netlify.zip`.
Startseite ist die Erlebnis-Seite (`index.html`), der Shop liegt unter `shop.html`.
Die Seite ist für Suchmaschinen gesperrt (`robots.txt`, `X-Robots-Tag`) und als unverbindliches Konzept gekennzeichnet.

- **Schnell (Drag & Drop):** Bei Netlify einloggen → *Add new site* → *Deploy manually* → die ZIP-Datei (oder den Ordner `netlify/`) hineinziehen.
- **Über GitHub (automatische Updates):** *Add new site* → *Import an existing project* → dieses Repo → Branch wählen → *Base directory* `eiweissdealer24-redesign/netlify`, Build command leer lassen.
