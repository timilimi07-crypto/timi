# Eiweissdealer24 – Redesign-Prototyp (Pitch)

Klickbarer Prototyp für ein Redesign von eiweissdealer24.de.
Einfach `index.html` im Browser öffnen, es wird kein Server gebraucht.

Seiten: **Start** · **Kategorie Wheyprotein** (`#/shop`) · **Produkt** (`#/produkt/srs`) · **Coaching** (`#/coaching`) · **Laden & Team** (`#/laden`)

## Was sich ändert (Pitch-Argumente)

| Problem heute | Lösung im Prototyp |
|---|---|
| **Veraltetes Design**: Slider, Standard-Theme, uneinheitliche Typo | Kraftvoller Look in Schwarz und Rot. Die Markenfarben und die Rostocker Skyline bleiben, wirken aber moderner. Große, sportliche Typografie. |
| **Unübersichtliches Menü**: 9 Hauptpunkte mit sehr vielen Unterkategorien | 6 Hauptpunkte. Der Shop ist im Mega-Menü in 4 Gruppen sortiert. Neuer Einstieg **„Was ist dein Ziel?“** (Muskelaufbau, Definition, Pump, Gesundheit, Kampfsport). |
| **Schlecht auf dem Handy**: Header, Slider und Cookie-Banner füllen den ersten Bildschirm | Mobile first: kompakter Header, Navigation unten (Start, Shop, Coaching, Warenkorb), Filter als Schublade, Kaufen-Leiste auf der Produktseite immer sichtbar, kleiner Cookie-Hinweis |
| **Coaching geht unter**: als Menüpunkt versteckt, nur Fließtext | Eigener großer Bereich auf der Startseite, eigene Landingpage mit Leistungen, Ablauf in 3 Schritten, Wettkampf-Erfahrung und Anfrageformular. Beratung wird auch in Kategorie und Produktseite angeboten. |
| Laden und Team kaum sichtbar | Team (Manu, Franzi, Mario), Live-Anzeige der Öffnungszeiten, Route, Treuekarte und „Überraschung ab 100 €“ als Fortschrittsbalken im Warenkorb |

## Erlebnis-Startseite (`landing.html`)

Eine immersive Startseite mit Effekten im Stil moderner Marken-Websites:

- **Ladeanimation**: drehende „24/2007“-Münze und Prozentzähler, danach wischt der Vorhang nach oben weg
- **Fließender WebGL-Hintergrund** in den Markenfarben, der beim Scrollen die Farbe wechselt
- **3D-Objekte** (Three.js): Dosen der Eigenmarke mit echten Etiketten, Hantel, Kettlebell, Shaker und Messlöffel
- **Fixierter Produkt-Showcase**: Eine Dose bleibt stehen, dreht sich pro Kapitel einmal und wechselt dabei das Etikett. Dazu wischt die Hintergrundfarbe, und ein passendes Objekt fliegt herein (Whey → Kreatin → EAA → Glutamin).
- **Story mit Stempel-Typo** (SVG-Filter) und Objekten, die mit unterschiedlicher Geschwindigkeit vorbeischweben
- **Coaching-Panel**, das sich beim Scrollen von einer Karte zur vollen Fläche aufzieht
- **Physik-Marken** (Matter.js): Die Marken fallen in eine Box und lassen sich mit der Maus werfen.
- **Footer** mit riesiger Laufschrift, die mit der Scroll-Geschwindigkeit schneller wird, und schrägen Stickern
- Weiches Scrollen (Lenis). Die Seite funktioniert auch auf dem Handy und berücksichtigt „Bewegung reduzieren“.

Die Bibliotheken werden vom CDN geladen. Ist das nicht erreichbar (z. B. offline beim Pitch), springt die lokale Kopie in `vendor/` ein.
Hinweis: Produktnamen der Eigenmarke stammen vom Shop-Banner. Beschreibungen sind Entwürfe, die das Team prüfen sollte.

## Was funktioniert
- Warenkorb mit Mengen und Fortschritt bis zur „Überraschung ab 100 €“
- Filter (Marke, Angebote, Preis) und Sortierung (auch nach Preis pro kg)
- Geschmack und Größe auf der Produktseite, Mega-Menü, mobiles Menü

## Hinweise
- Produkte, Preise, Texte und Kontaktdaten stammen aus dem aktuellen Shop (Stand Nov. 2026).
- Die Produktbilder sind gezeichnete Platzhalter. Im echten Shop kommen die Original-Produktfotos hinein.
- Team-Fotos, Blogthemen und „Im Laden abholen“ sind Vorschläge bzw. Platzhalter.
- Suche, Konto, Checkout und Formulare sind nur angedeutet.
- `screenshots/` enthält Vorher-Nachher-Bilder für die Präsentation.

## Auf Netlify veröffentlichen

`python3 build_netlify.py` baut den Ordner `netlify/` und die Datei `../eiweissdealer24-netlify.zip`.
Startseite ist die Erlebnis-Seite (`index.html`), der Shop-Prototyp liegt unter `shop.html`.
Die Seite ist für Suchmaschinen gesperrt (`robots.txt`, `X-Robots-Tag`) und als unverbindliches Konzept gekennzeichnet.

- **Schnell (Drag & Drop):** Bei Netlify einloggen → *Add new site* → *Deploy manually* → die ZIP-Datei (oder den Ordner `netlify/`) hineinziehen.
- **Über GitHub (automatische Updates):** *Add new site* → *Import an existing project* → dieses Repo → Branch wählen → *Base directory* `eiweissdealer24-redesign/netlify`, Build command leer lassen.
