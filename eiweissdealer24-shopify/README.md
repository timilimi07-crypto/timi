# Eiweissdealer24 – Shopify-Test-Store

Für das Redesign gibt es einen eigenen, passwortgeschützten Shopify-Test-Store („Eiweissdealer24 Konzept“), getrennt von WEAX.

## Was im Theme steckt

Auf Basis von Shopifys „Base Theme“ (Blocks + Liquid-Templates):

| Block | Effekt |
|---|---|
| `ed24-hero` | Riesen-Schriftzug, WebGL-Farbverlauf und schwebende 3D-Dosen, Hantel und Messlöffel. Hier sitzt die 3D-Bühne für die ganze Seite. |
| `ed24-showcase` + `ed24-chapter` | Fixierter Produkt-Showcase: Die 3D-Dose dreht sich pro Kapitel und wechselt Etikett und Hintergrundfarbe. Jedes Kapitel hat einen Produkt-Picker (Preis und Link kommen automatisch). |
| `ed24-story` | Stempel-Typo mit vorbeischwebenden 3D-Objekten |
| `ed24-coach` | Coaching-Panel, das sich beim Scrollen auf volle Fläche aufzieht |
| `ed24-brands` | Alle Marken des Shops als Physik-Pillen zum Werfen (Matter.js) |
| `ed24-marquee` | Laufschrift, die mit der Scroll-Geschwindigkeit schneller wird, dazu Sticker |

Texte stehen in `locales/de.json` (Schlüssel `ed24.*`). Farben, Produkte und Etiketten sind im Theme-Editor einstellbar. Das Farbschema des Shops ist Schwarz und Rot.

Die Bibliotheken kommen vom CDN: Three.js r149 (jsDelivr) und Matter.js 0.19 (cdnjs).

## Produkte importieren

`produkte-import.csv`: 471 Produkte, 1239 Varianten, mit Bildern, Beschreibungen, Tags und Typ, erzeugt aus dem Sortiment von eiweissdealer24.de (Stand Nov. 2026).

1. Test-Store in dein Shopify-Konto übernehmen (Link „speichern“ aus dem Chat)
2. Shopify-Admin → **Produkte** → **Importieren** → `produkte-import.csv` wählen → **Importieren**
3. Danach Bescheid geben. Dann lege ich die Kollektionen an und verknüpfe die Showcase-Kapitel mit den Eigenmarke-Produkten.

**Hinweise:**
- Alle Varianten haben den „ab“-Preis des Originals. Preise einzelner Größen sind nicht bekannt.
- Bestand wird nicht verfolgt, alles ist bestellbar. Coaching-Leistungen sind ohne Versand angelegt.
- Pro Produkt sind bis zu 3 Bilder hinterlegt, Shopify lädt sie beim Import von eiweissdealer24.de.
- Bei Produkten mit mehr als 3 Optionsgruppen werden nur die ersten 3 übernommen (Shopify-Limit).
