#!/usr/bin/env python3
"""
WEAX – Instagram Reels Renderer (Drop 01)

Rendert zwei 9:16-Reels (1080x1920, 30 fps) im WEAX-Look (Chrome auf Schwarz, Stern-Logo):
  01_hook.mp4  – Aufmerksamkeits-Teaser (Hook in der ersten Sekunde, loopbar)
  02_drop.mp4  – Drop-Reveal mit Klamotten + Logo + CTA

Alle Schnitte liegen auf dem Beat. Ohne Song wird ein fester BPM-Raster benutzt;
mit --audio wird das Tempo aus dem Song geschätzt und der Song direkt eingebettet.

Beispiele:
  python3 render_reels.py
  python3 render_reels.py --audio shottas.mp3 --start 0:31
  python3 render_reels.py --audio shottas.mp3 --start 0:31 --photos fotos/
  python3 render_reels.py --bpm 142 --offset 0.12
"""
import argparse
import math
import multiprocessing as mp
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
BG = (5, 5, 7)
CINZEL = os.path.join(HERE, "..", "shopify", "assets", "Cinzel.woff2")
BLACK_FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
BOLD_FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
MED_FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"

rng = random.Random(25)
_font_cache = {}


def font(path, size):
    key = (path, size)
    if key not in _font_cache:
        try:
            _font_cache[key] = ImageFont.truetype(path, size)
        except OSError:
            _font_cache[key] = ImageFont.truetype(BOLD_FONT, size)
    return _font_cache[key]


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ease_out_back(x):
    x = min(max(x, 0.0), 1.0)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


# ---------------------------------------------------------------- Grundbausteine

def make_background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.38) / H) ** 2)
    glow = np.clip(1 - d * 1.9, 0, 1) ** 2 * 22
    img = np.zeros((H, W, 3), np.float32)
    img[..., 0] = BG[0] + glow * 0.95
    img[..., 1] = BG[1] + glow * 0.98
    img[..., 2] = BG[2] + glow * 1.05
    return img


BACKGROUND = make_background()
STARS = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0.6, 2.2), rng.uniform(0, 6.28)) for _ in range(170)]
_yy, _xx = np.ogrid[0:H, 0:W]
VIGNETTE = np.clip(1 - 0.55 * (((_xx - W / 2) / (W * 0.75)) ** 2 + ((_yy - H / 2) / (H * 0.75)) ** 2),
                   0.35, 1).astype(np.float32)[..., None]
GRAIN = [np.random.default_rng(i).normal(0, 7, (H // 2, W // 2)).astype(np.float32) for i in range(6)]


_grad_cache = {}


def chrome_full(shift):
    """Gecachte Vollbild-Variante (Shift in 96 Stufen gerastert)."""
    k = int((shift % 1.0) * 96)
    if k not in _grad_cache:
        _grad_cache[k] = chrome_gradient(W, H, k / 96)
    return _grad_cache[k]


def soft(mask, radius):
    """Schneller Weichzeichner: auf 1/4 Größe blurren und wieder hochskalieren."""
    small = mask.resize((W // 4, H // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(radius / 4))
    return small.resize((W, H), Image.BILINEAR)


def chrome_gradient(w, h, shift):
    """Diagonaler Chrome-Verlauf wie auf der Website (#6f757d → #fff → #9aa0a8 → #fff → #7b8189)."""
    stops = [(0, (111, 117, 125)), (.25, (255, 255, 255)), (.45, (154, 160, 168)),
             (.6, (255, 255, 255)), (1, (123, 129, 137))]
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    p = ((xs * 0.8 + ys * 0.35) / 1.15 * 0.4 + shift) % 1.0
    out = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        out[..., c] = np.interp(p, [s[0] for s in stops], [s[1][c] for s in stops])
    return out


def star_points(cx, cy, r, rot=0.0, inner=0.15):
    """Der WEAX-Stern (4 Zacken) – gleiche Form wie das SVG im Shop."""
    pts = []
    for i in range(8):
        a = rot + i * math.pi / 4 - math.pi / 2
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


class Frame:
    """Ein Frame als float-Array mit Helfern zum Compositen."""

    def __init__(self, t, stars=1.0, bg=1.0):
        self.a = BACKGROUND * bg
        self.t = t
        if stars > 0:
            self.stars(stars)

    def stars(self, amount):
        mask = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(mask)
        for x, y, s, ph in STARS:
            tw = 0.45 + 0.55 * math.sin(self.t * 2.3 + ph) ** 2
            v = int(255 * tw * amount * (s / 2.2))
            d.ellipse((x - s, y - s, x + s, y + s), fill=v)
        self.add_mask(mask, (235, 240, 255), 1.0)

    def add_mask(self, mask, color, alpha=1.0):
        m = np.asarray(mask, np.float32)[..., None] / 255 * alpha
        self.a = self.a * (1 - m) + np.array(color, np.float32) * m

    def add_light(self, mask, color, strength):
        m = np.asarray(mask, np.float32)[..., None] / 255 * strength
        self.a = self.a + np.array(color, np.float32) * m

    def paint(self, mask, tex, alpha=1.0):
        m = np.asarray(mask, np.float32)[..., None] / 255 * alpha
        self.a = self.a * (1 - m) + tex * m

    def chrome(self, mask, shift, alpha=1.0, glow=0.45):
        if glow > 0:
            self.add_light(soft(mask, 28), (220, 228, 240), glow * alpha)
        self.paint(mask, chrome_full(shift), alpha)

    def flash(self, amount):
        if amount > 0:
            self.a = self.a + (255 - self.a) * min(amount, 1)

    def fade(self, amount):
        self.a = self.a * (1 - min(max(amount, 0), 1))

    def paste(self, img, alpha=1.0):
        arr = np.asarray(img.convert("RGB"), np.float32)
        if img.mode == "RGBA":
            m = np.asarray(img.split()[3], np.float32)[..., None] / 255 * alpha
        else:
            m = alpha
        self.a = self.a * (1 - m) + arr * m

    def zoom(self, s, cx=W / 2, cy=H / 2):
        if abs(s - 1) < 1e-3:
            return
        img = Image.fromarray(np.clip(self.a, 0, 255).astype(np.uint8))
        nw, nh = int(W * s), int(H * s)
        img = img.resize((nw, nh), Image.BILINEAR)
        left, top = int(cx * s - cx), int(cy * s - cy)
        if s > 1:
            img = img.crop((left, top, left + W, top + H))
            self.a = np.asarray(img, np.float32)
        else:
            canvas = Image.new("RGB", (W, H), BG)
            canvas.paste(img, (-left, -top))
            self.a = np.asarray(canvas, np.float32)

    def shake(self, amount, seed):
        if amount <= 0:
            return
        r = random.Random(seed)
        dx, dy = int(r.uniform(-1, 1) * amount), int(r.uniform(-1, 1) * amount)
        self.a = np.roll(self.a, (dy, dx), axis=(0, 1))

    def glitch(self, amount, seed):
        if amount <= 0:
            return
        r = random.Random(seed)
        off = int(18 * amount)
        self.a[..., 0] = np.roll(self.a[..., 0], off, axis=1)
        self.a[..., 2] = np.roll(self.a[..., 2], -off, axis=1)
        for _ in range(int(7 * amount)):
            y = r.randint(0, H - 60)
            h = r.randint(8, 70)
            self.a[y:y + h] = np.roll(self.a[y:y + h], r.randint(-90, 90), axis=1)

    def finish(self, idx):
        g = GRAIN[idx % len(GRAIN)]
        g = np.repeat(np.repeat(g, 2, 0), 2, 1)[..., None]
        out = (self.a + g) * VIGNETTE
        np.clip(out, 0, 255, out=out)
        return out.astype(np.uint8)


def text_mask(lines, fnt, y_center, spacing=1.0, tracking=0, scale=1.0, x_center=W / 2):
    """Zentrierter, mehrzeiliger Text als Maske (mit Laufweite in px)."""
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    asc, desc = fnt.getmetrics()
    lh = (asc + desc) * spacing
    total = lh * len(lines)
    y = y_center - total / 2
    for line in lines:
        widths = [fnt.getlength(ch) for ch in line]
        tw = sum(widths) + tracking * (len(line) - 1)
        x = x_center - tw / 2
        for ch, cw in zip(line, widths):
            d.text((x, y), ch, font=fnt, fill=255)
            x += cw + tracking
        y += lh
    if scale != 1.0:
        mask = mask.resize((int(W * scale), int(H * scale)), Image.BILINEAR)
        l, t = int((W * scale - W) / 2), int((y_center * scale - y_center))
        if scale > 1:
            mask = mask.crop((l, t, l + W, t + H))
        else:
            c = Image.new("L", (W, H), 0)
            c.paste(mask, (-l, -t))
            mask = c
    return mask


def star_mask(cx, cy, r, rot=0.0):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(star_points(cx, cy, r, rot), fill=255)
    return m


# ---------------------------------------------------------------- Pullover-Mockup

def draw_pullover(size=900):
    """Gezeichneter Crewneck mit WEAX-Stern – Platzhalter, bis echte Fotos da sind (--photos)."""
    S = size / 1000
    left = [(500, 150), (430, 140), (370, 158), (250, 205), (175, 330), (110, 560), (78, 760),
            (195, 785), (240, 610), (285, 470), (290, 640), (288, 905), (500, 915)]
    pts = [(x * S, y * S) for x, y in left] + [((1000 - x) * S, y * S) for x, y in reversed(left)]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))

    # Stoff: dunkles Anthrazit, Licht von oben, weiche Falten, feine Struktur
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    base = 26 + 26 * np.clip(1 - np.sqrt((xx - 0.45) ** 2 + (yy - 0.3) ** 2) * 1.6, 0, 1)
    folds = 5 * np.sin(xx * 40 + yy * 6) * np.exp(-((yy - 0.75) ** 2) * 20)
    folds += 7 * np.sin(yy * 22 + xx * 3) * np.exp(-((xx - 0.17) ** 2) * 60)
    folds += 7 * np.sin(yy * 22 - xx * 3) * np.exp(-((xx - 0.83) ** 2) * 60)
    texture = np.random.default_rng(3).normal(0, 2.5, (size, size))
    fabric = base + folds + texture
    tex = np.stack([fabric, fabric * 1.01, fabric * 1.07], -1)
    img = Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8))

    d = ImageDraw.Draw(img)
    rib = (16, 16, 19)
    # Kragen
    d.ellipse((395 * S, 118 * S, 605 * S, 200 * S), outline=rib, width=int(26 * S))
    d.ellipse((418 * S, 132 * S, 582 * S, 186 * S), fill=(8, 8, 10))
    # Bündchen + Saum
    for y in range(int(850 * S), int(908 * S), 7):
        d.line((292 * S, y, 708 * S, y), fill=rib, width=2)
    for k in (-1, 1):
        for i in range(6):
            o = i * 7 * S
            if k < 0:
                d.line((86 * S + o * 0.3, 735 * S + o, 200 * S + o * 0.3, 760 * S + o), fill=rib, width=2)
            else:
                d.line((914 * S - o * 0.3, 735 * S + o, 800 * S - o * 0.3, 760 * S + o), fill=rib, width=2)
    # Nähte an den Schultern
    d.line((370 * S, 160 * S, 285 * S, 470 * S), fill=(18, 18, 21), width=2)
    d.line((630 * S, 160 * S, 715 * S, 470 * S), fill=(18, 18, 21), width=2)

    rgba = img.convert("RGBA")
    rgba.putalpha(mask)

    # Chrome-Stern auf der Brust
    star = Image.new("L", (size, size), 0)
    ImageDraw.Draw(star).polygon(star_points(500 * S, 330 * S, 62 * S), fill=255)
    chrome = Image.fromarray(chrome_gradient(size, size, 0.1).astype(np.uint8))
    rgba.paste(chrome, (0, 0), star)
    rim = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(9))).filter(ImageFilter.GaussianBlur(4))
    return rgba, (500 * S, 330 * S), rim


def pullover_on_frame(fr, pull, scale, cy, sweep, center_star, shift):
    p, (sx, sy), rim = pull
    w = int(p.width * scale)
    img = p.resize((w, w), Image.BILINEAR)
    x, y = int(W / 2 - w / 2), int(cy - w / 2)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(img, (x, y), img)
    alpha = layer.split()[3]
    # Rim-Light
    edge = Image.new("L", (W, H), 0)
    edge.paste(rim.resize((w, w), Image.BILINEAR), (x, y))
    fr.add_light(soft(alpha, 60), (200, 210, 230), 0.12)
    fr.paste(layer)
    fr.add_light(edge, (210, 220, 240), 0.35)
    # Lichtstreifen über den Stoff
    if sweep is not None:
        band = Image.new("L", (W, H), 0)
        bx = -400 + sweep * (W + 800)
        ImageDraw.Draw(band).polygon([(bx, 0), (bx + 160, 0), (bx - 340, H), (bx - 500, H)], fill=255)
        band = ImageChops.multiply(soft(band, 50), alpha)
        fr.add_light(band, (255, 255, 255), 0.22)
    # Glanzpunkt auf dem Stern
    gx, gy = x + sx * scale, y + sy * scale
    if center_star > 0:
        fr.add_light(star_mask(gx, gy, 120 * scale * center_star, math.pi / 4).filter(ImageFilter.GaussianBlur(6)),
                     (255, 255, 255), 0.9 * center_star)
    return gx, gy


def photo_on_frame(fr, path, prog, zoom_from=1.15, zoom_to=1.0):
    img = Image.open(path).convert("RGB")
    s = max(W / img.width, H / img.height) * (zoom_from + (zoom_to - zoom_from) * ease_out(prog))
    img = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
    l, t = (img.width - W) // 2, (img.height - H) // 2
    arr = np.asarray(img.crop((l, t, l + W, t + H)), np.float32)
    # Look angleichen: entsättigt, kühl, dunkel
    lum = arr.mean(-1, keepdims=True)
    arr = lum * 0.75 + arr * 0.25
    arr = arr * np.array([0.92, 0.95, 1.02]) * 0.9
    fr.a = arr


# ---------------------------------------------------------------- Szenen

class Ctx:
    def __init__(self, beat, photos):
        self.beat = beat
        self.photos = photos
        self.pull = draw_pullover()


def on_beat_pulse(t, beat, decay=0.18):
    """1.0 direkt auf dem Beat, fällt danach schnell ab."""
    ph = (t % beat) / beat
    return math.exp(-ph * beat / decay * 1.0)


# --- Video 1: Hook

def hook_scenes(c):
    b = c.beat
    big = font(BLACK_FONT, 150)
    mid = font(BLACK_FONT, 96)
    small = font(MED_FONT, 40)
    cin = font(CINZEL, 230)
    cin_s = font(CINZEL, 120)

    def s1(fr, t, d, i):  # Hook – sofort Text, harter Look
        fr.a *= 0.35
        m = text_mask(["DU KENNST", "UNS NICHT."], big, H * 0.46, 1.0, 2, 1.0 + 0.06 * (1 - ease_out(t / d)))
        fr.add_mask(m, (245, 247, 250))
        fr.flash(0.9 * on_beat_pulse(t, b, 0.06) if t < 0.04 else 0)
        fr.shake(14 * on_beat_pulse(t, b), i)
        fr.glitch(0.9 * on_beat_pulse(t, b, 0.1), i)

    def s2(fr, t, d, i):
        fr.a *= 0.35
        m = text_mask(["NOCH."], font(BLACK_FONT, 260), H * 0.47, 1.0, 4, 1.25 - 0.25 * ease_out_back(t / (b * 0.5)))
        fr.chrome(m, 0.2 + t * 0.4)
        fr.shake(20 * on_beat_pulse(t, b), i + 3)
        fr.glitch(0.6 * on_beat_pulse(t, b, 0.08), i + 1)

    def s3(fr, t, d, i):  # Strobe-Sterne
        n = int(t / (b / 4))
        r = random.Random(n)
        fr.a *= 0.2
        for _ in range(3):
            fr.chrome(star_mask(r.uniform(200, W - 200), r.uniform(400, H - 500), r.uniform(80, 240), r.uniform(0, 1)),
                      r.random(), 1.0, 0.8)
        if n % 2 == 0:
            fr.flash(0.55)

    def s4(fr, t, d, i):  # Logo baut sich auf
        p = ease_out_back(t / (b * 1.5))
        rot = (1 - ease_out(t / (b * 2))) * math.pi * 1.5
        fr.chrome(star_mask(W / 2, H * 0.43, 330 * p, rot), 0.1 + t * 0.25, 1.0, 0.8)
        fr.flash(0.8 * on_beat_pulse(t, b, 0.06))
        fr.zoom(1 + 0.04 * on_beat_pulse(t, b))

    def s5(fr, t, d, i):  # WEAX slam, Buchstabe für Buchstabe auf Halbbeats
        fr.chrome(star_mask(W / 2, H * 0.32, 170, 0), 0.1 + t * 0.25, 0.9, 0.5)
        shown = min(4, int(t / (b / 2)) + 1)
        word = "WEAX"[:shown]
        m = text_mask([word.ljust(4).replace(" ", " ")], cin, H * 0.56, 1, 24)
        fr.chrome(m, 0.3 + t * 0.3, 1.0, 0.6)
        fr.shake(16 * on_beat_pulse(t, b / 2), i)
        fr.zoom(1 + 0.05 * on_beat_pulse(t, b / 2))

    def s6(fr, t, d, i):  # Drop-Ansage
        fr.chrome(star_mask(W / 2, H * 0.28, 130, 0), 0.1 + t * 0.25, 0.8, 0.4)
        fr.chrome(text_mask(["WEAX"], cin_s, H * 0.39, 1, 16), 0.3 + t * 0.3, 1.0, 0.3)
        a = ease_out(t / (b * 0.5))
        fr.add_mask(text_mask(["DROP 01"], mid, H * 0.52, 1, 8, 1.15 - 0.15 * a), (245, 247, 250), a)
        if t > b * 1.5:
            a2 = ease_out((t - b * 1.5) / (b * 0.5))
            fr.add_mask(text_mask(["KOMMT BALD."], font(BLACK_FONT, 70), H * 0.6, 1, 6), (200, 205, 212), a2)
        if t > b * 2.5:
            a3 = ease_out((t - b * 2.5) / (b * 0.5))
            fr.add_mask(text_mask(["folg uns, sonst verpasst du's."], small, H * 0.67, 1, 1), (150, 155, 165), a3)
        fr.zoom(1 + 0.03 * on_beat_pulse(t, b))

    def s7(fr, t, d, i):  # Übergang zurück zum Anfang (Loop)
        s6(fr, t + b * 4, d, i)
        fr.glitch(ease_out(t / d), i)
        fr.fade(ease_out(t / d) * 0.8)

    return [(s1, 2), (s2, 2), (s3, 1), (s4, 3), (s5, 2.5), (s6, 5), (s7, 0.5)]


# --- Video 2: Drop-Reveal

def drop_scenes(c):
    b = c.beat
    huge = font(BLACK_FONT, 210)
    label = font(BLACK_FONT, 78)
    small = font(MED_FONT, 40)
    cin = font(CINZEL, 190)
    cin_s = font(CINZEL, 110)
    details = [("SCHWERES", "FLEECE", (0.5, 0.62), 2.3),
               ("CLEANER", "SCHNITT", (0.2, 0.62), 1.8),
               ("WEAX-STERN", "AUF DER BRUST", (0.5, 0.33), 3.2)]

    def s1(fr, t, d, i):
        fr.a *= 0.3
        fr.add_mask(text_mask(["DROP"], huge, H * 0.42, 1, 6, 1.2 - 0.2 * ease_out_back(t / (b * 0.4))), (245, 247, 250))
        if t > b:
            fr.chrome(text_mask(["01"], font(BLACK_FONT, 300), H * 0.56, 1, 10,
                                1.3 - 0.3 * ease_out_back((t - b) / (b * 0.4))), 0.2 + t * 0.4)
        fr.flash(0.9 * on_beat_pulse(t, b, 0.05))
        fr.shake(18 * on_beat_pulse(t, b), i)
        fr.glitch(0.7 * on_beat_pulse(t, b, 0.08), i)

    def s2(fr, t, d, i):
        fr.chrome(star_mask(W / 2, H * 0.36, 150 + 20 * on_beat_pulse(t, b), t * 0.4), 0.1 + t * 0.3, 1.0, 0.7)
        a = ease_out(t / (b * 0.6))
        fr.chrome(text_mask(["ORIGIN"], cin, H * 0.52, 1, 22, 1.1 - 0.1 * a), 0.25 + t * 0.35, a, 0.5)
        fr.add_mask(text_mask(["DAS STÜCK, MIT DEM ALLES ANFÄNGT."], small, H * 0.6, 1, 3), (150, 155, 165),
                    ease_out((t - b) / b))
        fr.zoom(1 + 0.03 * on_beat_pulse(t, b))

    def s3(fr, t, d, i):  # Klamotten-Reveal
        prog = t / d
        if c.photos:
            photo_on_frame(fr, c.photos[0], prog)
        else:
            reveal = ease_out(t / (b * 2))
            fr.a *= 0.6 + 0.4 * reveal
            pullover_on_frame(fr, c.pull, 0.98 + 0.08 * prog, H * 0.47, (t / (b * 3)) % 1.4,
                              on_beat_pulse(t, b * 2, 0.25) if t > b * 2 else 0, t)
            fr.a = BACKGROUND + (fr.a - BACKGROUND) * reveal
        fr.flash(0.9 * (1 - ease_out(t / (b * 0.3))))
        fr.zoom(1 + 0.025 * on_beat_pulse(t, b))

    def detail(n):
        top, bottom, (fx, fy), zoom = details[n]

        def s(fr, t, d, i):
            if c.photos:
                photo_on_frame(fr, c.photos[(n + 1) % len(c.photos)], t / d, 1.35, 1.2)
            else:
                pullover_on_frame(fr, c.pull, 0.98, H * 0.47, 0.4 + t / d * 0.6, 0.6 if n == 2 else 0, t)
                p = c.pull[0].width * 0.98
                cx = W / 2 - p / 2 + fx * p
                cy = H * 0.47 - p / 2 + fy * p
                fr.zoom(zoom * (1 + 0.06 * t / d), cx, cy)
            fr.a *= 0.75
            fr.add_mask(text_mask([top], label, H * 0.74, 1, 6), (245, 247, 250))
            fr.chrome(text_mask([bottom], label, H * 0.79, 1, 6), 0.2 + t * 0.4, 1, 0.3)
            fr.flash(0.6 * (1 - ease_out(t / (b * 0.2))))
            fr.shake(10 * on_beat_pulse(t, b), i)
            fr.glitch(0.4 * on_beat_pulse(t, b, 0.06), i)
        return s

    def s5(fr, t, d, i):  # Logo + Klamotte zusammen
        fr.chrome(star_mask(W / 2, H * 0.4, 520, t * 0.15), 0.1 + t * 0.2, 0.18, 0.2)
        if c.photos:
            photo_on_frame(fr, c.photos[-1], t / d, 1.1, 1.0)
            fr.a *= 0.65
        else:
            pullover_on_frame(fr, c.pull, 0.86, H * 0.43, (t / (b * 3)) % 1.4, on_beat_pulse(t, b * 2, 0.3), t)
        fr.chrome(text_mask(["WEAX"], cin, H * 0.73, 1, 26), 0.25 + t * 0.35, 1.0, 0.7)
        fr.add_mask(text_mask(["DROP 01 — ORIGIN"], small, H * 0.79, 1, 8), (170, 175, 185), ease_out(t / b))
        fr.zoom(1 + 0.03 * on_beat_pulse(t, b))

    def s6(fr, t, d, i):  # CTA
        fr.chrome(star_mask(W / 2, H * 0.27, 120, 0), 0.1 + t * 0.3, 0.9, 0.5)
        fr.chrome(text_mask(["WEAX"], cin_s, H * 0.37, 1, 16), 0.2 + t * 0.3, 1.0, 0.3)
        fr.add_mask(text_mask(["DROP 01", "IST LIVE."], font(BLACK_FONT, 120), H * 0.5, 1.0, 4), (245, 247, 250),
                    ease_out(t / (b * 0.5)))
        # Chrome-Button
        a = ease_out((t - b) / (b * 0.6))
        if a > 0:
            btn = Image.new("L", (W, H), 0)
            bw, bh, by = 620, 130, H * 0.63
            ImageDraw.Draw(btn).rounded_rectangle((W / 2 - bw / 2, by - bh / 2, W / 2 + bw / 2, by + bh / 2), 65, fill=255)
            fr.chrome(btn, 0.15 + t * 0.4, a, 0.8 * on_beat_pulse(t, b, 0.3))
            fr.add_mask(text_mask(["LINK IN BIO →"], font(BLACK_FONT, 56), by + 2, 1, 4), (11, 11, 13), a)
        fr.add_mask(text_mask(["limitiert. wenn weg, dann weg."], small, H * 0.71, 1, 1), (150, 155, 165),
                    ease_out((t - b * 2) / b))
        fr.zoom(1 + 0.025 * on_beat_pulse(t, b))

    def s7(fr, t, d, i):
        s6(fr, t + b * 4, d, i)
        fr.glitch(ease_out(t / d), i)
        fr.fade(ease_out(t / d) * 0.8)

    return [(s1, 2), (s2, 3), (s3, 5), (detail(0), 1.5), (detail(1), 1.5), (detail(2), 2),
            (s5, 4), (s6, 5), (s7, 0.5)]


# ---------------------------------------------------------------- Audio / Tempo

def parse_time(s):
    if ":" in str(s):
        m, sec = str(s).split(":")
        return int(m) * 60 + float(sec)
    return float(s)


def detect_beat(audio, start, length=30.0):
    """Schätzt BPM + Phase des ersten Beats per Onset-Hüllkurve und Autokorrelation."""
    sr = 22050
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(length), "-i", audio,
                          "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    hop = 512
    n = len(x) // hop
    frames = x[:n * hop].reshape(n, hop)
    spec = np.abs(np.fft.rfft(frames * np.hanning(hop), axis=1))
    diff = np.maximum(np.diff(np.log1p(spec), axis=0), 0)
    flux = diff.sum(1)
    flux = flux - flux.mean()
    kick = np.maximum(np.diff(spec[:, 1:6], axis=0), 0).sum(1)  # ~40–250 Hz: Kick/808 bestimmt die Phase
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    fps = sr / hop
    lags = np.arange(len(ac)) / fps
    valid = (lags > 60 / 180) & (lags < 60 / 70)
    lag = int(np.argmax(np.where(valid, ac, -np.inf)))
    # Oktavfehler vermeiden: wenn der halbe Abstand fast genauso stark ist, den nehmen
    if lags[lag // 2] > 60 / 180 and ac[lag // 2] > 0.6 * ac[lag]:
        lag //= 2
    # Feinabstimmung: Peak bei Vielfachen des Abstands mitteln → Tempo auf Bruchteile eines Frames genau
    period = float(lag)
    for mult in (4, 8, 16):
        guess = int(round(period * mult))
        lo, hi = guess - 3, guess + 4
        if hi >= len(ac):
            break
        k = lo + int(np.argmax(ac[lo:hi]))
        if 0 < k < len(ac) - 1:
            a0, a1, a2 = ac[k - 1], ac[k], ac[k + 1]
            den = a0 - 2 * a1 + a2
            k = k + (0.5 * (a0 - a2) / den if den != 0 else 0)
        period = k / mult
    beat = period / fps
    # Phase: Offset, dessen Beat-Raster die meiste Kick-Energie trifft
    best, phase = -1.0, 0.0
    for k in range(int(math.ceil(period))):
        idx = np.round(k + np.arange(0, (len(kick) - k) / period) * period).astype(int)
        sc = kick[idx[idx < len(kick)]].sum()
        if sc > best:
            best, phase = sc, (k + 1) / fps
    return beat, phase


# ---------------------------------------------------------------- Rendern

_JOB = None


def _render_frame(i):
    scenes, beat, offset = _JOB
    t = i / FPS
    fr = Frame(t)
    if t < offset:
        scenes[0][0](fr, 0, scenes[0][1] * beat, i)
        fr.fade(1 - t / max(offset, 1e-6))
    else:
        acc = offset
        for k, (fn, d) in enumerate(scenes):
            end = acc + d * beat
            if t < end or k == len(scenes) - 1:
                fn(fr, t - acc, end - acc, i)
                break
            acc = end
    return fr.finish(i).tobytes()


def render(name, scenes, beat, offset, audio, start, out_dir):
    path = os.path.join(out_dir, name)
    total_beats = sum(d for _, d in scenes)
    dur = offset + total_beats * beat
    nframes = int(round(dur * FPS))
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-"]
    if audio:
        cmd += ["-ss", str(start), "-t", f"{dur:.3f}", "-i", audio, "-af", f"afade=t=out:st={dur - 0.4:.3f}:d=0.4",
                "-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    global _JOB
    _JOB = (scenes, beat, offset)
    with mp.get_context("fork").Pool() as pool:
        for i, frame in enumerate(pool.imap(_render_frame, range(nframes), chunksize=2)):
            proc.stdin.write(frame)
            if i % 30 == 0:
                print(f"\r{name}: {i}/{nframes}", end="", flush=True)
    proc.stdin.close()
    proc.wait()
    print(f"\r{name}: fertig ({dur:.1f}s)          ")
    return path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audio", help="Song-Datei (z. B. shottas.mp3) – wird eingebettet und für den Beat analysiert")
    ap.add_argument("--start", default="0", help="Startpunkt im Song, z. B. 0:31 (am besten direkt der Drop)")
    ap.add_argument("--start2", help="Eigener Startpunkt für Video 2 (Standard: wie --start)")
    ap.add_argument("--bpm", type=float, help="Tempo erzwingen (sonst aus Song geschätzt bzw. 140)")
    ap.add_argument("--offset", type=float, help="Sekunden bis zum ersten Beat")
    ap.add_argument("--photos", help="Ordner mit echten Klamotten-Fotos (jpg/png), ersetzt das Mockup")
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--only", choices=["hook", "drop"])
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    start = parse_time(args.start)
    start2 = parse_time(args.start2) if args.start2 else start

    beat, offset = 60 / 140, 0.0
    if args.audio:
        beat, offset = detect_beat(args.audio, start)
        print(f"Erkannt: {60 / beat:.1f} BPM, erster Beat nach {offset:.2f}s")
    if args.bpm:
        beat = 60 / args.bpm
    if args.offset is not None:
        offset = args.offset
    # Halftime bei schnellen Songs: Szenen nicht zu hektisch
    if beat < 0.36:
        beat *= 2

    photos = []
    if args.photos:
        photos = sorted(os.path.join(args.photos, f) for f in os.listdir(args.photos)
                        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    ctx = Ctx(beat, photos)

    if args.only != "drop":
        render("01_hook.mp4", hook_scenes(ctx), beat, offset, args.audio, start, args.out)
    if args.only != "hook":
        if args.audio and args.start2:
            b2, offset = detect_beat(args.audio, start2)
            if not args.bpm:
                ctx.beat = beat = b2 * 2 if b2 < 0.36 else b2
        render("02_drop.mp4", drop_scenes(ctx), beat, offset, args.audio, start2, args.out)


if __name__ == "__main__":
    sys.exit(main())
