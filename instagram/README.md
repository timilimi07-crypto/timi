# WEAX – Erste Instagram-Reels (Drop 01)

Zwei Reels im 9:16-Format (1080×1920, 30 fps) im WEAX-Look: Chrome auf Schwarz, Stern-Logo, Cinzel.

| Datei | Länge | Zweck |
|---|---|---|
| `out/01_hook.mp4` | ~7 s | **Aufmerksamkeit.** Text gleich im ersten Frame („DU KENNST UNS NICHT. / NOCH.“), Hoodie im Dunkeln – nur die Paspeln leuchten auf, Strobe-Sterne, W-Logo, „DROP 01 – KOMMT BALD.“ Das Ende glitcht zurück zum Anfang, damit das Reel loopt. |
| `out/02_drop.mp4` | ~13 s | **Drop-Reveal.** „DROP 01“-Slam → W-Logo + „TRACKSUIT“ → Hoodie-Reveal (Paspeln zuerst) → Drehung nach hinten → 4 Detail-Cuts (Logo, Stern in der Kapuze, Fleece, Stern am Saum) → Hose vorne/hinten → komplettes Outfit mit Logo → „DROP 01 IST LIVE. LINK IN BIO →“ |

Alle Schnitte liegen auf dem Beat (Standard 140 BPM, Kick auf jedem Schnitt).

## Song: „Shottas“ – Season 25

Der Song ist **nicht** eingebettet. Füg ihn direkt in Instagram hinzu:
Reel hochladen → **Audio** → „Shottas Season 25“ suchen → Startpunkt auf den Drop/Hook des Songs setzen.

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

**Cover:** Für 01 den „NOCH.“-Frame, für 02 den Frame mit dem kompletten Outfit + Logo wählen.

### Caption – Reel 1 (Hook)
```
ihr kennt uns noch nicht. ⭐
drop 01 kommt. folgen, sonst verpasst ihr's.

#weax #drop01 #streetwear #streetweardeutschland #newbrand #fashiontok #outfitinspo #comingsoon
```

### Caption – Reel 2 (Drop)
```
DROP 01 — TRACKSUIT ⭐
hoodie + jogginghose. 380 g/m² fleece. schwarz & weiß.
limitiert. wenn weg, dann weg. link in bio.

#weax #drop01 #tracksuit #streetwear #streetweardeutschland #fitcheck #newbrand #outfitinspo
```

## Neu rendern

Benötigt Python 3 mit `numpy` + `Pillow` und `ffmpeg`.

```bash
python3 render_reels.py            # beide Videos
python3 render_reels.py --only hook
```

Texte, Reihenfolge und Szenenlängen (in Beats) stehen in `hook_scenes()` und `drop_scenes()` in `render_reels.py`.
