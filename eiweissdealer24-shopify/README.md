# Eiweissdealer24 – Shopify-Einbau

Das Redesign als 9 Shopify-Abschnitte (Online Store 2.0) zum Einfügen in ein bestehendes Theme (Dawn, Horizon und andere OS2-Themes), dazu das komplette Sortiment als CSV-Import.

**Schritt-für-Schritt:** `anleitung.html` im Browser öffnen. Sie enthält alle Abschnitte mit Kopieren-Knopf, die Reihenfolge auf der Startseite, Farben, Kollektionen und eine Checkliste.

## Stand in „Mein Shop“ (1m2xbk-0k)

Bereits eingerichtet (Nov. 2026):

- Theme **„Eiweissdealer24 Redesign“** (unveröffentlichte Kopie von Horizon). Das live geschaltete Theme mit der „ABI Shop 2027“-Seite ist unverändert.
  - 9 ED24-Abschnitte, byte-gleich mit `sections/` (MD5 geprüft)
  - Startseite in der richtigen Reihenfolge; Showcase-Kapitel mit den 4 Eigenmarke-Produkten verknüpft
  - Ziele-Kacheln mit Kollektionen verknüpft, Coaching-Button auf `/collections/coaching`
  - Topbar und Logo (`eiweissdealer24-logo.png`, liegt unter Inhalte → Dateien), dunkles Farbschema mit Rot
  - Menü „Eiweissdealer24 Hauptmenü“ (`ed24-hauptmenue`); das bestehende Hauptmenü ist unverändert
- 15 automatische Kollektionen (siehe Tabelle unten), im Onlineshop sichtbar
- Passwortschutz des Shops ist an

Noch offen:

- `produkte-import.csv` über Produkte → Importieren hochladen. Die Schnittstelle erlaubt keinen Sammel-Import.
- Fightwear nur zur Abholung: Abholung vor Ort und ein Versandprofil ohne Tarife einrichten.
- Theme veröffentlichen erst nach Absprache. Bis dahin über Onlineshop → Themes → Vorschau zeigen.

## Abschnitte (`sections/`)

| Datei | Name im Theme-Editor | Effekt |
|---|---|---|
| `ed24-topbar.liquid` | ED24 Topbar | Rote Infoleiste (Laden, Überraschung ab 100 €, Beratung). Setzt außerdem die Überschriften im ganzen Shop in die Markenschrift. Gehört in die Kopfzeile. |
| `ed24-hero.liquid` | ED24 Hero 3D | Riesen-Schriftzug, WebGL-Farbverlauf, schwebende 3D-Dosen, Hantel und Messlöffel. Hier sitzt die 3D-Bühne für Hero, Showcase und Story. |
| `ed24-showcase.liquid` | ED24 Produkt-Showcase | Fixierter Showcase mit bis zu 6 Kapiteln. Die Dose dreht sich, Etikett und Hintergrund wechseln. Pro Kapitel ein Produkt-Picker, Preis und Link kommen automatisch. |
| `ed24-story.liquid` | ED24 Story | Stempel-Typo mit vorbeischwebenden 3D-Objekten und Fakten. |
| `ed24-coaching.liquid` | ED24 Coaching-Panel | Coaching-Panel, das sich beim Scrollen aufzieht. Hier endet die 3D-Bühne. |
| `ed24-ziele.liquid` | ED24 Ziele | „Was ist dein Ziel?“: Kacheln mit Kollektion und automatischer Produktanzahl. |
| `ed24-marken.liquid` | ED24 Marken (Physik) | Alle Marken des Shops als Physik-Pillen zum Werfen (Matter.js). |
| `ed24-laden.liquid` | ED24 Laden & Team | Team, Live-Öffnungsstatus, Adresse, Route und Vorteile. |
| `ed24-laufschrift.liquid` | ED24 Laufschrift | Laufschrift, die mit der Scroll-Geschwindigkeit schneller wird, dazu Sticker für E-Mail und Telefon. |

Reihenfolge auf der Startseite: Hero → Showcase → Story → Coaching-Panel lückenlos hintereinander, danach beliebige Theme-Abschnitte, Ziele, Marken, Laden & Team, Laufschrift.

Technik:
- Bibliotheken vom CDN: Three.js r149 (jsDelivr), Matter.js 0.19 (cdnjs), Schriften Barlow und Barlow Condensed (Google Fonts).
- Die 3D-Bühne schneidet sich pro Frame auf den Bereich zwischen Kopfzeile und Coaching-Panel zu und überdeckt so nie Header oder andere Abschnitte.
- Ohne WebGL oder bei „Bewegung reduzieren“ erscheint ein ruhiger Farbverlauf. Inhalte und Buttons funktionieren immer.
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
