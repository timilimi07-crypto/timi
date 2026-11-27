# Eiweissdealer24 – Shopify-Einbau

Das Redesign als 12 Shopify-Abschnitte (Online Store 2.0) zum Einfügen in ein bestehendes Theme (Dawn, Horizon und andere OS2-Themes), dazu das komplette Sortiment als CSV-Import.

**Schritt-für-Schritt:** `anleitung.html` im Browser öffnen. Sie enthält alle Abschnitte mit Kopieren-Knopf, die Reihenfolge auf der Startseite, Farben, Kollektionen und eine Checkliste.

## Stand in „Mein Shop“ (1m2xbk-0k)

Bereits eingerichtet (Nov. 2026):

- Theme **„Eiweissdealer24 – echte Produkte“** ist veröffentlicht (hinter dem Passwort). Der Vorgänger „Eiweissdealer24 Redesign“ bleibt als Sicherung. Das frühere Theme mit der „ABI Shop 2027“-Seite heißt „Horizon“ und ist unverändert, nur nicht mehr veröffentlicht.
  - 12 ED24-Abschnitte und die Vorlagen `templates/page.shop.json` und `templates/page.hersteller.json`, byte-gleich mit dem Repository (MD5 geprüft)
  - Startseite in der richtigen Reihenfolge; Showcase-Kapitel mit den 4 Eigenmarke-Produkten verknüpft
  - Hero mit 3D-Produkten (Dosen mit Eiweissdealer-Etikett, Hantel, Kettlebell, Shaker, Messlöffel). Die Etiketten der großen Dose kommen aus den Kapiteltiteln.
  - Menü nur mit Text (ohne Kollektionsbilder), mit drei Ebenen wie im Original-Shop: „Shop“ öffnet ein großes Menü mit den Kategorien (fett, roter Strich) und ihren Unterkategorien darunter, in Spalten. Fightwear und Zubehör haben eigene Unterpunkte.
  - Seite „Shop“ (`/pages/shop`, Vorlage `page.shop`): alle Kategorien untereinander mit klebender Kategorie-Leiste, je 8 Produkte und „Alle ansehen“
  - Effekte im ganzen Shop (an der ED24 Topbar abschaltbar): roter Scroll-Fortschritt oben, Produkte blenden beim Scrollen ein, roter Glow und Zoom auf Produktkarten, Glanz auf Buttons, rote Linie unter Menüpunkten
  - Markenschriften im ganzen Shop: Texte in Barlow, Überschriften in Barlow Condensed
  - Ziele-Kacheln mit Kollektionen verknüpft, Coaching-Button auf `/collections/coaching`
  - Topbar und Logo (`eiweissdealer24-logo.png`, liegt unter Inhalte → Dateien), dunkles Farbschema mit Rot
  - Menü „Eiweissdealer24 Hauptmenü“ (`ed24-hauptmenue`); das bestehende Hauptmenü ist unverändert
- 472 Produkte importiert, alle Produktbilder einheitlich auf schwarzem Hintergrund (siehe `bilder/`)
- 15 automatische Kollektionen (siehe Tabelle unten) und 61 Unterkategorien (z. B. Wheyprotein, Booster mit Koffein, Boxhandschuhe), alle im Onlineshop sichtbar
- Alle Kollektionen sortieren die Produkte nach Titel von A bis Z
- Hauptmenü wie im Original: Shop (großes Menü), Fightwear, Zubehör, Hersteller (Top-Marken, weitere Marken, alle A–Z), Coaching, Rezepte, Info-Blog, Über uns (Geschichte, Philosophie, Aktivitäten, Kontakt), Angebote
- Seite „Hersteller“ (`/pages/hersteller`): alle 62 Marken von A bis Z mit Buchstaben-Leiste und Suchfeld, jede Marke führt auf ihre Produkte
- Blogs „Rezepte“ (30 Rezepte) und „Unser Info-Blog“ (9 Artikel, mit Video) aus dem Original-Shop übernommen
- Seite „Über uns“ mit Geschichte, Philosophie und Aktivitäten (Franzis Vize-Weltmeistertitel, MV1-Video); Coaching-Kollektion mit dem Originaltext
- Seiten Impressum, AGB, Widerrufsbelehrung, Versand und Zahlung, Datenschutzerklärung mit den Originaltexten. Die Shopify-Richtlinien selbst lassen sich über die Schnittstelle nicht ändern (fehlende Berechtigung); vor dem Livegang im Admin unter Einstellungen → Richtlinien eintragen und vom Rechtstexte-Anbieter für Shopify aktualisieren lassen (die Datenschutzerklärung nennt noch Dienste des alten Shops).
- Deutscher Footer (ED24 Footer): Laden und Kontakt, drei Linklisten (Menüs `ed24-footer-shop`, `ed24-footer-wissen`, `ed24-footer-service`), Newsletter, Zahlarten, Facebook und Instagram, Trusted Shops. Der englische Standard-Footer ist ausgeblendet.
- Trusted Shops: offizielles Trustbadge mit der ID des Shops (wie im Original) und Link zum Bewertungsprofil
- „Mein Konto“ im Header: neue Shopify-Kundenkonten sind aktiv, Kunden melden sich per E-Mail-Code an und registrieren sich dabei
- Passwortschutz des Shops ist an

Noch offen:

- Fightwear nur zur Abholung: Abholung vor Ort und ein Versandprofil ohne Tarife einrichten.
- Mehr Filter in den Kollektionen: in der kostenlosen Shopify-App „Search & Discovery“ unter Filter (Marke, Produkttyp, Größe, Geschmack). Shopify erlaubt das nur dort, nicht über die Schnittstelle.

## Abschnitte (`sections/`)

| Datei | Name im Theme-Editor | Effekt |
|---|---|---|
| `ed24-topbar.liquid` | ED24 Topbar | Rote Infoleiste (Laden, Überraschung ab 100 €, Beratung). Setzt außerdem die Markenschriften im ganzen Shop (Texte Barlow, Überschriften Barlow Condensed), den Stil des großen Produkt-Menüs und die Effekte im ganzen Shop. Gehört in die Kopfzeile. |
| `ed24-hero.liquid` | ED24 Hero 3D | Riesen-Schriftzug, WebGL-Farbverlauf und schwebende 3D-Produkte (Three.js). Hier sitzt die Effekt-Bühne für Hero, Showcase und Story. |
| `ed24-showcase.liquid` | ED24 Produkt-Showcase | Fixierter Showcase mit bis zu 6 Kapiteln. Die 3D-Dose dreht sich und wechselt das Etikett, der Hintergrund wechselt die Farbe. Pro Kapitel ein Produkt, Preis und Link kommen automatisch. Etikett und Dosenfarbe einstellbar (leer: Kapiteltitel, Farbe abwechselnd). |
| `ed24-story.liquid` | ED24 Story | Stempel-Typo mit vorbeischwebenden Produkten und Fakten. |
| `ed24-coaching.liquid` | ED24 Coaching-Panel | Coaching-Panel, das sich beim Scrollen aufzieht. Hier endet die 3D-Bühne. |
| `ed24-ziele.liquid` | ED24 Ziele | „Was ist dein Ziel?“: Kacheln mit Kollektion und automatischer Produktanzahl. |
| `ed24-marken.liquid` | ED24 Marken (Physik) | Alle Marken des Shops als Physik-Pillen zum Werfen (Matter.js). |
| `ed24-laden.liquid` | ED24 Laden & Team | Team, Live-Öffnungsstatus, Adresse, Route und Vorteile. |
| `ed24-laufschrift.liquid` | ED24 Laufschrift | Laufschrift, die mit der Scroll-Geschwindigkeit schneller wird, dazu Sticker für E-Mail und Telefon. |
| `ed24-hersteller.liquid` | ED24 Hersteller | Alle Marken des Shops von A bis Z: Buchstaben-Leiste, Suchfeld, Kacheln mit Link auf die Marken-Seite. Gehört in die Vorlage `templates/page.hersteller.json`. |
| `ed24-footer.liquid` | ED24 Footer | Deutscher Footer mit Kontakt, drei Linklisten, Newsletter, Zahlarten, Social Media und Trusted-Shops-Trustbadge. Gehört in den Footer-Bereich, blendet den Standard-Footer aus. |
| `ed24-shop.liquid` | ED24 Shop-Übersicht | Shop-Seite: alle gewählten Kategorien untereinander, klebende Kategorie-Leiste, die beim Scrollen mitläuft, Produktkarten mit 3D-Kippen und Einblenden. Gehört in die Vorlage `templates/page.shop.json`. |

Reihenfolge auf der Startseite: Hero → Showcase → Story → Coaching-Panel lückenlos hintereinander, danach beliebige Theme-Abschnitte, Ziele, Marken, Laden & Team, Laufschrift.

Technik:
- Der Farbverlauf ist ein eigener kleiner WebGL-Shader. Die 3D-Produkte zeichnet Three.js in einer einzigen Leinwand, deshalb bleibt es auch mit vielen Objekten flüssig.
- Bibliotheken vom CDN: Three.js 0.149 (jsDelivr) für die 3D-Produkte, Matter.js 0.19 (cdnjs) für die Marken-Box. Schriften Barlow und Barlow Condensed (Google Fonts).
- Die 3D-Bühne liegt in einem Rahmen von der Hero-Oberkante bis zum Coaching-Panel und klebt darin oben am Bildschirm (`overflow: clip` + `position: sticky`). Ränder und Kleben erledigt der Browser selbst, deshalb laufen sie auch auf iPad und iPhone ohne Ruckeln mit der Seite mit und überdecken nie Header oder andere Abschnitte.
- Alle Abschnitte rechnen mit derselben festen Bildschirmhöhe (`100svh`). Wenn Safari beim Scrollen die Adressleiste ein- oder ausblendet, wird nichts neu berechnet, Produkte und Kapitel bleiben ruhig.
- Ohne WebGL kommt der Farbverlauf aus CSS. Bei „Bewegung reduzieren“ stehen die Produkte still. Inhalte und Buttons funktionieren immer.

## Produktbilder (`produktbilder/`)

Echte Produktfotos aus dem Shop, mit einem KI-Hintergrund-Entferner (rembg, ISNet) freigestellt und als PNG ohne Hintergrund gespeichert. In „Mein Shop“ liegen sie unter Inhalte → Dateien mit demselben Namen.

Derzeit nicht auf der Startseite im Einsatz (dort laufen die 3D-Produkte), sie bleiben als Reserve.

| Datei | Verwendung | Produkt |
|---|---|---|
| `ed24-classic-whey.png` | Showcase Kapitel 1 und Hero | Eiweissdealer 24 Classic Whey Protein |
| `ed24-classic-creatin.png` | Showcase Kapitel 2 | Classic Creatin Monohydrat Pulver |
| `ed24-classic-eaa.png` | Showcase Kapitel 3 | Classic EAA Pulver |
| `ed24-classic-glutamin.png` | Showcase Kapitel 4 | Classic L-Glutamin Pulver |
| `ed24-float-*.png` (10 Stück) | Hero, Showcase-Begleiter, Story | Iso Whey Zero, Valhalla, Blender Bottle, Phantom Boxhandschuhe, BCAA Xplode, Hype Pump, V8, Scitec Whey, Yippie Bar, Bloodstorm |

Weitere Produkte: Foto freistellen, als PNG unter Inhalte → Dateien hochladen und im Hero einen Block „Schwebendes Produkt“ hinzufügen (Bild + Produkt).
- Im Theme-Editor werden die Abschnitte beim Bearbeiten, Verschieben und Löschen neu aufgebaut.

## Einheitliche Produktbilder (`bilder/`)

Alle 669 Produktbilder in einem Format, damit Kollektionen, Suche und Produktseiten ruhig aussehen (Vorschau: `vorschau-produktbilder.jpg`):

- 1200 × 1200 Pixel, JPG
- Hintergrund überall schwarz wie der Shop (`#0B0B0C` am Rand, in der Mitte ein leichter Spot), Produkt mittig, füllt 80 % der Fläche, mit weichem Lichtsaum und Bodenschatten, damit auch schwarze Dosen sich abheben
- Produktfotos sind freigestellt (BiRefNet mit Randfarben-Korrektur, vorher ISNet; Problemfälle wie weiße Dosen auf Weiß zeilenweise gefüllt oder per Farbschlüssel; Fotos auf weißem Grund, bei denen das Freistellen Teile zerstört hätte, per Farbschlüssel). Nährwerttabellen und Grafiken liegen als Karte mit abgerundeten Ecken auf dem Schwarz (84 %). Jedes Bild wurde auf Übersichtsblättern geprüft.
- Dateiname `<handle>__<position>.jpg`, passend zur CSV
- 11 falsche Bilder aus dem Original-Shop (Vorschaubilder anderer Produkte) sind entfernt. `posingslip`, `handtuch` und `body-attack-iso-whey-drink` haben im Original kein Bild und bekommen einen neutralen Platzhalter.

In „Mein Shop“ sind die Bilder schon ersetzt (gleiche Reihenfolge, gleiche Verknüpfung mit den Varianten).

## Produkte (`produkte-import.csv`)

472 Produkte mit 1.249 Varianten, Bildern, Beschreibungen, Tags und Typ, erzeugt aus dem Sortiment von eiweissdealer24.de (Stand Nov. 2026).

Import: Shopify-Admin → **Produkte** → **Importieren** → Datei wählen → **Produkte importieren**.

Hinweise:
- Alle Varianten haben den „ab“-Preis des Originals, die Preise einzelner Größen sind dort nicht angegeben. Vor echten Bestellungen nachtragen.
- Der Bestand wird nicht verfolgt, alles ist bestellbar. Coaching-Leistungen sind ohne Versand angelegt.
- Pro Produkt sind bis zu 3 Bilder hinterlegt, alle aus `bilder/` (einheitlich, siehe oben). Shopify lädt sie beim Import aus diesem Repository (fester Commit, damit sich die Links nie ändern).
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

Unterkategorien als automatisierte Kollektionen mit „alle Bedingungen“: Tag der Hauptkategorie **und** Tag der Unterkategorie (Beispiel Wheyprotein: `Eiweiß/ Protein` + `Wheyprotein`). Ausnahmen: Ashwagandha (Titel enthält „Ashwagandha“), CLA / MCT-Öl (nur Tag `CLA / MCT Öl`). Casein gibt es im Sortiment derzeit nicht, deshalb fehlt es im Menü.

## Gesprächsleitfaden (`gespraech/`)

`Eiweissdealer24-Gespraechsleitfaden.pdf` (8 Seiten): Ablauf des Termins, Demo in 10 Schritten, Vorteile gegenüber dem alten Shopware-Shop, Argumente für Shopify, Einwände und Antworten, preisliche Einordnung mit drei Paketen, nächste Schritte. Quelle: `gespraechsleitfaden.html` (mit Chromium als PDF gedruckt).
