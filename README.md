# WEAX Night – Shopify Theme

Das Theme für **wearweax.com**: Sternschnuppen-Look, Chrom-Akzente, große Typo. Alles lässt sich **ohne Code im Theme-Editor** bearbeiten.

---

## ✅ Checkliste „Vor dem Livegang“

Einfach von oben nach unten abhaken. Die Details zu jedem Punkt stehen weiter unten.

**Theme & Design**
- [ ] Theme mit Shopify verbunden und als **unveröffentlichtes** Theme in der Vorschau geöffnet → [Abschnitt 1](#1-theme-in-shopify-installieren)
- [ ] Schriften **Clash Display** und **Satoshi** hochgeladen → [Abschnitt 7](#7-schriften-hochladen-einmalig)
- [ ] **Logo** hochgeladen (Theme-Einstellungen → Logo & Favicon) und **Favicon** gesetzt. *Die Logo-SVG kommt noch, bis dahin zeigt das Theme das Platzhalter-W mit Stern.*
- [ ] **Social-Links** für Instagram und TikTok eingetragen (Theme-Einstellungen → Social Media)
- [ ] **Menüs** angelegt: `main-menu` (Hauptmenü) und `footer` (Hilfe-Menü) unter Onlineshop → Navigation

**Rechtliches**
- [ ] **Alle Platzhalter** ausgefüllt: Theme-Einstellungen → **Rechtliches & Stammdaten** (Straße, PLZ/Ort, Telefon, USt-IdNr. oder „keine“, Versandkosten, Lieferzeit, Versanddienstleister, Aufsichtsbehörde) → [RECHTSTEXTE.md](RECHTSTEXTE.md)
- [ ] **Seiten angelegt** mit den richtigen Handles und Vorlagen: `impressum`, `agb`, `widerrufsbelehrung`, `datenschutz`, `versand-und-zahlung`, `rueckgabe` (Vorlage **legal**), `vertrag-widerrufen` (Vorlage **widerruf**), dazu „Über uns“ (Vorlage **about**) und „Kontakt“ (Vorlage **contact**)
- [ ] **Shopify-Richtlinien** (Einstellungen → Richtlinien) mit denselben Texten gefüllt, Platzhalter ersetzt → Ordner `rechtstexte/`
- [ ] **Bestellbestätigung** um Widerrufsbelehrung, Muster-Formular und AGB ergänzt
- [ ] **Cookie-Banner** aktiv, **Double-Opt-in** für Newsletter aktiv, **Steuern** so eingestellt, dass keine USt berechnet wird
- [ ] Rechtstexte von einem Rechtstexte-Service **prüfen lassen**

**Produkte**
- [ ] **Metafelder** angelegt (Größentabelle, Material, Pflege, Versand, Drop-Datum, Complete the Look) → [METAFIELDS.md](METAFIELDS.md)
- [ ] **Varianten-Namen** stimmen: Option **„Größe“** (XS–XL) und **„Farbe“** (Schwarz, Weiß), damit Buttons und Farbkreise erscheinen
- [ ] In jedem Produkt **Material in %**, Pflege und Herstellerangaben (GPSR) eingetragen
- [ ] App **Search & Discovery** installiert und **Filter** eingerichtet (Größe, Farbe, Preis, Verfügbarkeit) → [Abschnitt 4](#4-filter-search--discovery)
- [ ] **Größentabelle** als Seite angelegt und verknüpft

**Startseite & Drop**
- [ ] Startseite im Editor durchgegangen: Hero-Bild/Video, Featured Collection, Featured Product und Lookbook ausgewählt, Instagram-Bilder hochgeladen
- [ ] **Drop-Datum** im Countdown gesetzt (oder Section ausgeblendet)
- [ ] Section „Kundenstimmen“ bleibt **aus**, solange du keine echten Bewertungen hast
- [ ] **Gratis-Versand-Schwelle** im Theme (Theme-Einstellungen → Warenkorb) = Versandregel in Einstellungen → Versand

**Letzter Test**
- [ ] **Testbestellung** gemacht (z. B. mit dem Shopify Bogus Gateway oder einem 100-%-Rabattcode), Mails geprüft
- [ ] Shop auf dem **Handy** durchgeklickt
- [ ] Theme **veröffentlicht** (erst wenn alles oben abgehakt ist)

---

## Inhalt

1. [Theme in Shopify installieren](#1-theme-in-shopify-installieren)
2. [Produkte anlegen](#2-produkte-anlegen)
3. [Kollektionen](#3-kollektionen)
4. [Filter (Search & Discovery)](#4-filter-search--discovery)
5. [Sections im Editor hinzufügen & bearbeiten](#5-sections-im-editor-hinzufügen--bearbeiten)
6. [Effekte an- und ausschalten](#6-effekte-an--und-ausschalten)
7. [Schriften hochladen](#7-schriften-hochladen-einmalig)
8. [Metafelder](#8-metafelder)
9. [Rechtstexte](#9-rechtstexte)
10. [Einen Drop vorbereiten](#10-einen-drop-vorbereiten)
11. [Englisch & Übersetzungen](#11-englisch--übersetzungen)
12. [Häufige Fragen](#12-häufige-fragen)
13. [Für Entwickler](#13-für-entwickler)

---

## 1. Theme in Shopify installieren

**Weg A – über GitHub (empfohlen, bleibt automatisch aktuell)**
1. Shopify-Admin → **Onlineshop → Themes**
2. Im Bereich „Theme-Bibliothek“ auf **Theme hinzufügen → Von GitHub verbinden**
3. Konto bzw. Organisation, Repository `timi` und Branch **`claude/weax-shopify-theme-42hvsf`** wählen
4. Das Theme erscheint als **unveröffentlichtes** Theme. Über **… → Vorschau** schaust du es dir an, über **Anpassen** bearbeitest du es.

> Gut zu wissen: Änderungen, die du im Editor machst, speichert Shopify automatisch auch auf GitHub. Die anderen Ordner im Repository (z. B. `shopify/`, `tradingview/`) ignoriert Shopify.

**Weg B – als ZIP (Backup)**
Onlineshop → Themes → **Theme hinzufügen → ZIP-Datei hochladen** → `weax-night-theme.zip` wählen.

**Wichtig:** Veröffentliche das Theme erst, wenn die Checkliste oben erledigt ist. Dein aktuelles Live-Theme bleibt bis dahin unverändert.

---

## 2. Produkte anlegen

Alle Produkte kommen automatisch aus dem Shopify-Admin. Im Code ist nichts fest eingetragen.

1. **Produkte → Produkt hinzufügen**
2. **Titel**, z. B. „Essential Hoodie“
3. **Beschreibung**, z. B. Fit und Story. Material, Pflege und Größentabelle kommen besser in die Metafelder (siehe [8](#8-metafelder)).
4. **Medien:** mindestens 2 Bilder hochladen, Hochformat 4:5, z. B. 1600 × 2000 px.
   - Bild 1 = Hauptbild auf der Produktkarte
   - Bild 2 = erscheint beim **Hovern** über die Karte
5. **Preis**
6. **Varianten:** Option **„Größe“** mit XS, S, M, L, XL und Option **„Farbe“** mit Schwarz, Weiß
   - Jeder Farbvariante das passende Bild zuweisen, dann wechselt das Bild bei der Farbauswahl.
7. **Inventar:** „Menge erfassen“ aktivieren. Dann zeigt das Theme automatisch **„Low Stock“** (ab 5 Stück, einstellbar) und **„Sold Out“**.
8. **Kollektionen** zuweisen, **Status: Aktiv**, Vertriebskanal **Onlineshop** aktiv
9. **Speichern.** Fertig, das Produkt erscheint automatisch im Shop.

**Badges:**
| Badge | Wann erscheint es? |
|---|---|
| **New Drop** | Produkt-Tag `new` **oder** Drop-Datum/Veröffentlichung jünger als 21 Tage (einstellbar) |
| **Low Stock** | Bestand ≤ 5 (einstellbar unter Theme-Einstellungen → Produktkarten & Badges) |
| **Sold Out** | alle Varianten ausverkauft |
| **Sale** | „Vergleichspreis“ höher als Preis |

---

## 3. Kollektionen

**Produkte → Kollektionen → Kollektion erstellen**, z. B. „Hoodies“, „Pants“, „Tracksuits“, „Season 01“.
- **Automatisch:** Bedingung z. B. „Produkttyp ist Hoodie“
- **Manuell:** Produkte selbst auswählen
- Ein **Kollektionsbild** erscheint als Hintergrund oben auf der Kollektionsseite.

Auf der Startseite wählst du in der Section **Featured Collection** aus, welche Kollektion gezeigt wird und wie viele Produkte.

---

## 4. Filter (Search & Discovery)

1. Im Shopify App Store die kostenlose App **„Search & Discovery“** von Shopify installieren
2. **Filter → Filter hinzufügen:** Verfügbarkeit, Preis, **Größe** (Variantenoption), **Farbe** (Variantenoption)
3. Bei Farbe als Darstellung **„Farbmuster“** wählen, dann erscheinen Farbkreise
4. Unter **Produktempfehlungen** kannst du „ergänzende Produkte“ festlegen. Die erscheinen unter „Complete the Look“ (alternativ das Metafeld nutzen).

Die Filter erscheinen dann automatisch auf Kollektions- und Suchseiten (Button „Filter“).

---

## 5. Sections im Editor hinzufügen & bearbeiten

**Onlineshop → Themes → Anpassen**

- **Seite wechseln:** oben in der Mitte (Startseite, Produkte, Kollektionen, Seiten …)
- **Section bearbeiten:** links anklicken, rechts erscheinen Texte, Bilder, Links, Farben, Abstände und Effekte
- **Section hinzufügen:** links „+ Section hinzufügen“ und eine wählen
- **Reihenfolge:** Sections an den 6 Punkten ⋮⋮ ziehen
- **Ausblenden:** Auge-Symbol neben der Section
- **Blöcke** (z. B. FAQ-Fragen, Lookbook-Hotspots, Laufschrift-Texte): in der Section auf „+ Block hinzufügen“
- **Speichern** oben rechts nicht vergessen

**Alle Sections:**

| Section | Wofür |
|---|---|
| **Hero** | Großes Bild oder Video oben, Headline, 2 Buttons, Sternschnuppen, Logo mit Maus-Effekt |
| **Drop-Countdown** | Countdown bis zum Drop, „Notify me“-Anmeldung, nach Ablauf „It's live“ mit Sternschnuppen-Regen |
| **Featured Collection** | Produkte einer Kollektion als Grid oder Slider |
| **Featured Product** | Ein Produkt groß mit Galerie, Größen und „In den Warenkorb“ |
| **Lookbook** | 1–2 Bilder mit klickbaren Punkten (Hotspots), die Produkte verlinken. Position mit den Schiebereglern einstellen. |
| **Brand Story / Manifest** | Text, der beim Scrollen Wort für Wort aufleuchtet. Ein `*` vor einem Wort macht es chrom. |
| **Laufschrift (Claim)** | Großer laufender Text, z. B. „Reach for the stars“ |
| **Bild mit Text** | Bild links oder rechts, daneben Text und Button |
| **Mehrspaltig (USPs)** | z. B. Versand / Retoure / Qualität mit Icons |
| **FAQ** | Fragen als Akkordeon (wird für Google ausgezeichnet) |
| **Kundenstimmen** | Bewertungen als Laufband oder Raster. **Nur echte Bewertungen verwenden!** |
| **Instagram-Grid** | Eigene Bilder mit Link zu deinem Profil (lädt nichts von Instagram, DSGVO-freundlich) |
| **Newsletter** | E-Mail-Anmeldung. Landet unter **Kunden** mit dem Tag „newsletter“. |
| **Text** | Überschrift, Text und Button frei kombinierbar |
| **Announcement-Bar** | Laufband ganz oben. Jede Nachricht ist ein Block. |
| **Header / Footer** | Menü, Logo-Position, Suche, Footer-Spalten, Newsletter |

**Abstände:** Fast jede Section hat „Abstand oben/unten“ in %. 100 % = Standard aus den Theme-Einstellungen.

---

## 6. Effekte an- und ausschalten

**Anpassen → Zahnrad (Theme-Einstellungen) → Effekte**

| Schalter | Was passiert |
|---|---|
| Animierter Sternenhimmel | Sterne im Hintergrund. Dichte, Geschwindigkeit und Sternschnuppen-Häufigkeit per Schieberegler. |
| Custom Cursor | Leuchtender Cursor mit Spur (nur am Computer) |
| 3D-Tilt | Produktkarten kippen leicht mit der Maus und glänzen |
| Magnetische Buttons | Buttons „ziehen“ zur Maus |
| Text-Scramble | Headlines bauen sich wie ein Code-Effekt auf |
| Scroll-Animationen | Inhalte blenden beim Scrollen ein (Fade, Slide oder Blur) |
| Preloader | Logo-Animation beim ersten Besuch |
| Seitenübergänge | Weiches Ausblenden beim Seitenwechsel |
| Film-Grain | Feines Filmkorn über allem, Stärke einstellbar |

Weitere Effekte stellst du direkt in den Sections ein (z. B. im Hero: Sternschnuppen-Overlay, Chrom-Headline, Logo im Hintergrund).

**Automatisch:**
- Auf dem **Handy** sind Cursor, Tilt und Magnet aus, und der Sternenhimmel ist sparsamer.
- Hat jemand in seinem Gerät **„Bewegung reduzieren“** eingeschaltet, laufen keine Animationen.

**Farben, Schriftgrößen, Rundungen und Abstände** findest du ebenfalls in den Theme-Einstellungen.

---

## 7. Schriften hochladen (einmalig)

Das Theme lädt die Schriften **von deinem eigenen Shop** und nicht von Google. Das ist wichtig für den Datenschutz. Dafür musst du die Dateien einmal hochladen:

1. Auf **fontshare.com** nach **„Clash Display“** suchen → **Download family**. Dasselbe mit **„Satoshi“**. Beide sind kostenlos, auch für kommerzielle Shops.
2. ZIP-Dateien entpacken. Im Ordner `Fonts/WEB/fonts/` liegen:
   - `ClashDisplay-Variable.woff2`
   - `Satoshi-Variable.woff2`
3. Shopify → Onlineshop → Themes → beim WEAX-Theme **… → Code bearbeiten**
4. Links bei **Assets** auf **„Neues Asset hinzufügen“** und beide `.woff2`-Dateien hochladen
5. Fertig. Die Dateinamen sind in Theme-Einstellungen → Typografie schon eingetragen.

Solange die Dateien fehlen, nutzt der Shop eine ähnliche Systemschrift.

---

## 8. Metafelder

Für Größentabelle, Material, Pflege, Drop-Datum und „Complete the Look“. Die Schritt-für-Schritt-Anleitung steht in **[METAFIELDS.md](METAFIELDS.md)**.

Kurz:
- Einstellungen → Benutzerdefinierte Daten → Produkte → Felder anlegen (`custom.size_chart`, `custom.material`, `custom.care`, `custom.shipping`, `custom.drop_date`, `custom.complete_the_look`)
- Im Produkt ganz unten bei „Metafelder“ ausfüllen
- Leere Felder sind kein Problem, dann zeigt das Theme den Standardtext aus dem Editor (z. B. „84 % Baumwolle, 16 % Polyester · 380 gsm“)

---

## 9. Rechtstexte

Impressum, AGB, Widerrufsbelehrung, Datenschutz, Versand & Zahlung und Rückgabe sind fertig geschrieben und im Theme eingebaut. Was du noch tun musst, steht in **[RECHTSTEXTE.md](RECHTSTEXTE.md)**.

- **Deine Daten** trägst du einmal ein, unter Theme-Einstellungen → **Rechtliches & Stammdaten**.
- **Texte bearbeiten:** Anpassen → Seiten → Vorlage **legal** → Section „Rechtstext“
- Der **Footer** verlinkt alle Rechtsseiten automatisch.
- Der Kleinunternehmer-Hinweis (§ 19 UStG) erscheint automatisch unter Preisen, im Warenkorb und im Footer.

---

## 10. Einen Drop vorbereiten

1. Produkte anlegen, aber auf **Entwurf** lassen oder nur in einer versteckten Kollektion
2. Im Metafeld **Drop-Datum** das Datum eintragen
3. Startseite → Section **Drop-Countdown** → Datum und Uhrzeit (`2026-12-12 18:00`) und Zeitzone (Winter = MEZ, Sommer = MESZ) eintragen
4. „Notify me“ aktiv lassen. Anmeldungen findest du unter **Kunden**, Filter Tag **„drop-notify“**. Ihnen schickst du zum Drop eine Mail mit Shopify Email.
5. Zum Drop-Zeitpunkt die Produkte auf **Aktiv** stellen. Der Countdown wechselt automatisch zu „It's live“, mit Sternschnuppen-Regen.

**Shop noch geschlossen?** Onlineshop → Einstellungen → **Passwortschutz** aktivieren. Besucher sehen dann die **Coming-Soon-Seite** mit Countdown und Anmeldung, die du im Editor unter „Passwort-Seite“ anpasst.

---

## 11. Englisch & Übersetzungen

- **Deutsch ist Standard.** Alle Buttons, Warenkorb-, Formular- und Konto-Texte gibt es zusätzlich auf **Englisch**.
- **Englisch aktivieren:** Einstellungen → Sprachen → Englisch hinzufügen und veröffentlichen
- **Eigene Inhalte übersetzen** (Headlines, FAQ, Produkttexte): kostenlose App **„Translate & Adapt“**. Die **Rechtstexte bleiben auf Deutsch**, denn die deutsche Fassung ist verbindlich.
- **Theme-Texte ändern** (z. B. „In den Warenkorb“): Onlineshop → Themes → … → **Standardtheme-Inhalte bearbeiten**

---

## 12. Häufige Fragen

**Ein Produkt erscheint nicht?**
Status „Aktiv“? Vertriebskanal „Onlineshop“? In der richtigen Kollektion?

**Größen erscheinen nicht als Buttons / Farben nicht als Kreise?**
Die Option muss genau „Größe“ (oder „Size“) bzw. „Farbe“ (oder „Color“) heißen.

**Unter dem Preis steht „[PLATZHALTER …]“ oder er ist gelb markiert?**
Theme-Einstellungen → Rechtliches & Stammdaten ausfüllen.

**Der Shop wirkt langsam auf alten Handys?**
Theme-Einstellungen → Effekte: Sterne-Dichte verringern oder Grain ausschalten.

**Der Warenkorb öffnet sich nicht seitlich?**
Theme-Einstellungen → Warenkorb → „Slide-out Drawer“ wählen.

**Wie ändere ich die Menüpunkte?**
Onlineshop → **Navigation** → Menü „main-menu“ bzw. „footer“ bearbeiten.

**Wo landen Kontaktformular-Nachrichten und Widerrufe?**
Bei der E-Mail-Adresse unter Einstellungen → Store-Details. Nach jedem Widerruf musst du dem Kunden **sofort eine Eingangsbestätigung** schicken.

---

## 13. Für Entwickler

Shopify Online Store 2.0, ohne Build-Schritt, ohne Frameworks.

```
assets/      base.css (Tokens/Komponenten), product.css, collection.css, customer.css,
             theme.js (Header, AJAX-Cart, Quick-Add, Filter, Reveal, Countdown),
             effects.js (Sternenhimmel, Cursor, Tilt, Magnet, Scramble, Parallax, Preloader),
             product.js (Varianten, Galerie, Zoom, Sticky ATC)
config/      settings_schema.json, settings_data.json
layout/      theme.liquid, password.liquid
locales/     de.default.json, en.json
sections/    alle Sections + header-group.json, footer-group.json
snippets/    product-card, price, icon, button, image, facets, legal-tokens, …
templates/   JSON-Templates inkl. customers/*, gift_card.liquid
rechtstexte/ HTML-Kopien der Rechtstexte für Shopify-Richtlinien (kein Theme-Bestandteil)
```

- **Lokal testen:** `shopify theme dev --store weax-5557.myshopify.com`
- **Prüfen:** `shopify theme check` (Konfiguration in `.theme-check.yml`)
- **Hochladen als unveröffentlichtes Theme:** `shopify theme push --unpublished --store weax-5557.myshopify.com`
- **Design-Tokens:** `snippets/css-variables.liquid` (aus den Theme-Einstellungen)
- **Performance:**
  - Effekte laden per `defer`, der Sternenhimmel startet erst im Leerlauf und pausiert in Hintergrund-Tabs.
  - Bilder mit `srcset` und Lazy Loading.
  - Das Hero-Bild hat `fetchpriority="high"` und keine Opacity-Animation, damit der LCP nicht leidet.
  - Keine externen Skripte oder Fonts.
