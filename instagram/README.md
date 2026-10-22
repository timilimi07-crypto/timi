# WEAX – Erste Instagram-Reels (Drop 01)

Zwei Reels im 9:16-Format (1080×1920, 30 fps), Texte auf Englisch, im WEAX-Look: Chrome auf Schwarz, W-Orbit-Logo, Cinzel.

| Datei | Länge | Zweck |
|---|---|---|
| `out/01_hook.mp4` | ~10 s | **Köder-Hook (nichts mit der Brand).** Hypnotische Spirale ab Frame 1: „STARE AT THE RED DOT – DON'T LOOK AWAY“ + Countdown 5→1. Dann „NOW LOOK HERE.“ → das Outfit steht still, scheint sich für den Zuschauer aber zu bewegen (Nachbild-Illusion). „IT'S MOVING, RIGHT?“ + „comment what you saw“ (Kommentare = Reichweite). Erst danach kurz WEAX-Logo „DROP 01 · SOON“. Loopt zurück zur Spirale. |
| `out/02_drop.mp4` | ~15 s | **Drop-Reveal (Englisch).** Spirale „WAIT FOR IT…“ → „DROP 01“ mit Schockwelle → W-Logo + „TRACKSUIT“ → Hoodie-Reveal → Drehung → Details (LOGO EMBROIDERED, STAR INSIDE THE HOOD, 380 GSM FLEECE, STAR ON THE HEM) → Hose vorne/hinten → Outfit + Logo → „DROP 01 IS LIVE. LINK IN BIO →“ |

Effekte: Schockwellen, Zoom-Blur-Übergänge, anamorphe Lens-Flares, Funkenregen, Invert-Strobe, RGB-Glitch, Scanlines, Kamera-Shake.
Alle Schnitte liegen auf dem Beat von „Shotta's.“ (Season 25, 67 BPM → Double-Time 134 BPM).

## Song: „Shotta's.“ – Season 25

Spotify: https://open.spotify.com/track/0M4R6G6junOgTJDccOEGHo

Der Song ist **nicht** eingebettet. Füg ihn direkt in Instagram hinzu:
Reel hochladen → **Audio** → „Shotta's Season 25“ suchen → Startpunkt auf den Drop/Hook des Songs setzen.

Warum in der App: Das Reel wird dann unter dem Sound gelistet (zusätzliche Reichweite über die Audio-Seite),
und Instagram schaltet den Ton nicht wegen Urheberrecht stumm.

### Optional: Song fest einbauen und Schnitte exakt auf den Song legen

Für TikTok / CapCut oder wenn die Schnitte 100 % auf dem Song sitzen sollen:

```bash
python3 render_reels.py --audio shottas.mp3 --start 0:31
```

`--start` = Stelle im Song, an der das Video anfangen soll (am besten direkt der Drop).
Das Script erkennt Tempo und ersten Beat selbst und legt alle Schnitte darauf.
Falls es daneben liegt: `--bpm 142 --offset 0.1` erzwingt Tempo und Startversatz.
Für Video 2 einen anderen Songteil: `--start2 0:52`.

## Klamotten (Tracksuit-Mockups)

Die Teile kommen aus `mockups/` – freigestellt aus `weax_mockups_tracksuit.pdf`:
`hoodie_front.png`, `hoodie_back.png`, `pants_front.png`, `pants_back.png` und `logo.png` (W-Orbit-Logo).
Neue Mockups einspielen:

```bash
python3 prepare_mockups.py neue_mockups.pdf   # erwartet 4 Bilder: Hoodie vorne/hinten, Hose vorne/hinten
python3 render_reels.py
```

Zusätzlich entstehen Einzelbilder jedes Teils im WEAX-Look (9:16) in `out/bilder/` – für Story, Post oder Shop.

## Posting-Plan

1. **Tag 1 – `01_hook.mp4`** (Teaser). Abends 18–20 Uhr posten.
2. **Tag 2–3 – `02_drop.mp4`** (Drop), wenn der Shop live ist.
3. Beide Reels zusätzlich in die Story mit Countdown-Sticker (Hook) bzw. Link-Sticker (Drop).
4. Erste 30–60 Minuten nach dem Posten aktiv auf Kommentare antworten – das pusht das Reel.

**Cover:** Für 01 einen Spiral-Frame mit „STARE AT THE RED DOT“, für 02 den Frame mit dem kompletten Outfit + Logo wählen.

### Caption – Reel 1 (Hook)
```
did it move for you too? 👁
comment what you saw 👇

#opticalillusion #illusion #trippy #streetwear #weax #drop01 #fyp #explore
```

### Caption – Reel 2 (Drop)
```
DROP 01 — TRACKSUIT ⭐
hoodie + pants. 380 gsm fleece. black & white.
limited. once it's gone, it's gone. link in bio.

#weax #drop01 #tracksuit #streetwear #fitcheck #newbrand #outfitinspo #fyp
```

## Neu rendern

Benötigt Python 3 mit `numpy` + `Pillow` und `ffmpeg`.

```bash
python3 render_reels.py            # beide Videos
python3 render_reels.py --only hook
```

Texte, Reihenfolge und Szenenlängen (in Beats) stehen in `hook_scenes()` und `drop_scenes()` in `render_reels.py`.
