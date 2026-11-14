# Erzeugt die Druckdateien (SVG) und Mockups für ABIversum 2027.
# Namen für die Rückseite: namen.txt (ein Name pro Zeile) – danach neu bauen.
import math, pathlib, html
D = pathlib.Path(__file__).parent
OUT = D / "svg"; OUT.mkdir(exist_ok=True)
PINK, LILA, CYAN, WHITE, NAVY = "#ff3d9a", "#8b5cf6", "#22d3ee", "#ffffff", "#1b1640"
FONT = "font-family=\"'Inter Display','Inter',Arial,sans-serif\""

def spark(x, y, s, c):
    return f'<path transform="translate({x} {y})" d="M0,{-s} Q0,0 {s},0 Q0,0 0,{s} Q0,0 {-s},0 Q0,0 0,{-s}Z" fill="{c}"/>'

def planet(cap=WHITE, body=LILA, band=PINK, ring=CYAN, tassel=PINK, uid="p"):
    """Planet mit Abi-Hut, Mittelpunkt 0,0, Planet-Radius 110 (Gesamthöhe ca. 300)."""
    return f'''<g>
  <defs><clipPath id="{uid}c"><circle r="110"/></clipPath></defs>
  <g transform="rotate(-18)"><path d="M-175,0 A175,48 0 0 1 175,0" fill="none" stroke="{ring}" stroke-width="16" stroke-linecap="round"/></g>
  <circle r="110" fill="{body}"/>
  <g clip-path="url(#{uid}c)" transform="rotate(-18)">
    <rect x="-130" y="-62" width="260" height="20" fill="{band}"/>
    <rect x="-130" y="8" width="260" height="34" fill="{band}"/>
    <rect x="-130" y="64" width="260" height="12" fill="{band}"/>
  </g>
  <g transform="rotate(-18)"><path d="M-175,0 A175,48 0 0 0 175,0" fill="none" stroke="{ring}" stroke-width="16" stroke-linecap="round"/></g>
  <g transform="translate(6 -118) rotate(-10)">
    <path d="M-52,-14 L52,-14 L46,22 Q0,36 -46,22 Z" fill="{cap}"/>
    <path d="M0,-62 L104,-26 L0,10 L-104,-26 Z" fill="{cap}"/>
    <path d="M0,-26 L78,-10 L78,40" fill="none" stroke="{tassel}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="70" y="36" width="16" height="30" rx="5" fill="{tassel}"/>
    <circle cy="-26" r="9" fill="{tassel}"/>
  </g>
</g>'''

def wrap(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{b}{body}</svg>'

# ---------- 1) Pulli Brust (links), 10 x 10 cm ----------
def chest(c_text=WHITE):
    return f'''<g transform="translate(500 400) scale(1.05)">{planet(uid="ch")}</g>
<text x="500" y="820" text-anchor="middle" {FONT} font-weight="900" font-size="150" fill="{c_text}" letter-spacing="-4">ABIversum</text>
<text x="500" y="940" text-anchor="middle" {FONT} font-weight="800" font-size="78" fill="{PINK}" letter-spacing="40">2027</text>'''

# ---------- 2) Pulli Rücken, 30 x 40 cm ----------
def back(names, c_text=WHITE):
    stars = "".join(spark(x, y, s, c) for x, y, s, c in [(380,330,46,CYAN),(2620,420,60,PINK),(2400,180,30,WHITE),(600,760,26,WHITE),(2700,900,34,CYAN),(260,1100,40,PINK)])
    cols, n = 4, len(names)
    rows = math.ceil(n / cols)
    col_w, row_h = 620, 92 if rows <= 16 else int(1480 / rows)
    fs = min(70, int(row_h * .78))
    grid = []
    for i, name in enumerate(names):
        c, r = i // rows, i % rows
        x = 1500 + (c - (cols - 1) / 2) * col_w
        y = 2330 + r * row_h
        grid.append(f'<text x="{x:.0f}" y="{y}" text-anchor="middle" {FONT} font-weight="600" font-size="{fs}" fill="{c_text}">{html.escape(name)}</text>')
    last_y = 2330 + (rows - 1) * row_h
    return f'''{stars}
<g transform="translate(1500 640) scale(2.1)">{planet(uid="bk")}</g>
<text x="1500" y="1440" text-anchor="middle" {FONT} font-weight="900" font-size="470" fill="{c_text}" letter-spacing="-14">ABIversum</text>
<text x="1500" y="1760" text-anchor="middle" {FONT} font-weight="900" font-size="300" fill="none" stroke="{CYAN}" stroke-width="12" letter-spacing="80">2027</text>
<text x="1500" y="1960" text-anchor="middle" {FONT} font-weight="700" font-size="84" fill="{PINK}" letter-spacing="10">12 JAHRE IM ORBIT – JETZT STARTEN WIR DURCH</text>
<line x1="500" y1="2110" x2="2500" y2="2110" stroke="{c_text}" stroke-opacity=".5" stroke-width="5" stroke-dasharray="4 26" stroke-linecap="round"/>
{"".join(grid)}
<line x1="500" y1="{last_y + 120}" x2="2500" y2="{last_y + 120}" stroke="{c_text}" stroke-opacity=".5" stroke-width="5" stroke-dasharray="4 26" stroke-linecap="round"/>
<text x="1500" y="{last_y + 290}" text-anchor="middle" {FONT} font-weight="800" font-size="96" fill="{c_text}" letter-spacing="18">[NAME DER SCHULE]</text>'''

# ---------- 3) T-Shirt vorne, 30 x 30 cm ----------
def tee(c_text=WHITE):
    rocket = f'''<g transform="translate(1680 820) rotate(32) scale(1.35)">
  <path d="M0,330 C-40,470 -10,560 0,640 C10,560 40,470 0,330Z" fill="{CYAN}"/>
  <path d="M0,300 C-60,420 -30,520 0,560 C30,520 60,420 0,300Z" fill="{PINK}"/>
  <path d="M-80,170 L-190,330 L-70,290Z" fill="{PINK}"/><path d="M80,170 L190,330 L70,290Z" fill="{PINK}"/>
  <path d="M0,-380 C120,-250 130,60 90,320 L-90,320 C-130,60 -120,-250 0,-380Z" fill="{WHITE}"/>
  <circle cy="-70" r="66" fill="{CYAN}" stroke="{LILA}" stroke-width="22"/>
  <path d="M-90,200 L90,200" stroke="{LILA}" stroke-width="22"/>
  <g transform="translate(0 -372) scale(1.3)">
    <path d="M-40,-8 L40,-8 L36,18 Q0,28 -36,18 Z" fill="{LILA}"/>
    <path d="M0,-46 L80,-20 L0,6 L-80,-20 Z" fill="{LILA}"/>
    <path d="M0,-20 L60,-8 L60,30" fill="none" stroke="{PINK}" stroke-width="6" stroke-linecap="round"/>
    <rect x="54" y="26" width="13" height="22" rx="4" fill="{PINK}"/>
  </g>
</g>'''
    trail = f'<path d="M250,1700 C600,1650 1000,1500 1300,1320" fill="none" stroke="{c_text}" stroke-opacity=".55" stroke-width="16" stroke-dasharray="6 46" stroke-linecap="round"/>'
    stars = "".join(spark(x, y, s, c) for x, y, s, c in [(520,420,60,CYAN),(2620,380,44,WHITE),(2650,1500,56,PINK),(380,1100,34,WHITE),(1000,250,30,PINK)])
    return f'''{stars}{trail}{rocket}
<text x="1500" y="1900" text-anchor="middle" {FONT} font-weight="700" font-size="130" fill="{CYAN}" letter-spacing="50">MISSION</text>
<text x="1500" y="2460" text-anchor="middle" {FONT} font-weight="900" font-size="600" letter-spacing="-16"><tspan fill="{c_text}">ABI </tspan><tspan fill="none" stroke="{c_text}" stroke-width="14">27</tspan></text>
<g transform="translate(790 2580)"><rect width="1420" height="170" rx="85" fill="{PINK}"/>
<text x="710" y="118" text-anchor="middle" {FONT} font-weight="900" font-size="110" fill="{WHITE}" letter-spacing="14">✓ COMPLETED</text></g>
<text x="1500" y="2930" text-anchor="middle" {FONT} font-weight="600" font-size="92" fill="{c_text}" fill-opacity=".85">12 Jahre Training. Jetzt: Abflug.</text>'''

# ---------- 4) Tasche, 30 x 30 cm (2 Farben: Navy + Pink auf Natur) ----------
def tote(c=NAVY, a=PINK):
    r = 1050
    label = "SCHWERELOS SEIT 2027 ✦ ABIVERSUM ✦ SCHWERELOS SEIT 2027 ✦ ABIVERSUM ✦ "
    stars = "".join(spark(x, y, s, a) for x, y, s in [(560,620,50),(2450,640,40),(2500,2350,56),(520,2400,36)])
    return f'''<defs><path id="ring" d="M1500,{1500 - r} a{r},{r} 0 1,1 -0.1,0"/></defs>
<circle cx="1500" cy="1500" r="{r + 150}" fill="none" stroke="{c}" stroke-width="10"/>
<circle cx="1500" cy="1500" r="{r - 120}" fill="none" stroke="{c}" stroke-width="10" stroke-dasharray="4 36" stroke-linecap="round"/>
<text {FONT} font-weight="900" font-size="150" fill="{c}" letter-spacing="10"><textPath href="#ring" textLength="{2 * math.pi * r - 30:.0f}">{label}</textPath></text>
{stars}
<g transform="translate(1500 1420) scale(2.6)">{planet(cap=c, body=c, band=a, ring=a, tassel=a, uid="tt")}</g>
<text x="1500" y="2140" text-anchor="middle" {FONT} font-weight="900" font-size="190" fill="{c}" letter-spacing="-4">ABI 2027</text>'''

names = [l.strip() for l in (D / "namen.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
files = {
    "pulli-brust-10x10cm.svg": wrap(1000, 1000, chest()),
    "pulli-ruecken-30x40cm.svg": wrap(3000, 4000, back(names)),
    "tshirt-vorne-30x30cm.svg": wrap(3000, 3000, tee()),
    "tasche-30x30cm.svg": wrap(3000, 3000, tote()),
}
for n, s in files.items():
    (OUT / n).write_text(s, encoding="utf-8")

# ---------- Mockups ----------
HOOD = "M300,150 L230,168 C172,186 142,228 127,300 L68,690 L152,712 L205,372 L207,800 L593,800 L595,372 L648,712 L732,690 L673,300 C658,228 628,186 570,168 L500,150 Z"
TEE = "M305,140 L222,165 L110,250 L168,345 L222,310 L222,770 L578,770 L578,310 L632,345 L690,250 L578,165 L495,140 C478,190 322,190 305,140 Z"
def inner(svg):  # Innenleben eines erzeugten SVG ohne <svg>-Hülle
    return svg.split(">", 1)[1].rsplit("</svg>", 1)[0]
def place(svg, w, x, y, size):
    return f'<g transform="translate({x} {y}) scale({size / w})">{inner(svg)}</g>'
def hoodie(front=True, color="#16131f"):
    hood = ('<path d="M298,160 C268,30 532,30 502,160 C470,236 330,236 298,160Z" fill="{c}" stroke="#2c2840" stroke-width="3"/>'
            if not front else '<path d="M300,152 C292,58 508,58 500,152" fill="{c}" stroke="#2c2840" stroke-width="3"/>').format(c=color)
    det = ('<path d="M322,156 C340,236 460,236 478,156" fill="#0d0b14"/><path d="M370,215 L364,330 M430,215 L436,330" stroke="#e8e6f0" stroke-width="5" stroke-linecap="round"/>'
           '<path d="M285,560 L515,560 L548,700 L252,700 Z" fill="none" stroke="#2c2840" stroke-width="4"/>') if front else ""
    return f'''{hood}<path d="{HOOD}" fill="{color}" stroke="#2c2840" stroke-width="3"/>
<rect x="207" y="768" width="386" height="32" fill="#0f0d17"/><path d="M68,690 L152,712 L156,686 L73,664Z" fill="#0f0d17"/><path d="M732,690 L648,712 L644,686 L727,664Z" fill="#0f0d17"/>{det}'''
mock_h = f'''<rect width="1700" height="1000" fill="#f3f0fa"/>
<text x="850" y="70" text-anchor="middle" {FONT} font-weight="900" font-size="40" fill="#1b1640">ABI-Pulli „ABIversum“ – vorne & hinten</text>
<g transform="translate(40 90)">{hoodie(True)}{place(files["pulli-brust-10x10cm.svg"], 1000, 460, 262, 92)}</g>
<g transform="translate(860 90)">{hoodie(False)}{place(files["pulli-ruecken-30x40cm.svg"], 3000, 262, 215, 276)}</g>'''
mock_t = f'''<rect width="900" height="1000" fill="#f3f0fa"/>
<text x="450" y="70" text-anchor="middle" {FONT} font-weight="900" font-size="40" fill="#1b1640">ABI-T-Shirt „Mission ABI 27“</text>
<g transform="translate(50 90)"><path d="{TEE}" fill="{NAVY}" stroke="#2f2960" stroke-width="3"/><path d="M305,140 C322,190 478,190 495,140" fill="none" stroke="#2f2960" stroke-width="10"/>
{place(files["tshirt-vorne-30x30cm.svg"], 3000, 245, 205, 310)}</g>'''
mock_b = f'''<rect width="900" height="1000" fill="#f3f0fa"/>
<text x="450" y="70" text-anchor="middle" {FONT} font-weight="900" font-size="40" fill="#1b1640">Abi-Jutebeutel „Schwerelos“</text>
<g transform="translate(50 90)"><path d="M300,320 C300,90 500,90 500,320" fill="none" stroke="#d9cfb6" stroke-width="30"/>
<rect x="170" y="300" width="460" height="560" rx="6" fill="#efe6d2" stroke="#d9cfb6" stroke-width="3"/>
{place(files["tasche-30x30cm.svg"], 3000, 215, 360, 370)}</g>'''
(OUT / "mockup-pulli.svg").write_text(wrap(1700, 1000, mock_h), encoding="utf-8")
(OUT / "mockup-tshirt.svg").write_text(wrap(900, 1000, mock_t), encoding="utf-8")
(OUT / "mockup-tasche.svg").write_text(wrap(900, 1000, mock_b), encoding="utf-8")
print("ok", len(names), "Namen")
