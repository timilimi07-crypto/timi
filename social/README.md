# WEAX – Social Content (Muster, Drop 01 „Origin“)

## Dateien

| Datei | Format | Wofür |
|---|---|---|
| `export/weax-logo-swipe-de-1..5.png` / `-en-1..5.png` | 1080×1350 (4:5) | **Neu:** Logo-Karussell DE/EN, Chrome-Linie läuft nahtlos über alle 5 Bilder |
| `export/weax-reel-das-set.mp4` | 1080×1920, 13 s, 30 fps, ohne Ton | **Neu:** Reel mit Model-Foto + echtem Logo |
| `export/weax-reel-das-set-cover.jpg` | 1080×1920 | Titelbild fürs Reel (= erster Frame) |
| `export/weax-reel-origin-drop01.mp4` | 1080×1920, 13 s, 30 fps, ohne Ton | Insta-Reel / TikTok |
| `export/weax-karussell-1.png` … `-5.png` | 1080×1350 (4:5) | Insta-Karussell / TikTok-Fotomodus |
| `src/` | HTML + Render-Skripte | Zum Ändern und neu Rendern |

## Reel „Das Set“ – Ablauf

| Zeit | Bild |
|---|---|
| 0–1,5 s | Model-Foto + „Jeder fragt mich: Was ist das für 'ne Marke?“ (steht schon im 1. Frame = Thumbnail) |
| 1,5–4 s | Blitz → W-Logo im Sternenhimmel, Chrome-Glanz, Stern blitzt, „WEAX“ |
| 4–7,8 s | Schnelle Zooms: 01 Hoodie → 02 Pants → Das komplette Set |
| 8–10 s | „Nicht für jeden. Für dich.“ |
| 10–13 s | Logo, „Drop 01 · Limitiert · Kein Restock“, „Link in Bio“ |

## Reel „Origin“ – Ablauf

| Zeit | Bild | Zweck |
|---|---|---|
| 0–1,6 s | „Das ist kein Pullover.“ (Punch-In) | Hook – Widerspruch hält den Daumen an |
| 1,6–3,4 s | „…das ist ein STATEMENT.“ (Chrome) | Auflösung, Blitz-Schnitt |
| 3,4–6,4 s | Pullover-Reveal, Stern zündet | Produkt |
| 6,4–8,6 s | Schweres Fleece / Cleaner Schnitt / Ein Stern | Schnelle Schnitte = Rewatches |
| 9–11 s | WEAX-Logo, Drop 01 | Marke |
| 11–13 s | „Limitiert. Kein Restock. Link in Bio“ | CTA, blendet schwarz → loopt nahtlos |

**Ton:** Das Video ist absichtlich stumm. Beim Hochladen einen **aktuellen Trend-Sound** in der App drüberlegen (Insta/TikTok pushen Videos mit Trend-Audio stärker). Gut passen: dunkle Phonk-/Slowed-Beats mit Drop bei ~3 s (= Produkt-Reveal).

## Captions

**Reel / TikTok**
> Kein Restock. Nie. ⭐ Drop 01 – Origin Pullover. Link in Bio.
>
> #weax #streetwear #newdrop #limitededition #outfitinspo #fashiontiktok #darkaesthetic #minimalstyle #smallbusiness #germanbrand

**Karussell**
> Wir haben nicht 100 Teile gemacht. Wir haben eins gemacht – und das richtig. Swipe bis zum Ende. ⭐
> Speichern, falls du den Drop nicht verpassen willst.
>
> #weax #streetwear #drop01 #originpullover #minimalism #qualityoverquantity #smallbrand #fashion

## Weitere Hook-Ideen (für die nächsten Reels)

1. „POV: Du trägst ein Teil, das es nur 100× gibt.“
2. „Ich hab meine eigene Marke gestartet. Das ist Teil Nr. 1.“ (Gesicht + Story = Vertrauen)
3. „Rate den Preis.“ → Kommentare pushen den Algorithmus
4. Packing-Order-Video: „Ich packe deine Bestellung.“
5. Vorher/Nachher: Billig-Pulli vs. WEAX – Stoff anfassen, Gewicht zeigen
6. „Kommentiere ⭐ und ich schicke dir den Early-Access-Link.“

## Neu rendern

```bash
cd social/src
NODE_PATH=/opt/node22/lib/node_modules node render.cjs reel-set.html ../export/weax-reel-das-set.mp4 30
NODE_PATH=/opt/node22/lib/node_modules node render.cjs reel.html ../export/weax-reel-origin-drop01.mp4 30
NODE_PATH=/opt/node22/lib/node_modules node shoot-pano.cjs carousel-logo.html ../export weax-logo-swipe-de "?lang=de"
NODE_PATH=/opt/node22/lib/node_modules node shoot-pano.cjs carousel-logo.html ../export weax-logo-swipe-en "?lang=en"
NODE_PATH=/opt/node22/lib/node_modules node shoot-carousel.cjs carousel.html ../export
```

Benötigt Node mit Playwright (Chromium) und ffmpeg.
