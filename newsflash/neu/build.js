// Neue, super einfache Newsflash-Präsentation mit Morph-Übergängen (Keynote: "Zauberei")
const pptxgen = require("pptxgenjs");
const path = require("path");
const { execFileSync } = require("child_process");
const { applyTheme } = require(process.env.SKILL + "/scripts/apply_theme.js");

const THEME = { name: "Newsflash einfach", headFontFace: "Arial", bodyFontFace: "Arial",
  colors: { dk1: "141B2D", lt1: "FFFFFF", dk2: "3A4255", lt2: "F2F3F6",
    accent1: "D7263D", accent2: "009EE0", accent3: "46962B", accent4: "7B2450", accent5: "F4B400", accent6: "2B2B2B",
    hlink: "1D4E9E", folHlink: "7B2450" } };
const NAVY = "141B2D", RED = "D7263D", GOLD = "F4B400", GREY = "8A93A6";
const P = { afd: "009EE0", cdu: "2B2B2B", spd: "E3000F", linke: "BE3075", gruene: "46962B", bsw: "7B2450" };

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Newsflash: Erster AfD-Landtagspräsident";
pres.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
const C = pres.SchemeColor;

pres.defineSlideMaster({ title: "Dunkel", background: { color: NAVY },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.75, w: 8.8, h: 0.9, fontSize: 36, bold: true, color: "FFFFFF", align: "left", valign: "top", margin: 0 }, text: "" } }] });
pres.defineSlideMaster({ title: "Hell", background: { color: "FFFFFF" },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.75, w: 8.8, h: 0.8, fontSize: 36, bold: true, color: NAVY, align: "left", valign: "top", margin: 0 }, text: "" } }],
  slideNumber: { x: 9.1, y: 5.2, w: 0.4, h: 0.25, fontSize: 10, color: GREY, align: "right" } });

const kicker = (s, t, col) => s.addText(t.toUpperCase(), { x: 0.6, y: 0.35, w: 7, h: 0.3, fontSize: 12, bold: true, charSpacing: 3, color: col || RED, margin: 0, isTextBox: true, objectName: "!!kicker" });
const txt = (s, t, o) => s.addText(t, Object.assign({ margin: 0, isTextBox: true, color: NAVY }, o));
// der rote Punkt wandert per Morph von Folie zu Folie
const accent = (s, x, y, d, t, fs) => s.addText(t || "", { shape: pres.shapes.OVAL, x, y, w: d, h: d, fill: { color: RED }, line: { color: RED, width: 0 },
  fontSize: fs || 20, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, objectName: "!!accent" });

function seats(s, cx, cy, scale) {
  const parties = [[P.linke, 8], [P.gruene, 8], [P.spd, 8], [P.bsw, 5], [P.cdu, 15], [P.afd, 39]];
  const R = [0.8, 1.02, 1.24, 1.46, 1.68, 1.9].map(r => r * scale);
  const sum = R.reduce((a, b) => a + b, 0); let acc = 0; const pts = [];
  R.forEach((r, i) => { const n = i < R.length - 1 ? Math.round(83 * r / sum) : 83 - acc; acc += n;
    for (let k = 0; k < n; k++) { const a = Math.PI * (1 - k / (n - 1)); pts.push({ a, x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }); } });
  pts.sort((p, q) => q.a - p.a);
  const d = 0.14 * scale; let i = 0;
  parties.forEach(([col, n]) => { for (let k = 0; k < n; k++) { const p = pts[i];
    s.addShape(pres.shapes.OVAL, { x: p.x - d / 2, y: p.y - d / 2, w: d, h: d, fill: { color: col }, line: { color: col, width: 0 }, objectName: "!!seat" + i }); i++; } });
}
const card = (s, x, y, w, h, fill, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name });

// ---------- Titel ----------
let s = pres.addSlide({ masterName: "Dunkel" });
kicker(s, "Newsflash · Sozialkunde", GOLD);
s.addText("Erster AfD-Landtagschef", { placeholder: "title" });
txt(s, "Sachsen-Anhalt · 6. Oktober 2026", { x: 0.6, y: 1.75, w: 6, h: 0.4, fontSize: 18, color: "C9CFDB" });
seats(s, 6.9, 5.3, 1.15);
accent(s, 6.65, 4.85, 0.5, "", 14);
s.addNotes("Einstieg: gab's so noch nie in Deutschland. AfD-Politiker ist jetzt Chef von einem Landtag. Keiner weiß genau, wer ihn mitgewählt hat.");

// ---------- Folie 1: Meldung ----------
s = pres.addSlide({ masterName: "Hell" });
kicker(s, "1 · Die Meldung");
s.addText("Rausch wird Landtagspräsident", { placeholder: "title" });
txt(s, "Tobias Rausch (AfD) · 6. Oktober 2026 · Magdeburg", { x: 0.6, y: 1.5, w: 8, h: 0.4, fontSize: 18, color: GREY });
seats(s, 2.3, 4.55, 0.92);
txt(s, "39 von 83 Sitzen", { x: 0.6, y: 4.7, w: 3.4, h: 0.35, fontSize: 16, bold: true, align: "center" });
// Rechnung
const eq = [["39", "AfD", P.afd], ["+", "", null], ["5", "BSW", P.bsw], ["+", "", null]];
let ex = 4.6;
eq.forEach(([n, l, col]) => {
  if (!col) { txt(s, n, { x: ex, y: 2.55, w: 0.4, h: 0.8, fontSize: 30, bold: true, color: GREY, align: "center", valign: "middle" }); ex += 0.45; return; }
  card(s, ex, 2.55, 0.95, 0.8, col, "Block " + l);
  txt(s, n, { x: ex, y: 2.55, w: 0.95, h: 0.8, fontSize: 30, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
  txt(s, l, { x: ex, y: 3.4, w: 0.95, h: 0.3, fontSize: 13, color: GREY, align: "center" }); ex += 1.0; });
accent(s, ex + 0.05, 2.55, 0.8, "?", 32);
txt(s, "4 von wem?", { x: ex - 0.3, y: 3.4, w: 1.5, h: 0.3, fontSize: 13, bold: true, color: RED, align: "center" });
txt(s, "= 48", { x: ex + 0.95, y: 2.55, w: 1.3, h: 0.8, fontSize: 32, bold: true, valign: "middle" });
txt(s, [{ text: "geheime Wahl", options: { bullet: true, breakLine: true } }, { text: "erstmals in Deutschland", options: { bullet: true } }],
  { x: 4.7, y: 4.05, w: 4.5, h: 0.8, fontSize: 18, paraSpaceAfter: 6 });
s.addNotes("6. Oktober, Magdeburg, erste Sitzung vom neuen Landtag. Tobias Rausch (AfD) wird Landtagspräsident = Chef vom Parlament, leitet die Sitzungen. Nicht verwechseln mit Ministerpräsident.\n[Halbkreis] Wahl am 6.9.: AfD 43,8 %, 39 von 83 Sitzen, Mehrheit wäre 42.\n[Rechnung] Rausch bekommt 48 Stimmen. AfD 39 + BSW 5 = 44. Also 4 Stimmen von anderen. Wahl geheim, keiner weiß von wem. CDU hatte eigentlich gesagt: wir enthalten uns.\nProblem: Wer hat geholfen, und ist das okay?");

// ---------- Folie 2: Politikzyklus ----------
s = pres.addSlide({ masterName: "Hell" });
kicker(s, "2 · Analyse: Politikzyklus");
s.addText("Schritt 3: Entscheidung", { placeholder: "title" });
const ph = ["Problem", "Agenda", "Entscheidung", "Umsetzung", "Bewertung"], cx = 2.5, cy = 3.4, R = 1.4;
s.addShape(pres.shapes.OVAL, { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, fill: { color: "FFFFFF", transparency: 100 }, line: { color: "C8CCD4", width: 1.5, dashType: "dash" }, objectName: "Kreislinie" });
ph.forEach((p, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
  if (i === 2) { accent(s, x - 0.72, y - 0.72, 1.44, "3\nEntscheidung", 10); return; }
  s.addText((i + 1) + "\n" + p, { shape: pres.shapes.OVAL, x: x - 0.52, y: y - 0.52, w: 1.04, h: 1.04, fill: { color: "F2F3F6" }, line: { color: "C8CCD4", width: 1 },
    fontSize: 9.5, bold: true, color: NAVY, align: "center", valign: "middle", margin: 0, objectName: "Phase " + p }); });
card(s, 5.1, 1.85, 4.3, 1.35, "F2F3F6", "Davor");
txt(s, [{ text: "Davor", options: { fontSize: 13, color: GREY, breakLine: true } }, { text: "6.9. Wahl → AfD stärkste Partei", options: { fontSize: 18, bold: true } }],
  { x: 5.35, y: 1.95, w: 3.9, h: 1.15, valign: "middle" });
card(s, 5.1, 3.45, 4.3, 1.35, "FDE7EA", "Danach");
txt(s, [{ text: "Danach", options: { fontSize: 13, color: GREY, breakLine: true } }, { text: "Dez.: Wahl Ministerpräsident", options: { fontSize: 18, bold: true, breakLine: true } }, { text: "CDU / BSW können blockieren", options: { fontSize: 16, color: RED, bold: true } }],
  { x: 5.35, y: 3.55, w: 3.9, h: 1.15, valign: "middle" });
s.addNotes("Politikzyklus = 5 Schritte, wie Politik ein Problem löst.\n1 Problem: Landtag braucht Chef. 2 Agenda: AfD darf vorschlagen → Rausch. 3 Entscheidung: 6.10. Wahl ← hier ist meine Meldung (steht im Plenarprotokoll). 4 Umsetzung: Rausch leitet Sitzungen. 5 Bewertung: Streit.\nDavor: Wahl 6.9., AfD stärkste Partei → darf laut Hausordnung vorschlagen. Gewählt werden muss man trotzdem (Verfassung Art. 49).\nDanach: Dezember, Siegmund (AfD) will Ministerpräsident werden, 3 Stimmen fehlen → CDU und BSW sind Vetospieler.");

// ---------- Folie 3: Kontroverse ----------
s = pres.addSlide({ masterName: "Hell" });
kicker(s, "3 · Kontroverse & Urteil");
s.addText("Immer die stärkste Partei?", { placeholder: "title" });
card(s, 0.6, 1.75, 3.95, 1.45, P.afd, "JA");
txt(s, [{ text: "JA", options: { fontSize: 28, bold: true, breakLine: true } }, { text: "AfD, BSW: „ist üblich“", options: { fontSize: 17 } }], { x: 0.85, y: 1.8, w: 3.5, h: 1.35, color: "FFFFFF", valign: "middle" });
card(s, 5.45, 1.75, 3.95, 1.45, P.gruene, "NEIN");
txt(s, [{ text: "NEIN", options: { fontSize: 28, bold: true, breakLine: true } }, { text: "Grüne, SPD: „rechtsextrem“", options: { fontSize: 17 } }], { x: 5.7, y: 1.8, w: 3.5, h: 1.35, color: "FFFFFF", valign: "middle" });
accent(s, 4.62, 2.1, 0.76, "vs.", 18);
[["Wertkonflikt", "F2F3F6", NAVY], ["Maßstab: Legitimität", "F2F3F6", NAVY], ["Offen: Wer waren die 4?", "FFF4D1", "8A6D00"]].forEach(([t, f, c], k) => {
  const x = 0.6 + k * 2.98; card(s, x, 3.45, 2.82, 0.65, f, t);
  txt(s, t, { x, y: 3.45, w: 2.82, h: 0.65, fontSize: 15, bold: true, color: c, align: "center", valign: "middle" }); });
card(s, 0.6, 4.3, 8.8, 0.75, NAVY, "Frage");
txt(s, "Soll immer die stärkste Partei den Landtagschef stellen?", { x: 0.85, y: 4.3, w: 8.3, h: 0.75, fontSize: 18, bold: true, color: "FFFFFF", valign: "middle" });
s.addNotes("JA (AfD, BSW): ist üblich, stärkste Partei stellt den Chef. Rausch: will Präsident für den ganzen Landtag sein.\nNEIN (Grüne, SPD): AfD Sachsen-Anhalt gilt als gesichert rechtsextrem, so jemand nicht an die Spitze. SPD will wissen, ob CDU-Leute mitgewählt haben.\nWertkonflikt: beide finden andere Sachen wichtig. Einig: Wahl ist frei und geheim.\nMaßstab Legitimität: reicht eine Mehrheit oder braucht man Vertrauen von allen?\nOffen: wer die 4 waren, kann man nicht beweisen.\nDiskussion! Wenn alle Nein: fühlen sich 43,8 % der Wähler dann nicht ernst genommen? Wenn alle Ja: der Präsident entscheidet, wer reden darf – will man das bei so einer Partei?\nAm Schluss: meine Meinung.");

// ---------- Quellen ----------
s = pres.addSlide({ masterName: "Hell" });
kicker(s, "Quellen", NAVY);
s.addText("Quellen", { placeholder: "title" });
const src = [
  [true, "Landtag Sachsen-Anhalt: Plenarprotokoll, konstituierende Sitzung, 06.10.2026, S. ___ (Rede T. Rausch)"],
  [true, "Verfassung Sachsen-Anhalt Art. 49 Abs. 1; Geschäftsordnung des Landtags § 4 Abs. 2"],
  [false, "t-online: „Sachsen-Anhalt: 48 Stimmen für Rausch“, 06.10.2026"],
  [false, "ZDFheute: „AfD-Landtagspräsident: So lief die Sitzung in Sachsen-Anhalt“, 06.10.2026"],
  [false, "Tagesspiegel-Liveblog zur konstituierenden Sitzung, 06.10.2026"],
  [false, "Landtag Sachsen-Anhalt: „Amtliches Endergebnis der Wahl steht fest“, 22.09.2026"],
  [false, "KI: Claude (Anthropic) – Recherche, Folien, Sprechzettel. Prompts: [eigene Prompts einfügen]"]];
txt(s, src.map(([p, t], k) => ({ text: (p ? "Primärquelle: " : "") + t, options: { bullet: { type: "number" }, bold: p, breakLine: k < src.length - 1 } })),
  { x: 0.6, y: 1.65, w: 8.8, h: 3.3, fontSize: 13, paraSpaceAfter: 6, valign: "top" });
accent(s, 9.0, 0.36, 0.28, "", 8);
s.addNotes("Primärquelle vorher prüfen: Seitenzahl + Zitat aus dem Plenarprotokoll eintragen. Eigene Prompts einfügen.");

(async () => {
  const out = path.join(__dirname, "Newsflash_einfach.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  execFileSync("python3", [path.join(__dirname, "morph.py"), out]);
  console.log("ok", out);
})();
