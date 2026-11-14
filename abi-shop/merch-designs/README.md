# Abi-Merch „ABIversum 2027“ – Druckdateien

| Produkt | Druckdatei | Größe | Farben | Textil |
|---|---|---|---|---|
| Pulli vorne (Brust links) | `druckdateien/pulli-brust-10x10cm.png/.pdf` | 10 × 10 cm | Weiß, Pink, Lila, Cyan | schwarzer Hoodie |
| Pulli hinten (mit Namen) | `druckdateien/pulli-ruecken-30x40cm.png/.pdf` | 30 × 40 cm | Weiß, Pink, Lila, Cyan | schwarzer Hoodie |
| T-Shirt vorne | `druckdateien/tshirt-vorne-30x30cm.png/.pdf` | 30 × 30 cm | Weiß, Pink, Lila, Cyan | navy T-Shirt |
| Jutebeutel | `druckdateien/tasche-30x30cm.png/.pdf` | 30 × 30 cm | Navy + Pink (2 Farben) | Natur-Baumwolle |

- PNG: 300 dpi, transparenter Hintergrund → für Digitaldruck (DTG/DTF).
- PDF: Vektor → für Siebdruck oder Flex/Flock.
- Ansicht: `mockups/`.

## Namen auf der Rückseite ändern
1. `namen.txt` öffnen, ein Name pro Zeile eintragen (aktuell Platzhalter).
2. `python3 build.py && node render.cjs` ausführen – oder die Namensliste einfach an Claude schicken.
3. `[NAME DER SCHULE]` steht in `build.py` (Funktion `back`).
