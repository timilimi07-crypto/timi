# WEAX – Metafelder einrichten (einmalig, ca. 10 Minuten)

Mit Metafeldern gibst du jedem Produkt **eigene Extras**: Größentabelle, Material, Pflege, Drop-Datum und „Complete the Look“. Das Theme liest sie automatisch aus. Leere Felder sind kein Problem, dann zeigt das Theme den Standardtext aus dem Theme-Editor.

## 1. Metafelder anlegen

**Einstellungen → Benutzerdefinierte Daten → Produkte → Definition hinzufügen**

Leg diese Felder an. **Namespace und Schlüssel** müssen **genau** so heißen (Shopify schlägt sie automatisch vor, wenn du den Namen eintippst; sonst über „Namespace und Schlüssel“ von Hand eintragen):

| Name (frei wählbar) | Namespace und Schlüssel | Typ | Wofür |
|---|---|---|---|
| Größentabelle | `custom.size_chart` | **Seite** *(oder „Rich Text“)* | Popup „Größentabelle“ auf der Produktseite |
| Material | `custom.material` | **Mehrzeiliger Text** *(oder Rich Text)* | Akkordeon „Material & Fit“ |
| Pflege | `custom.care` | **Mehrzeiliger Text** *(oder Rich Text)* | Akkordeon „Pflege“ |
| Versand-Info | `custom.shipping` | **Mehrzeiliger Text** *(oder Rich Text)* | Akkordeon „Versand & Rückgabe“ (optional) |
| Drop-Datum | `custom.drop_date` | **Datum und Uhrzeit** | Zeile „Drop: …“ und „New Drop“-Badge |
| Complete the Look | `custom.complete_the_look` | **Produkt → Liste mit Produkten** | Empfehlungen unter dem Produkt |

Bei jeder Definition den Haken **„Zugriff für Storefronts“** setzen, falls er angeboten wird.

## 2. Werte pro Produkt eintragen

**Produkte → Produkt öffnen → ganz unten „Metafelder“**

- **Material:** z. B. `84 % Baumwolle, 16 % Polyester · 380 gsm · Oversized Fit`. Die Materialangabe in Prozent ist **Pflicht** (EU-Textilkennzeichnungsverordnung).
- **Pflege:** z. B. `Auf links bei 30 °C waschen. Nicht in den Trockner.`
- **Drop-Datum:** Datum, an dem das Teil erscheint. 21 Tage danach (einstellbar) zeigt die Karte „New Drop“.
- **Complete the Look:** passende Teile auswählen, z. B. zum Hoodie die passende Open-Leg Pants.

## 3. Größentabelle – so geht's am einfachsten

1. **Onlineshop → Seiten → Seite hinzufügen**, Titel z. B. „Größentabelle Hoodie“.
2. Im Editor über das Tabellen-Symbol eine Tabelle einfügen, z. B.:

| Größe | Brustbreite | Länge | Ärmel |
|---|---|---|---|
| XS | [PLATZHALTER] cm | [PLATZHALTER] cm | [PLATZHALTER] cm |
| S | … | … | … |
| M | … | … | … |
| L | … | … | … |
| XL | … | … | … |

3. Im Produkt beim Metafeld **Größentabelle** diese Seite auswählen.

**Eine Tabelle für alle?** Im Theme-Editor auf der Produktseite → Section „Produkt“ → **Standard-Größentabelle (Seite)** die Seite wählen. Die gilt dann für alle Produkte ohne eigenes Metafeld.

> Tipp: Damit die Seite „Größentabelle Hoodie“ nicht im Shop auffindbar ist, setze sie auf **ausgeblendet**. Das Popup funktioniert trotzdem.

## 4. Varianten richtig benennen

Damit Größen als Buttons und Farben als Farbkreise erscheinen, die Optionen so nennen:

- **Größe** (oder „Size“) mit den Werten XS, S, M, L, XL
- **Farbe** (oder „Color“) mit den Werten **Schwarz**, **Weiß** (weitere bekannte Farben: Grau, Anthrazit, Navy, Beige …)

Eigene Farben: Bei der Option „Farbe“ in Shopify ein **Farbmuster** (Swatch) hinterlegen, das nutzt das Theme automatisch.

## 5. „New Drop“-Badge ohne Metafeld

Alternativ zum Drop-Datum kannst du einem Produkt den **Tag** `new` oder `new-drop` geben.
