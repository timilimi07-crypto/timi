# WEAX – Erste Instagram-Reels (Drop 01)

Zwei Reels im 9:16-Format (1080×1920, 30 fps) im WEAX-Look: Chrome auf Schwarz, Stern-Logo, Cinzel.

| Datei | Länge | Zweck |
|---|---|---|
| `out/01_hook.mp4` | ~7 s | **Aufmerksamkeit.** Text gleich im ersten Frame („DU KENNST UNS NICHT. / NOCH.“), Strobe-Sterne, Logo-Aufbau, „DROP 01 – KOMMT BALD.“ Das Ende glitcht zurück zum Anfang, damit das Reel loopt. |
| `out/02_drop.mp4` | ~10,5 s | **Drop-Reveal.** „DROP 01“-Slam → „ORIGIN“ → Pullover-Reveal → 3 Detail-Cuts → Pullover + WEAX-Logo zusammen → „DROP 01 IST LIVE. LINK IN BIO →“ |

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

## Echte Klamotten-Fotos statt Mockup

Der Pullover im Video ist ein gezeichneter Platzhalter. Mit echten Fotos wirkt es deutlich stärker:

```bash
python3 render_reels.py --photos fotos/
```

`fotos/` mit 3–5 Hochformat-Bildern (jpg/png) füllen, sortiert nach Dateiname:
`1_ganz.jpg` (Reveal), `2_stoff.jpg`, `3_schnitt.jpg`, `4_stern.jpg` (Details), letztes Bild = Logo-Szene.
Die Fotos bekommen automatisch den kühlen, entsättigten WEAX-Look.

Am besten: getragen, nachts/dunkel, ein harter Lichtkegel, Stern auf der Brust gut sichtbar.

## Posting-Plan

1. **Tag 1 – `01_hook.mp4`** (Teaser). Abends 18–20 Uhr posten.
2. **Tag 2–3 – `02_drop.mp4`** (Drop), wenn der Shop live ist.
3. Beide Reels zusätzlich in die Story mit Countdown-Sticker (Hook) bzw. Link-Sticker (Drop).
4. Erste 30–60 Minuten nach dem Posten aktiv auf Kommentare antworten – das pusht das Reel.

**Cover:** Für 01 den „NOCH.“-Frame, für 02 den Frame mit Pullover + WEAX-Logo wählen.

### Caption – Reel 1 (Hook)
```
ihr kennt uns noch nicht. ⭐
drop 01 kommt. folgen, sonst verpasst ihr's.

#weax #drop01 #streetwear #streetweardeutschland #newbrand #fashiontok #outfitinspo #comingsoon
```

### Caption – Reel 2 (Drop)
```
DROP 01 — ORIGIN ⭐
schweres fleece. cleaner schnitt. der stern auf der brust.
limitiert. wenn weg, dann weg. link in bio.

#weax #drop01 #streetwear #streetweardeutschland #pullover #fitcheck #newbrand #outfitinspo
```

## Neu rendern

Benötigt Python 3 mit `numpy` + `Pillow` und `ffmpeg`.

```bash
python3 render_reels.py            # beide Videos
python3 render_reels.py --only hook
```

Texte, Reihenfolge und Szenenlängen (in Beats) stehen in `hook_scenes()` und `drop_scenes()` in `render_reels.py`.
