# Eiweissdealer24 – Shopify-Einbau

Das Redesign als 9 Shopify-Abschnitte (Online Store 2.0) zum Einfügen in ein bestehendes Theme (Dawn, Horizon und andere OS2-Themes), dazu das komplette Sortiment als CSV-Import.

**Schritt-für-Schritt:** `anleitung.html` im Browser öffnen. Sie enthält alle Abschnitte mit Kopieren-Knopf, die Reihenfolge auf der Startseite, Farben, Kollektionen und eine Checkliste.

## Stand in „Mein Shop“ (1m2xbk-0k)

Bereits eingerichtet (Nov. 2026):

- Theme **„Eiweissdealer24 Redesign“** (Kopie von Horizon). Das frühere Theme mit der „ABI Shop 2027“-Seite heißt „Horizon“ und ist unverändert, nur nicht mehr veröffentlicht.
  - 9 ED24-Abschnitte, byte-gleich mit `sections/` (MD5 geprüft)
  - Startseite in der richtigen Reihenfolge; Showcase-Kapitel mit den 4 Eigenmarke-Produkten und ihren freigestellten Fotos verknüpft
  - Hero mit 10 schwebenden echten Produkten (Blöcke mit Bild und Produkt), Bilder unter Inhalte → Dateien (`ed24-…png`)
  - Ziele-Kacheln mit Kollektionen verknüpft, Coaching-Button auf `/collections/coaching`
  - Topbar und Logo (`eiweissdealer24-logo.png`, liegt unter Inhalte → Dateien), dunkles Farbschema mit Rot
  - Menü „Eiweissdealer24 Hauptmenü“ (`ed24-hauptmenue`); das bestehende Hauptmenü ist unverändert
- 472 Produkte importiert
- 15 automatische Kollektionen (siehe Tabelle unten), im Onlineshop sichtbar
- Passwortschutz des Shops ist an

Noch offen:

- Fightwear nur zur Abholung: Abholung vor Ort und ein Versandprofil ohne Tarife einrichten.
- Das Theme „Eiweissdealer24 Redesign“ ist seit dem 25.11. veröffentlicht (hinter dem Passwort). Die Version mit den echten Produkten ist gespeichert und wird mit dem nächsten Veröffentlichen sichtbar.

## Abschnitte (`sections/`)

| Datei | Name im Theme-Editor | Effekt |
|---|---|---|
| `ed24-topbar.liquid` | ED24 Topbar | Rote Infoleiste (Laden, Überraschung ab 100 €, Beratung). Setzt außerdem die Überschriften im ganzen Shop in die Markenschrift. Gehört in die Kopfzeile. |
| `ed24-hero.liquid` | ED24 Hero 3D | Riesen-Schriftzug, WebGL-Farbverlauf und echte, freigestellte Produktfotos, die schweben (Blöcke „Schwebendes Produkt“). Hier sitzt die Effekt-Bühne für Hero, Showcase und Story. |
| `ed24-showcase.liquid` | ED24 Produkt-Showcase | Fixierter Showcase mit bis zu 6 Kapiteln. Das Produkt dreht sich um und zeigt das nächste, der Hintergrund wechselt die Farbe. Pro Kapitel Produkt und freigestelltes Bild, Preis und Link kommen automatisch. |
| `ed24-story.liquid` | ED24 Story | Stempel-Typo mit vorbeischwebenden Produkten und Fakten. |
| `ed24-coaching.liquid` | ED24 Coaching-Panel | Coaching-Panel, das sich beim Scrollen aufzieht. Hier endet die 3D-Bühne. |
| `ed24-ziele.liquid` | ED24 Ziele | „Was ist dein Ziel?“: Kacheln mit Kollektion und automatischer Produktanzahl. |
| `ed24-marken.liquid` | ED24 Marken (Physik) | Alle Marken des Shops als Physik-Pillen zum Werfen (Matter.js). |
| `ed24-laden.liquid` | ED24 Laden & Team | Team, Live-Öffnungsstatus, Adresse, Route und Vorteile. |
| `ed24-laufschrift.liquid` | ED24 Laufschrift | Laufschrift, die mit der Scroll-Geschwindigkeit schneller wird, dazu Sticker für E-Mail und Telefon. |

Reihenfolge auf der Startseite: Hero → Showcase → Story → Coaching-Panel lückenlos hintereinander, danach beliebige Theme-Abschnitte, Ziele, Marken, Laden & Team, Laufschrift.

Technik:
- Der Farbverlauf ist ein eigener kleiner WebGL-Shader (ohne Three.js). Die schwebenden Produkte sind normale Bilder, die per CSS-Transform bewegt werden, deshalb flüssig auch auf iPad und Handy.
- Bibliothek vom CDN: Matter.js 0.19 (cdnjs) für die Marken-Box. Schriften Barlow und Barlow Condensed (Google Fonts).
- Die 3D-Bühne schneidet sich pro Frame auf den Bereich zwischen Kopfzeile und Coaching-Panel zu und überdeckt so nie Header oder andere Abschnitte.
- Ohne WebGL kommt der Farbverlauf aus CSS, die Produkte schweben trotzdem. Bei „Bewegung reduzieren“ stehen sie still. Inhalte und Buttons funktionieren immer.

## Produktbilder (`produktbilder/`)

Echte Produktfotos aus dem Shop, mit einem KI-Hintergrund-Entferner (rembg, ISNet) freigestellt und als PNG ohne Hintergrund gespeichert. In „Mein Shop“ liegen sie unter Inhalte → Dateien mit demselben Namen.

| Datei | Verwendung | Produkt |
|---|---|---|
| `ed24-classic-whey.png` | Showcase Kapitel 1 und Hero | Eiweissdealer 24 Classic Whey Protein |
| `ed24-classic-creatin.png` | Showcase Kapitel 2 | Classic Creatin Monohydrat Pulver |
| `ed24-classic-eaa.png` | Showcase Kapitel 3 | Classic EAA Pulver |
| `ed24-classic-glutamin.png` | Showcase Kapitel 4 | Classic L-Glutamin Pulver |
| `ed24-float-*.png` (10 Stück) | Hero, Showcase-Begleiter, Story | Iso Whey Zero, Valhalla, Blender Bottle, Phantom Boxhandschuhe, BCAA Xplode, Hype Pump, V8, Scitec Whey, Yippie Bar, Bloodstorm |

Weitere Produkte: Foto freistellen, als PNG unter Inhalte → Dateien hochladen und im Hero einen Block „Schwebendes Produkt“ hinzufügen (Bild + Produkt).
- Im Theme-Editor werden die Abschnitte beim Bearbeiten, Verschieben und Löschen neu aufgebaut.

## Produkte (`produkte-import.csv`)

472 Produkte mit 1.249 Varianten, Bildern, Beschreibungen, Tags und Typ, erzeugt aus dem Sortiment von eiweissdealer24.de (Stand Nov. 2026).

Import: Shopify-Admin → **Produkte** → **Importieren** → Datei wählen → **Produkte importieren**.

Hinweise:
- Alle Varianten haben den „ab“-Preis des Originals, die Preise einzelner Größen sind dort nicht angegeben. Vor echten Bestellungen nachtragen.
- Der Bestand wird nicht verfolgt, alles ist bestellbar. Coaching-Leistungen sind ohne Versand angelegt.
- Pro Produkt sind bis zu 3 Bilder hinterlegt, Shopify lädt sie beim Import von eiweissdealer24.de.
- Bei Produkten mit mehr als 3 Optionsgruppen werden nur die ersten 3 übernommen (Shopify-Limit).
- Fightwear gibt es nur im Laden: Abholung vor Ort aktivieren und für Fightwear ein Versandprofil ohne Versandtarife anlegen.

Kollektionen als automatisierte Kollektionen mit der Bedingung „Produkt-Tag ist gleich“:

| Tag | Produkte |
|---|---:|
| Eiweiß/ Protein | 49 |
| Kreatin | 26 |
| Aminosäuren | 64 |
| Trainings- und NO-Booster | 32 |
| Weight Gainer/ Kohlenhydrate | 27 |
| Testo Booster | 11 |
| Vital fit und gesund | 151 |
| Low Carb-Ecke | 31 |
| Nasch-Ecke | 31 |
| Burner | 5 |
| Fightwear | 28 |
| Zubehör | 42 |
| Coaching | 15 |
| Eigenmarke | 27 |
| Angebot | 16 |
