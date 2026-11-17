# WEAX – Rechtstexte: Was du noch tun musst

> **Wichtig:** Die Texte sind sorgfältig nach den gesetzlichen Vorgaben und den offiziellen Mustern geschrieben (Stand 17.11.2026). Sie sind aber **keine Rechtsberatung**. Lass sie vor dem Livegang einmal prüfen, am besten von einem Rechtstexte-Service mit Abmahnschutz (z. B. Händlerbund, IT-Recht Kanzlei, Trusted Shops, eRecht24). Das kostet etwa 10 bis 25 € im Monat.

---

## 1. Platzhalter ausfüllen (das Wichtigste!)

Alle Daten trägst du **nur einmal** ein. Sie erscheinen dann automatisch in allen Rechtstexten.

**So geht's:** Onlineshop → Themes → *WEAX Night* → **Anpassen** → unten links das Zahnrad (**Theme-Einstellungen**) → **Rechtliches & Stammdaten**

Solange ein Feld leer ist, steht im Shop ein **gelb markierter [PLATZHALTER: …]**. Den sieht jeder Besucher, also bitte vor dem Livegang alles ausfüllen.

| Feld in den Theme-Einstellungen | Status | Erscheint in |
|---|---|---|
| Firmen-/Markenname | ✅ „WEAX“ | allen Texten |
| Inhaber | ✅ „Tim Martens“ | allen Texten |
| **Straße und Hausnummer** | ❌ **[PLATZHALTER]** | Impressum, AGB, Widerruf (3×), Datenschutz, Rückgabe |
| **PLZ und Ort** | ❌ **[PLATZHALTER]** | wie oben |
| Land | ✅ „Deutschland“ | wie oben |
| E-Mail | ✅ offical.weax@outlook.de | allen Texten |
| **Telefonnummer** | ❌ **[PLATZHALTER]** | Impressum, Widerrufsbelehrung, Datenschutz |
| Domain | ✅ wearweax.com | AGB |
| **USt-IdNr.** | ❌ **[PLATZHALTER]** | Impressum. *Hast du keine? Dann den Haken „Ich habe (noch) keine USt-IdNr.“ setzen, dann verschwindet die Zeile.* |
| **Versandkosten Deutschland** | ❌ **[PLATZHALTER]** | Versand & Zahlung |
| **Lieferzeit** | ❌ **[PLATZHALTER]** | AGB, Versand & Zahlung |
| **Versanddienstleister** | ❌ **[PLATZHALTER]** | Datenschutz, Versand & Zahlung |
| Rücksendeadresse | optional (leer = deine Anschrift) | Widerrufsbelehrung, Rückgabe |
| Wer trägt die Rücksendekosten? | ✅ „Kunde“ (gesetzlicher Standard) | Widerrufsbelehrung, Rückgabe |
| **Datenschutz-Aufsichtsbehörde** | ❌ **[PLATZHALTER]** | Datenschutz. *Die Behörde deines Bundeslandes, z. B. in Baden-Württemberg: „Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Lautenschlagerstraße 20, 70173 Stuttgart“.* |
| Stand der Rechtstexte | ✅ 17.11.2026 | unter jedem Text. *Bei jeder Änderung anpassen.* |
| Gratis-Versand ab | ✅ 80 € (Theme-Einstellungen → Warenkorb) | Versand & Zahlung |

**Tipp zur Adresse:** Im alten Rechtstexte-Leitfaden stand, dass die PLZ in der Kontakt-Richtlinie nicht zum Ort passte. Bitte eine ladungsfähige Anschrift (kein Postfach) eintragen und überall gleich verwenden.

---

## 2. Die Seiten in Shopify anlegen

Die Texte stecken im Theme (Vorlage **legal**). Shopify braucht trotzdem für jede Seite eine (leere) Seite, damit es die Adresse gibt.

**Onlineshop → Seiten → Seite hinzufügen**, für jede Zeile:

| Titel | Handle (URL), muss **genau so** heißen | Theme-Vorlage |
|---|---|---|
| Impressum | `impressum` | **legal** |
| AGB | `agb` | **legal** |
| Widerrufsbelehrung | `widerrufsbelehrung` | **legal** |
| Datenschutzerklärung | `datenschutz` | **legal** |
| Versand & Zahlung | `versand-und-zahlung` | **legal** |
| Rückgabe & Retouren | `rueckgabe` | **legal** |
| Vertrag widerrufen | `vertrag-widerrufen` | **widerruf** |

- **Inhalt:** leer lassen. Der Text kommt automatisch aus dem Theme.
- **Handle ändern:** unten auf der Seite bei „Suchmaschineneintrag bearbeiten“ → „URL und Handle“.
- **Theme-Vorlage:** rechts in der Seitenleiste.
- Sobald die Seiten existieren, verlinkt der **Footer sie automatisch**. Du musst kein Menü anlegen.

---

## 3. Texte bearbeiten (ohne Code)

1. Onlineshop → Themes → **Anpassen**
2. Oben in der Mitte die Seitenauswahl öffnen → **Seiten** → **legal** → z. B. „Impressum“ wählen
3. Links siehst du die Sections „Rechtstext“ (eine pro Seite). Klick auf die Section, dann auf einen **Abschnitt**, und ändere Überschrift oder Text.
4. **Speichern**

- Kürzel wie `[[STRASSE]]`, `[[EMAIL]]` oder `[[LIEFERZEIT]]` im Text **nicht löschen**. Sie werden automatisch durch deine Stammdaten ersetzt.
- Neue Abschnitte fügst du mit „Block hinzufügen“ hinzu.
- In jeder Rechtstext-Section steht im Feld „Zeigen auf Seite (Handle)“, auf welcher Seite sie erscheint.

---

## 4. Shopify-Richtlinien füllen (für den Checkout!)

Der **Checkout** verlinkt nicht deine Seiten, sondern die Shopify-Richtlinien. Damit es **keine zwei verschiedenen Fassungen** gibt, füllst du sie mit denselben Texten:

**Einstellungen → Richtlinien**, jeweils den Inhalt der Datei aus dem Ordner `rechtstexte/` einfügen:

| Richtlinie in Shopify | Datei |
|---|---|
| Widerrufsrecht | `rechtstexte/widerrufsbelehrung.html` |
| Datenschutzerklärung | `rechtstexte/datenschutz.html` |
| Allgemeine Geschäftsbedingungen | `rechtstexte/agb.html` |
| Versandrichtlinie | `rechtstexte/versand-und-zahlung.html` |
| Impressum / Rechtliche Hinweise | `rechtstexte/impressum.html` |

**So geht's:** Datei im Browser öffnen, alles markieren und kopieren, in Shopify einfügen. Oder im Editor auf „<>“ (HTML) klicken und den Dateiinhalt einfügen. **In diesen Dateien musst du die [PLATZHALTER] von Hand ersetzen**, denn sie kennen deine Theme-Einstellungen nicht. Wenn du später etwas im Theme änderst, pass die Richtlinie genauso an.

---

## 5. Weitere Pflichten außerhalb der Texte

- [ ] **Bestellbestätigung:** Einstellungen → Benachrichtigungen → Bestellbestätigung. Widerrufsbelehrung, Muster-Widerrufsformular und AGB **als Text** unten einfügen (dauerhafter Datenträger). Ein Link allein reicht nach überwiegender Meinung nicht.
- [ ] **Widerrufsbutton testen:** Seite „Vertrag widerrufen“ einmal selbst ausprobieren. Nach jedem Widerruf musst du dem Kunden **unverzüglich eine Eingangsbestätigung per E-Mail** schicken (Inhalt, Datum und Uhrzeit des Widerrufs). Postfach täglich prüfen.
- [ ] **Cookie-Banner:** Einstellungen → Datenschutz der Kunden → Cookie-Banner für die EU einschalten.
- [ ] **Double-Opt-in** für E-Mail-Marketing einschalten (Einstellungen → Kundenkonten bzw. Marketing). Die Datenschutzerklärung beschreibt Double-Opt-in.
- [ ] **Steuern:** Einstellungen → Steuern und Abgaben. Prüfen, dass keine Umsatzsteuer berechnet oder als „enthalten“ angezeigt wird.
- [ ] **Zahlungsarten:** Wenn Shopify Payments **nicht** aktiv ist, in AGB § 6, Datenschutz Nr. 7 und „Versand & Zahlung“ die Shopify-Payments-Absätze löschen. Kommt eine neue Zahlungsart dazu (z. B. Klarna), Texte ergänzen.
- [ ] **Checkout-Button:** In AGB § 3 steht die Button-Aufschrift „Jetzt bezahlen“. Einmal im Checkout prüfen, ob sie genau so heißt, sonst den Text anpassen.
- [ ] **Telefon:** Hast du keine Telefonnummer, die du veröffentlichen willst? Dann im Impressum und in der Widerrufsbelehrung die Telefon-Angabe löschen. Im Impressum braucht es aber einen zweiten schnellen Kontaktweg, z. B. das Kontaktformular.
- [ ] **Produktseiten:** Material in Prozent (z. B. „84 % Baumwolle, 16 % Polyester“), Pflegehinweise, Lieferzeit und Herstellerangaben nach GPSR (Name, Postanschrift, E-Mail) eintragen.
- [ ] **Kundenbewertungen:** Die Section „Kundenstimmen“ ist auf der Startseite **ausgeschaltet**, weil sie nur Beispieltexte enthält. Nur mit echten Bewertungen einschalten und angeben, ob und wie geprüft wird, dass sie von echten Käufern stammen (§ 5b Abs. 3 UWG).
- [ ] **Verpackungsgesetz:** Vor dem ersten Versand bei LUCID registrieren und Verpackungen bei einem dualen System lizenzieren.
- [ ] **Neue Tools:** Kommt eine App, ein Tracking-Tool (z. B. Meta-Pixel, TikTok-Pixel, Google Analytics) oder ein neues Versandland dazu, müssen Datenschutzerklärung bzw. „Versand & Zahlung“ angepasst werden.

---

## 6. Was ich bewusst so gemacht habe

- **Kein Link zur EU-Streitschlichtungsplattform (OS-Plattform):** Sie wurde am 20.07.2025 abgeschaltet. Der Link ist nicht mehr nötig und wäre falsch.
- **„Sie“ statt „du“** in allen Rechtstexten, damit die Ansprache einheitlich zur gesetzlichen Muster-Widerrufsbelehrung passt.
- **Widerrufsbelehrung:** Der Text ist das gesetzliche Muster (Anlage 1 zu Art. 246a § 1 Abs. 2 EGBGB), dazu das Muster-Widerrufsformular (Anlage 2). Ergänzt ist nur ein Satz zur Widerrufsfunktion „Vertrag widerrufen“ (Pflicht seit 19.06.2026). *Bitte von deinem Rechtstexte-Service prüfen lassen, ob das amtliche Muster seitdem einen eigenen Wortlaut für diesen Hinweis vorsieht.*
- **Kleinunternehmer:** Der Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet“ steht in AGB, Impressum, „Versand & Zahlung“, unter jedem Preis, im Warenkorb und im Footer.
- **Bestellungen von Minderjährigen** (eure Zielgruppe ab 16) brauchen laut AGB § 3 die Zustimmung der Eltern.

---

## 7. Technisches (falls du es brauchst)

- Texte: `templates/page.legal.json` (eine Section „Rechtstext“ pro Seite)
- Design: `sections/legal-text.liquid` und `snippets/weax-legal-style.liquid`
- Platzhalter-Ersetzung: `snippets/legal-tokens.liquid`
- Footer-Links: `snippets/legal-links.liquid`
- Kopien für die Shopify-Richtlinien: `rechtstexte/*.html`
- Seiten mit Vorlage „legal“, die **keinen** eigenen Rechtstext haben, zeigen einfach den Seiteninhalt aus dem Admin.
