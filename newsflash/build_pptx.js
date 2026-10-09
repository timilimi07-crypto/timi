const pptxgen = require("pptxgenjs");
const path = require("path");
const { applyTheme } = require(process.env.SKILL + "/scripts/apply_theme.js");

const THEME = { name: "Newsflash", headFontFace: "Arial", bodyFontFace: "Calibri",
  colors: { dk1: "1D2433", lt1: "FFFFFF", dk2: "3A4255", lt2: "F3F4F7",
    accent1: "C0392B", accent2: "009EE0", accent3: "46962B", accent4: "7B2450", accent5: "F1C40F", accent6: "2B2B2B",
    hlink: "1D4E9E", folHlink: "7B2450" } };
const P = { afd: "009EE0", cdu: "2B2B2B", spd: "E3000F", linke: "BE3075", gruene: "46962B", bsw: "7B2450", gold: "F1C40F" };

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Newsflash: AfD-Landtagspräsident in Sachsen-Anhalt";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

pres.defineSlideMaster({ title: "Titel dunkel", background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.5, w: 5.6, h: 1.9, fontSize: 34, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.5, w: 5.4, h: 0.9, fontSize: 16, color: "C9CFDB", valign: "top", margin: 0 }, text: "" } },
  ] });
pres.defineSlideMaster({ title: "Inhalt", background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.55, w: 9, h: 0.6, fontSize: 26, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Newsflash · Sozialkunde", options: { x: 0.5, y: 5.25, w: 4, h: 0.25, fontSize: 9, color: "8A93A6", margin: 0 } } },
  ],
  slideNumber: { x: 9.1, y: 5.25, w: 0.4, h: 0.25, fontSize: 9, color: "8A93A6", align: "right" } });

function tag(slide, text, color) {
  slide.addText(text.toUpperCase(), { x: 0.5, y: 0.22, w: 4.5, h: 0.26, fontSize: 10, bold: true, charSpacing: 2,
    color: color || C.accent1, margin: 0, isTextBox: true, objectName: "Kicker" });
}
function hemicycle(slide, cx, cy, scale, dotColorOverride) {
  const parties = [[P.linke, 8], [P.gruene, 8], [P.spd, 8], [dotColorOverride ? "B57FA0" : P.bsw, 5], [dotColorOverride || P.cdu, 15], [P.afd, 39]];
  const R = [0.8, 1.02, 1.24, 1.46, 1.68, 1.9].map(r => r * scale);
  const sum = R.reduce((a, b) => a + b, 0); let acc = 0; const pts = [];
  R.forEach((r, i) => { const n = i < R.length - 1 ? Math.round(83 * r / sum) : 83 - acc; acc += n;
    for (let k = 0; k < n; k++) { const a = Math.PI * (1 - k / (n - 1)); pts.push({ a, x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }); } });
  pts.sort((p, q) => q.a - p.a);
  const d = 0.135 * scale; let i = 0;
  parties.forEach(([col, n]) => { for (let k = 0; k < n; k++) { const p = pts[i++];
    slide.addShape(pres.shapes.OVAL, { x: p.x - d / 2, y: p.y - d / 2, w: d, h: d, fill: { color: col }, line: { color: col, width: 0 }, objectName: "Sitz" }); } });
}
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: opts.fill || C.background2 },
    line: { color: opts.line || "E1E3E8", width: opts.lineW || 0.75 }, objectName: opts.name || "Karte" });
}

// 1 Titel
let s = pres.addSlide({ masterName: "Titel dunkel" });
tag(s, "Newsflash · Landtag Sachsen-Anhalt", "F1C40F");
s.addText("Zum ersten Mal leitet ein AfD-Politiker ein Landesparlament", { placeholder: "title" });
s.addText("Tobias Rausch wird Landtagspräsident – und keiner weiß genau, wer ihn gewählt hat.", { placeholder: "body" });
hemicycle(s, 7.95, 4.35, 0.92, "9AA3B5");
s.addText([{ text: "83", options: { fontSize: 22, bold: true, color: "FFFFFF", breakLine: true } }, { text: "Sitze", options: { fontSize: 11, color: "C9CFDB" } }],
  { x: 7.35, y: 3.75, w: 1.2, h: 0.65, align: "center", margin: 0, isTextBox: true });
s.addText("06.10.2026 · Magdeburg", { x: 0.6, y: 4.85, w: 4, h: 0.3, fontSize: 11, color: "8A93A6", margin: 0, isTextBox: true });
s.addNotes("Hallo zusammen. Mein Newsflash geht um etwas, das es in Deutschland noch nie gab: Zum ersten Mal leitet ein Politiker der AfD ein Landesparlament. Und das Spannende ist: Keiner weiß genau, wer ihm dabei geholfen hat.");

// 2 Meldung
s = pres.addSlide({ masterName: "Inhalt" });
tag(s, "Folie 1 · Die Meldung");
s.addText("Tobias Rausch (AfD) wird Landtagspräsident", { placeholder: "title" });
hemicycle(s, 2.55, 3.85, 0.95);
s.addText([{ text: "83", options: { fontSize: 22, bold: true, color: C.text1, breakLine: true } }, { text: "Mehrheit: 42", options: { fontSize: 10, color: "666666" } }],
  { x: 1.95, y: 3.25, w: 1.2, h: 0.62, align: "center", margin: 0, isTextBox: true });
const leg = [["AfD 39", P.afd], ["CDU 15", P.cdu], ["SPD 8", P.spd], ["Linke 8", P.linke], ["Grüne 8", P.gruene], ["BSW 5", P.bsw]];
leg.forEach(([t, col], k) => { const x = 0.55 + (k % 3) * 1.38, y = 4.15 + Math.floor(k / 3) * 0.3;
  s.addShape(pres.shapes.OVAL, { x, y: y + 0.06, w: 0.14, h: 0.14, fill: { color: col }, line: { color: col, width: 0 } });
  s.addText(t, { x: x + 0.2, y, w: 1.1, h: 0.26, fontSize: 11, color: C.text1, margin: 0, isTextBox: true }); });
s.addText("Landtagswahl 06.09.2026: AfD 43,8 %", { x: 0.55, y: 4.8, w: 4, h: 0.26, fontSize: 10, color: "666666", margin: 0, isTextBox: true });

card(s, 5.15, 1.4, 4.35, 2.05, { name: "Rechnung" });
s.addText("Das Rätsel: Stimmen für Rausch (geheim)", { x: 5.35, y: 1.52, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.text1, margin: 0, isTextBox: true });
const bx = 5.35, by = 2.0, bw = 2.95 / 48;
[["AfD 39", 39, P.afd, "FFFFFF"], ["BSW 5", 5, P.bsw, "FFFFFF"], ["+4", 4, P.gold, "1D2433"]].reduce((x, [t, n, col, tc]) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y: by, w: n * bw, h: 0.45, fill: { color: col }, line: { color: col, width: 0 } });
  s.addText(t, { x, y: by, w: n * bw, h: 0.45, fontSize: n > 5 ? 14 : 10, bold: true, color: tc, align: "center", valign: "middle", margin: 0, isTextBox: true });
  return x + n * bw; }, bx);
s.addText("= 48", { x: 8.4, y: by, w: 1, h: 0.45, fontSize: 22, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
s.addText("? von wem ?", { x: 7.6, y: 2.5, w: 1.3, h: 0.25, fontSize: 11, bold: true, color: "B8860B", margin: 0, isTextBox: true });
s.addText("82 abgegeben · 48 Ja · 19 Nein", { x: 5.35, y: 2.95, w: 4, h: 0.3, fontSize: 12, color: "444444", margin: 0, isTextBox: true });
const facts = [["1.", "Erster AfD-Landtagspräsident in Deutschland"], ["4+", "Stimmen kamen aus anderen Fraktionen"], ["?", "Wer hat geholfen – und ist das okay?"]];
facts.forEach(([n, t], k) => { const y = 3.65 + k * 0.48;
  s.addShape(pres.shapes.OVAL, { x: 5.15, y, w: 0.38, h: 0.38, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 } });
  s.addText(n, { x: 5.15, y, w: 0.38, h: 0.38, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText(t, { x: 5.65, y, w: 3.85, h: 0.38, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true }); });
s.addNotes("Am Dienstag, 6. Oktober 2026, hat sich in Magdeburg der neue Landtag von Sachsen-Anhalt zum ersten Mal getroffen. Dabei wurde Tobias Rausch von der AfD zum Landtagspräsidenten gewählt.\n\nDer Landtagspräsident ist so etwas wie der Chef des Parlaments: Er leitet die Sitzungen, achtet auf die Regeln und vertritt den Landtag nach außen. Er ist NICHT der Regierungschef – das ist der Ministerpräsident.\n\n[Halbkreis zeigen] Bei der Wahl am 6. September hat die AfD 43,8 Prozent geholt und hat jetzt 39 von 83 Sitzen. Für eine eigene Mehrheit bräuchte sie 42.\n\n[Rechnung zeigen] Rausch hat 48 Stimmen bekommen. AfD hat 39, das BSW 5 – zusammen 44. Es fehlen also mindestens vier Stimmen von anderen Parteien. Weil die Wahl geheim war, weiß man nicht, von wem.\n\nDas politische Problem: Wer hat geholfen – und ist es okay, einen AfD-Politiker an die Spitze des Parlaments zu wählen?");

// 3 Analyse
s = pres.addSlide({ masterName: "Inhalt" });
tag(s, "Folie 2 · Analyse (Variante A: Politikzyklus)");
s.addText("Phase: Entscheidung", { placeholder: "title" });
const ph = ["Problem", "Agenda", "Entscheidung", "Umsetzung", "Bewertung"], ccx = 1.95, ccy = 3.2, cr = 1.15;
s.addShape(pres.shapes.OVAL, { x: ccx - cr, y: ccy - cr, w: 2 * cr, h: 2 * cr, fill: { color: "FFFFFF", transparency: 100 }, line: { color: "CCCCCC", width: 1.25, dashType: "dash" } });
ph.forEach((p, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5, on = i === 2, r = on ? 0.48 : 0.38;
  const x = ccx + cr * Math.cos(a), y = ccy + cr * Math.sin(a);
  s.addShape(pres.shapes.OVAL, { x: x - r, y: y - r, w: 2 * r, h: 2 * r, fill: { color: on ? C.accent1 : "FFFFFF" }, line: { color: on ? C.accent1 : "BBBBBB", width: 1.25 }, objectName: "Phase " + p });
  s.addText(p, { x: x - 0.6, y: y - 0.15, w: 1.2, h: 0.3, fontSize: on ? 11 : 10, bold: true, color: on ? "FFFFFF" : "555555", align: "center", valign: "middle", margin: 0, isTextBox: true }); });
s.addText("Wahl des Präsidenten", { x: ccx - 0.6, y: ccy - 0.25, w: 1.2, h: 0.5, fontSize: 10, color: "888888", align: "center", valign: "middle", margin: 0, isTextBox: true });
// timeline
const tl = [["06.09.", "Landtagswahl", false], ["22.09.", "Endergebnis", false], ["06.10.", "Wahl Präsident", true], ["Dezember", "Wahl MP?", false]];
const tx0 = 4.25, tx1 = 9.2, ty = 1.85;
s.addShape(pres.shapes.LINE, { x: tx0, y: ty, w: tx1 - tx0, h: 0, line: { color: "BBBBBB", width: 2.5 } });
tl.forEach(([d, t, on], k) => { const x = tx0 + k * (tx1 - tx0) / 3, r = on ? 0.14 : 0.1;
  s.addShape(pres.shapes.OVAL, { x: x - r, y: ty - r, w: 2 * r, h: 2 * r, fill: { color: on ? C.accent1 : (k === 3 ? "FFFFFF" : "888888") }, line: { color: on ? C.accent1 : "888888", width: 1.5 } });
  s.addText(d, { x: x - 0.7, y: ty - 0.5, w: 1.4, h: 0.28, fontSize: 12, bold: true, color: on ? C.accent1 : C.text1, align: "center", margin: 0, isTextBox: true });
  s.addText(t, { x: x - 0.7, y: ty + 0.2, w: 1.4, h: 0.28, fontSize: 11, bold: on, color: C.text1, align: "center", margin: 0, isTextBox: true }); });
card(s, 4.25, 2.75, 2.45, 2.2, { name: "Vorher" });
s.addText([{ text: "Vorher: Was hat es möglich gemacht?", options: { bold: true, fontSize: 12, breakLine: true } },
  { text: "Wahl: AfD stärkste Fraktion", options: { bullet: true, breakLine: true } },
  { text: "Geschäftsordnung: Stärkste Fraktion schlägt vor", options: { bullet: true, breakLine: true } },
  { text: "Verfassung Art. 49: Landtag wählt frei", options: { bullet: true } }],
  { x: 4.4, y: 2.85, w: 2.2, h: 2.0, fontSize: 11, color: C.text1, valign: "top", paraSpaceAfter: 4, margin: 0, isTextBox: true });
card(s, 6.95, 2.75, 2.55, 2.2, { name: "Nachher", fill: "FDECEA", line: C.accent1 });
s.addText([{ text: "Nachher: Wer kann blockieren?", options: { bold: true, fontSize: 12, breakLine: true } },
  { text: "Vetospieler: CDU & BSW", options: { bold: true, color: C.accent1, breakLine: true } },
  { text: "AfD fehlen 3 Stimmen zur Mehrheit", options: { bullet: true, breakLine: true } },
  { text: "Ohne CDU oder BSW kein AfD-Ministerpräsident", options: { bullet: true } }],
  { x: 7.1, y: 2.85, w: 2.3, h: 2.0, fontSize: 11, color: C.text1, valign: "top", paraSpaceAfter: 4, margin: 0, isTextBox: true });
s.addNotes("Ich habe das mit dem Politikzyklus analysiert. [Kreis zeigen] Der Zyklus hat fünf Phasen: Problem, Agenda, Entscheidung, Umsetzung, Bewertung. Die Meldung gehört in die Phase Entscheidung – der Landtag hat seinen Präsidenten gewählt. Das steht so im Plenarprotokoll der Sitzung.\n\n[Zeitstrahl] Was hat das möglich gemacht? Erstens die Landtagswahl am 6. September – AfD wurde stärkste Fraktion. Endergebnis am 22. September. Zweitens die Geschäftsordnung des Landtags: Die stärkste Fraktion schlägt den Kandidaten vor. Die Landesverfassung sagt in Artikel 49 nur: Der Landtag wählt seinen Präsidenten. Gewählt werden muss man also trotzdem.\n\nWie geht es weiter? Im Dezember will Ulrich Siegmund (AfD) Ministerpräsident werden. Ihm fehlen drei Stimmen. Deshalb sind CDU und BSW die Vetospieler: Ohne sie gibt es keinen AfD-Ministerpräsidenten. Das BSW hat eine Koalition bisher ausgeschlossen.");

// 4 Kontroverse
s = pres.addSlide({ masterName: "Inhalt" });
tag(s, "Folie 3 · Kontroverse & Urteil");
s.addText("Muss die stärkste Fraktion den Präsidenten stellen?", { placeholder: "title" });
[[0.5, P.afd, "JA – „Das ist üblich“", "AfD, BSW", "Stärkste Fraktion stellt Präsidenten. Rausch: Präsident des ganzen Landtags"],
 [5.6, P.gruene, "NEIN – „Nicht diese Partei“", "Grüne, SPD", "AfD Sachsen-Anhalt gilt als rechtsextremistisch. SPD: CDU soll Stimmen aufklären"]].forEach(([x, col, h, who, t]) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.35, w: 3.9, h: 1.45, rectRadius: 0.08, fill: { color: col }, line: { color: col, width: 0 }, objectName: h });
  s.addText([{ text: h, options: { bold: true, fontSize: 15, breakLine: true } }, { text: who, options: { bold: true, fontSize: 11, breakLine: true } }, { text: t, options: { fontSize: 11 } }],
    { x: x + 0.15, y: 1.42, w: 3.6, h: 1.3, color: "FFFFFF", valign: "top", paraSpaceAfter: 3, margin: 0, isTextBox: true }); });
s.addShape(pres.shapes.OVAL, { x: 4.6, y: 1.77, w: 0.8, h: 0.6, fill: { color: C.text1 }, line: { color: C.text1, width: 0 } });
s.addText("vs.", { x: 4.6, y: 1.77, w: 0.8, h: 0.6, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
[["Konflikttyp", "Wertkonflikt", "Streitpunkt: Gilt die Regel auch für eine extremistisch eingestufte Partei?"],
 ["Urteilsmaßstab", "Legitimität", "Reicht eine Mehrheit – oder braucht das Amt mehr Vertrauen?"],
 ["Offene Frage", "Wer waren die 4?", "Geheime Wahl → kein Beweis. Wichtig für Dezember"]].forEach(([l, b, t], k) => {
  const x = 0.5 + k * 3.07; card(s, x, 2.98, 2.86, 1.35, { name: l });
  s.addText([{ text: l, options: { fontSize: 10, color: "666666", breakLine: true } }, { text: b, options: { fontSize: 14, bold: true, color: C.accent1, breakLine: true } }, { text: t, options: { fontSize: 10.5, color: C.text1 } }],
    { x: x + 0.13, y: 3.05, w: 2.6, h: 1.22, valign: "top", paraSpaceAfter: 2, margin: 0, isTextBox: true }); });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.45, w: 9, h: 0.68, rectRadius: 0.08, fill: { color: C.text1 }, line: { color: C.text1, width: 0 }, objectName: "Diskussionsfrage" });
s.addText([{ text: "Diskussion:  ", options: { color: P.gold } }, { text: "Sollte die stärkste Fraktion immer den Landtagspräsidenten stellen dürfen – egal welche Partei?", options: { color: "FFFFFF" } }],
  { x: 0.7, y: 4.45, w: 8.6, h: 0.68, fontSize: 14, bold: true, valign: "middle", margin: 0, isTextBox: true });
s.addNotes("[Zwei Seiten zeigen] AfD und BSW sagen: Es ist üblich, dass die stärkste Fraktion den Präsidenten stellt. Rausch hat in seiner ersten Rede gesagt, er will Präsident des gesamten Landtags sein.\n\nGrüne und SPD sagen: Die AfD in Sachsen-Anhalt wird vom Verfassungsschutz als rechtsextremistisch eingestuft – so jemand sollte nicht an der Spitze des Parlaments stehen. Die SPD-Spitze verlangt von der CDU Aufklärung.\n\nKonflikttyp: vor allem ein Wertkonflikt, ein bisschen auch Verfahrenskonflikt. Einig sind sich alle: Die Wahl ist frei und geheim. Der Streit beginnt bei der Frage, ob die Regel auch für eine als extremistisch eingestufte Partei gelten soll.\n\nMaßstab: Legitimität – reicht es, demokratisch gewählt zu sein, oder braucht das Amt Vertrauen von allen Seiten?\n\nOffene Frage: Wer die vier zusätzlichen Stimmen gegeben hat – kann man wegen der geheimen Wahl nicht beweisen.\n\nDISKUSSION. Falls es stockt:\n- Alle sagen Nein: 'Fühlen sich dann 43,8 % der Wähler nicht ernst genommen? Macht das die AfD nicht stärker?'\n- Alle sagen Ja: 'Der Präsident leitet die Sitzungen und entscheidet, wer reden darf – kann man das jemandem geben, dessen Partei als rechtsextremistisch gilt?'\n\nSCHLUSS: Meine eigene Meinung ist: [selbst formulieren]. Danke fürs Zuhören!");

// 5 Quellen
s = pres.addSlide({ masterName: "Inhalt" });
tag(s, "Quellen", C.text1);
s.addText("Quellenverzeichnis", { placeholder: "title" });
const src = [
  [true, "Landtag Sachsen-Anhalt, Plenarprotokoll der konstituierenden Sitzung, 06.10.2026, S. ___ (Antrittsrede T. Rausch)"],
  [true, "Verfassung des Landes Sachsen-Anhalt, Art. 49 Abs. 1; Geschäftsordnung des Landtags, § 4 Abs. 2"],
  [false, "t-online: „Sachsen-Anhalt: 48 Stimmen für Rausch“, 06.10.2026"],
  [false, "ZDFheute: „AfD-Landtagspräsident: So lief die Sitzung in Sachsen-Anhalt“, 06.10.2026"],
  [false, "Tagesspiegel-Liveblog: „Nur 33 Ja-Stimmen: SPD-Kandidat Willingmann fällt … durch“, 06.10.2026"],
  [false, "Landtag Sachsen-Anhalt: „Amtliches Endergebnis der Wahl steht fest“, 22.09.2026"]];
s.addText(src.map(([prim, t], k) => ({ text: (prim ? "PRIMÄRQUELLE: " : "") + t, options: { bullet: { type: "number" }, bold: prim, breakLine: k < src.length - 1 } })),
  { x: 0.5, y: 1.35, w: 9, h: 2.4, fontSize: 12, color: C.text1, valign: "top", paraSpaceAfter: 5, margin: 0, isTextBox: true });
card(s, 0.5, 3.75, 9, 0.95, { name: "KI-Hinweis" });
s.addText([{ text: "KI-Nutzung (offengelegt)", options: { bold: true, fontSize: 12, breakLine: true } },
  { text: "Werkzeug: Claude (Anthropic) – Recherche, Folien, Sprechzettel. Prompt: [eigenen Prompt einfügen]. Alle Zahlen gegen die Quellen geprüft.", options: { fontSize: 11 } }],
  { x: 0.7, y: 3.83, w: 8.6, h: 0.8, color: C.text1, valign: "top", margin: 0, isTextBox: true });
s.addNotes("Primärquelle vor dem Vortrag selbst prüfen: Plenarprotokoll auf landtag.sachsen-anhalt.de – Seitenzahl und wörtliches Zitat aus Rauschs Antrittsrede eintragen.");

(async () => {
  const out = path.join(__dirname, "Newsflash_Praesentation.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  // sanfte Überblendung (Fade) auf jeder Folie – pptxgenjs kann keine Übergänge
  require("child_process").execFileSync("python3", [path.join(__dirname, "add_transitions.py"), out]);
  console.log("ok", out);
})();
