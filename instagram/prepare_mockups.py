#!/usr/bin/env python3
"""
Stellt die Tracksuit-Mockups frei (weißer Hintergrund → transparent) und schneidet das W-Orbit-Logo aus.

  python3 prepare_mockups.py weax_mockups_tracksuit.pdf

Ergebnis in mockups/: hoodie_front.png, hoodie_back.png, pants_front.png, pants_back.png, logo.png
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "mockups")
NAMES = ["hoodie_front", "hoodie_back", "pants_front", "pants_back"]


def cutout(img):
    rgb = img.convert("RGB")
    lum = np.asarray(rgb.convert("L"), np.float32)
    # Hintergrund = alles Helle, das mit dem Bildrand verbunden ist (weiße Paspeln innen bleiben erhalten)
    bright = Image.fromarray(((lum > 200) * 255).astype(np.uint8))
    pad = Image.new("L", (bright.width + 4, bright.height + 4), 255)
    pad.paste(bright, (2, 2))
    ImageDraw.floodfill(pad, (0, 0), 128)
    bg = (np.asarray(pad)[2:-2, 2:-2] == 128)

    alpha = Image.fromarray(((~bg) * 255).astype(np.uint8))
    # Löcher (z. B. einzelne helle Pixel am Rand) schließen, Kante 1 px nach innen, weich auslaufen
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5))
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.1))

    # Weißen Saum an der Kante entfernen: im Kantenbereich Farbe Richtung Stoffschwarz ziehen
    a = np.asarray(alpha, np.float32) / 255
    edge = (a > 0.02) & (a < 0.98)
    edge_band = np.asarray(Image.fromarray((edge * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    arr = np.asarray(rgb, np.float32).copy()
    fabric = np.median(arr[(a > 0.99) & (lum < 80)], axis=0)
    halo = edge_band & (lum > 90)
    arr[halo] = fabric

    out = Image.fromarray(arr.clip(0, 255).astype(np.uint8)).convert("RGBA")
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def extract_logo(hoodie_front):
    """W-Orbit-Logo von der Hoodie-Brust als weiche, hochskalierte Maske."""
    w, h = hoodie_front.size
    lum = np.asarray(hoodie_front.convert("L"), np.float32)
    # Logo sitzt auf der linken Brust (vom Träger aus) – im Bild rechts oben
    region = lum[int(h * 0.22):int(h * 0.40), int(w * 0.47):int(w * 0.68)]
    ys, xs = np.where(region > 150)
    l, t = max(xs.min() - 6, 0), max(ys.min() - 6, 0)
    r, b = xs.max() + 7, ys.max() + 7
    box = region
    crop = Image.fromarray(box[t:b, l:r].astype(np.uint8))
    scale = 8
    big = crop.resize((crop.width * scale, crop.height * scale), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    arr = np.asarray(big, np.float32)
    mask = np.clip((arr - 95) / 60, 0, 1) * 255
    m = Image.fromarray(mask.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))
    return m.crop(m.getbbox())


def main():
    pdf = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdfimages", "-j", pdf, os.path.join(tmp, "img")], check=True)
        imgs = sorted(f for f in os.listdir(tmp) if f.endswith(".jpg"))
        big = [Image.open(os.path.join(tmp, f)) for f in imgs]
        big = [im for im in big if im.width >= 800]
        for name, im in zip(NAMES, big):
            im.load()
            cutout(im).save(os.path.join(OUT, name + ".png"))
            print("✓", name)
        extract_logo(big[0].convert("RGB")).save(os.path.join(OUT, "logo.png"))
        print("✓ logo")


if __name__ == "__main__":
    main()
