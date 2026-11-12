# 🎓 ABIversum 2027 – Shopify-Shop für den Abijahrgang

Ein komplettes Shopify-Theme für euren Abi-Shop:

- 👕 **Abi-Klamotten (Merch)** – Bilder, Preise, Größen und Beschreibungen pflegt ihr ganz normal im Shopify-Admin
- 🍰 **Kuchen, Crêpes & Co. vorreservieren** – mit Abholtermin, Name/Kurs und Anmerkung (Allergien); Produkte jederzeit selbst anlegen und ändern
- 💸 **Bezahlung nur per PayPal**
- 📜 **AGB, Widerrufsbelehrung, Datenschutz, Impressum** als fertige Vorlagen + Button „Vertrag widerrufen“ (Pflicht seit 19.06.2026)
- ✨ **Coole Effekte:** Sternenhimmel mit Sternschnuppen, animiertes Motto (Buchstaben-Welle), schwebende Emojis mit Maus-Parallax, Countdown zum Abiball, 3D-Kippkarten, magnetische Buttons, Glitzer-Mausspur, Konfetti beim In-den-Warenkorb-Legen, Laufschriften – und ein Easter Egg (5× aufs Motto klicken 👀)

---

## 🚀 Abimotto

**ABIversum 2027 – „12 Jahre im Orbit – jetzt starten wir durch. 🚀“**

Passt perfekt zum Weltraum-Design. Ihr könnt es jederzeit im Theme-Editor ändern (Startseite → „Abi-Hero (Motto)“). Andere Ideen:

| Motto | Spruch |
|---|---|
| **ABIversum** | 12 Jahre im Orbit – jetzt starten wir durch. 🚀 |
| **ABIgeflogen** | Endlich raus aus dem Nest! |
| **Mission ABIssible** | Auftrag erfüllt – Agent*innen verlassen das Gebäude. |
| **ABI Lounge** | Zurücklehnen, wir haben fertig. |
| **ABInauten** | Houston, wir haben kein Problem mehr. |
| **12 Jahre Level-Up** | Game Over Schule – Next Level Leben. |

---

## 📦 1. Theme hochladen

1. Den Ordner `theme/` als ZIP packen (die Dateien `layout/`, `sections/` … müssen **direkt** im ZIP liegen, nicht in einem Unterordner).
   Fertig gepackt liegt es schon hier: **`abi-shop/ABIversum-theme.zip`**
2. Shopify-Admin → **Onlineshop → Themes → Theme hinzufügen → ZIP-Datei hochladen**
3. Beim neuen Theme auf **„Veröffentlichen“** klicken.

> Wer die Shopify CLI nutzt: `cd abi-shop/theme && shopify theme push --unpublished`

## 💸 2. PayPal als einzige Zahlungsart

1. **Einstellungen → Zahlungen**
2. Bei **PayPal** auf „Aktivieren“ und euer PayPal-**Geschäftskonto** verbinden (kostenlos; am besten das Konto des Fördervereins / der verantwortlichen Person).
3. **Shopify Payments deaktivieren** bzw. gar nicht erst einrichten (unter „Zahlungsanbieter“ → „Verwalten“ → „Deaktivieren“). Alle anderen Zahlungsarten (Manuelle Zahlung, Klarna …) ebenfalls deaktivieren.
4. Test: Eine Bestellung im Shop durchklicken – im Checkout darf nur noch PayPal erscheinen.

> Hinweis: Wenn ihr Shopify Payments nicht nutzt, berechnet Shopify je nach Tarif eine kleine zusätzliche Transaktionsgebühr für externe Anbieter wie PayPal (plus die PayPal-Gebühr). Den aktuellen Stand seht ihr unter Einstellungen → Zahlungen bzw. Plan.

## 📍 3. Abholung an der Schule (statt Versand)

1. **Einstellungen → Versand und Zustellung → Lokale Abholung** → euren Standort (Schule) aktivieren.
2. Abholinfo eintragen, z. B. „Abi-Stand in der Aula zu deinem gewählten Termin“.
3. Unter **Versand** könnt ihr Versand ganz weglassen oder für Merch einen Paketpreis anbieten.
4. **Einstellungen → Standorte**: Adresse der Schule bzw. Lagerort eintragen.

## 🗂️ 4. Kollektionen anlegen

**Produkte → Kollektionen → Kollektion erstellen**

| Kollektion | Handle (wichtig!) | Inhalt |
|---|---|---|
| Abi-Merch | `abi-merch` | Hoodies, Shirts, Caps … |
| Kuchen & Crêpes | `kuchen-crepes` | alles zum Vorbestellen |

Mit genau diesen Handles erscheinen die Produkte automatisch auf der Startseite. (Oder im Theme-Editor in der Sektion eine andere Kollektion auswählen.)

## 👕 5. Klamotten einstellen

**Produkte → Produkt hinzufügen**

- **Titel, Beschreibung, Bilder** (mehrere Bilder → das 2. Bild erscheint beim Drüberfahren auf der Karte)
- **Preis** (und optional „Vergleichspreis“ → zeigt „Sale“-Badge)
- **Varianten:** Option „Größe“ mit S, M, L, XL – optional „Farbe“. Jeder Variante kann ein eigenes Bild zugeordnet werden (z. B. Hoodie in Schwarz/Weiß) – das Bild wechselt dann automatisch.
- **Lagerbestand:** Wenn ihr auf Bestellung produzieren lasst: „Bestand nicht verfolgen“ oder „Verkauf fortsetzen, wenn nicht vorrätig“.
- **Kollektion:** Abi-Merch
- Theme-Vorlage: **Standardprodukt** lassen

**Tipp Größentabelle:** Onlineshop → Seiten → „Größentabelle“ anlegen, dann im Theme-Editor (Produktseite) unter „Größentabelle“ auswählen.

**Personalisierte Kleidung (Name auf dem Shirt):** Am einfachsten pro Person bestellen lassen und im Warenkorb-Nachrichtenfeld den Namen angeben. Wenn ihr dafür ein eigenes Pflichtfeld wollt: die Vorlage „vorbestellung“ zeigt, wie das geht (Feld `properties[...]`).

## 🍰 6. Kuchen, Crêpes & Co. einstellen (selbst bearbeitbar!)

**Produkte → Produkt hinzufügen**

1. Titel (z. B. „Schokokuchen – Stück“), Bild, Preis, Beschreibung (Zutaten!)
2. Rechts unter **Theme-Vorlage → `vorbestellung`** auswählen ← **wichtig**, sonst fehlen die Abholfelder
3. Optional Varianten, z. B. „Sorte: Nutella / Zimt & Zucker / Apfelmus“ für Crêpes oder „Größe: Stück / ganzer Kuchen“
4. Kollektion: **Kuchen & Crêpes**
5. Wenn ausverkauft: Lagerbestand auf 0 setzen → Button zeigt „Leider weg 😢“. Oder Produkt auf „Entwurf“ setzen → verschwindet ganz.

**Allergene als eigenes Feld (optional, empfohlen):**
Einstellungen → Benutzerdefinierte Daten → Produkte → **Definition hinzufügen** → Name „Allergene“, Namespace und Key `custom.allergene`, Typ „Einzeiliger Text“. Danach steht bei jedem Produkt unten ein Feld „Allergene“, z. B. „Gluten, Ei, Milch, Haselnuss“.

**Abholtermine ändern:**
Onlineshop → Themes → **Anpassen** → oben in der Mitte „Produkte“ → **vorbestellung** → Sektion „Produkt (Vorbestellung)“ → **Abholtermine (einer pro Zeile)**.
Leer lassen = Kund*innen wählen frei ein Datum im Kalender (frühestens X Tage im Voraus).

**Was ihr in der Bestellung seht:** Bei jeder Position stehen *Abholtermin*, *Name / Kurs* und *Anmerkung*. Tipp für den Verkaufstag: **Bestellungen → Exportieren** (CSV) und nach Abholtermin sortieren → fertige Abholliste.

## 📜 7. Rechtstexte

Im Ordner `rechtstexte/` liegen Vorlagen:

| Datei | Wohin in Shopify |
|---|---|
| `01-AGB.md` | Einstellungen → Richtlinien → **Allgemeine Geschäftsbedingungen** |
| `02-Widerrufsbelehrung.md` | Einstellungen → Richtlinien → **Rückerstattungsrichtlinie** |
| `03-Datenschutzerklaerung.md` | Einstellungen → Richtlinien → **Datenschutzerklärung** |
| `04-Impressum.md` | Einstellungen → Richtlinien → **Impressum** |
| `05-Widerrufsbestaetigung-Vorlage.md` | E-Mail-Vorlage für euch (nicht veröffentlichen) |

1. Alle **[eckigen Klammern]** ausfüllen.
2. Text kopieren und einfügen (Markdown-Zeichen wie `#` und `**` vorher entfernen oder im Editor als Überschrift/Fett formatieren).
3. **Wichtig:** Als Verkäufer muss eine **volljährige Person oder ein Verein** (z. B. Förderverein) auftreten – Minderjährige können nicht allein wirksam Verträge mit Kund*innen schließen. Sprecht das mit eurer Schulleitung/dem Förderverein ab.
4. Prüft, ob ihr Kleinunternehmer nach § 19 UStG seid (bei Abi-Verkäufen fast immer) – sonst „inkl. MwSt.“ im Theme-Editor eintragen.
5. Lebensmittel: Für gelegentliche Kuchenverkäufe von Schulen gelten erleichterte Regeln, aber Allergen-Infos solltet ihr angeben und Hygiene beachten (kühlen, abdecken, Handschuhe). Fragt im Zweifel beim Lebensmittelüberwachungsamt eurer Stadt nach.

> Die Vorlagen sind sorgfältig erstellt, ersetzen aber **keine Rechtsberatung**. Für mehr Sicherheit gibt es Rechtstexte-Abos (z. B. IT-Recht Kanzlei, Händlerbund, eRecht24) mit Shopify-Anbindung.

### Button „Vertrag widerrufen“ (Pflicht seit 19.06.2026)

1. Onlineshop → Seiten → **Seite hinzufügen**: Titel „Vertrag widerrufen“, Theme-Vorlage **`widerruf`**, URL-Handle `vertrag-widerrufen`.
2. Im Footer-Menü verlinken (siehe 8.).
3. Wenn ein Widerruf reinkommt (landet als E-Mail im Postfach eures Shops): **sofort** mit `05-Widerrufsbestaetigung-Vorlage.md` antworten.

## 🧭 8. Seiten & Menüs

**Seiten anlegen** (Onlineshop → Seiten):
- „Kontakt“ → Vorlage **`kontakt`**
- „Vertrag widerrufen“ → Vorlage **`widerruf`**
- optional „Größentabelle“, „Über uns“

**Menüs** (Onlineshop → Navigation):
- **Hauptmenü** (`main-menu`): Merch → `/#merch` bzw. Kollektion Abi-Merch · Kuchen & Crêpes → Kollektion · FAQ → `/#faq` · Kontakt → Seite Kontakt
- **Footer** (`footer`): AGB · Widerrufsbelehrung · Datenschutz · Impressum · Versand/Abholung · **Vertrag widerrufen** · Kontakt

## 🎨 9. Alles im Theme-Editor anpassen

Onlineshop → Themes → **Anpassen**

- **Abi-Hero:** Motto, Spruch, Jahrgang, Buttons, Countdown-Datum (Format `2027-07-03T19:00`), schwebende Emojis
- **Laufschriften:** Texte als Blöcke hinzufügen/löschen, Geschwindigkeit
- **So funktioniert's / FAQ:** Blöcke bearbeiten
- **Theme-Einstellungen (Zahnrad):** Farben, Schriften, Ecken-Rundung, **Effekte einzeln an/aus** (Sternenhimmel, Glitzer, Konfetti, 3D-Kippen, Film-Korn)
- Sektionen per Drag & Drop umsortieren oder neue hinzufügen

Alle Animationen schalten sich automatisch ab, wenn jemand auf dem Gerät „Bewegung reduzieren“ aktiviert hat (Barrierefreiheit).

## ✅ 10. Checkliste vor dem Launch

- [ ] Theme veröffentlicht
- [ ] PayPal verbunden, alle anderen Zahlungsarten aus
- [ ] Lokale Abholung aktiv
- [ ] Kollektionen `abi-merch` + `kuchen-crepes` angelegt, Produkte drin
- [ ] Kuchen-Produkte haben Vorlage `vorbestellung`
- [ ] Abholtermine im Theme-Editor eingetragen
- [ ] Rechtstexte ausgefüllt und unter Richtlinien eingefügt
- [ ] Seiten „Kontakt“ & „Vertrag widerrufen“ angelegt, Menüs gesetzt
- [ ] Einstellungen → Kundendatenschutz: **Cookie-Banner** aktiviert
- [ ] Testbestellung mit PayPal durchgeführt (und erstattet)
- [ ] Passwortschutz entfernt (Onlineshop → Einstellungen)

---

### Dateistruktur

```
abi-shop/
├── ABIversum-theme.zip        ← direkt in Shopify hochladen
├── theme/
│   ├── layout/                theme.liquid, password.liquid
│   ├── sections/              Hero, Kollektionen, Laufschrift, FAQ, Produkt, Vorbestellung, Warenkorb, Widerruf …
│   ├── snippets/              Produktkarte, Preis, Varianten, Galerie …
│   ├── templates/             index, product, product.vorbestellung, page.kontakt, page.widerruf …
│   ├── assets/abi.css         Design
│   ├── assets/abi.js          Effekte + Warenkorb-Logik (ohne externe Bibliotheken)
│   ├── config/                Theme-Einstellungen
│   └── locales/
└── rechtstexte/               AGB, Widerruf, Datenschutz, Impressum, E-Mail-Vorlage
```
