// Diagramme als SVG, ohne Bibliothek.
// Farben kommen aus CSS-Variablen (hell/dunkel), Texte immer in Schriftfarbe, nie in Datenfarbe.
// Alle Beschriftungen werden per textContent gesetzt, weil Namen aus E-Mails stammen können.

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};
const html = (tag, cls, text, parent) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  parent?.append(n);
  return n;
};

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

// Säule mit abgerundetem Ende oben, eckig an der Grundlinie.
function topRoundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
function rightRoundedRect(x, y, w, h, r) {
  r = Math.min(r, h / 2, w);
  return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
}

// ---------- Tooltip ----------
let tip;
function tooltip() {
  if (!tip) { tip = html("div", "chart-tip", null, document.body); tip.setAttribute("role", "status"); }
  return tip;
}
function showTip(evt, title, rows) {
  const t = tooltip();
  t.replaceChildren();
  html("div", "tip-title", title, t);
  for (const r of rows) {
    const row = html("div", "tip-row", null, t);
    const key = html("span", "tip-key", null, row);
    key.style.background = r.color;
    html("b", null, String(r.value), row);
    html("span", "muted", r.label, row);
  }
  t.style.display = "block";
  const rect = evt.target.getBoundingClientRect?.() || { left: evt.clientX, top: evt.clientY, width: 0 };
  const x = (evt.clientX ?? rect.left + rect.width / 2) + 14;
  const y = (evt.clientY ?? rect.top) + 14;
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(x, window.innerWidth - w - 8) + "px";
  t.style.top = Math.min(y, window.innerHeight - h - 8) + "px";
}
const hideTip = () => { if (tip) tip.style.display = "none"; };

export function legend(items, parent) {
  const box = html("div", "legend", null, parent);
  for (const it of items) {
    const i = html("span", "legend-item", null, box);
    const sw = html("span", "swatch", null, i);
    sw.style.background = it.color;
    html("span", null, it.label, i);
  }
  return box;
}

// Gestapelte Säulen: E-Mails pro Tag, aufgeteilt nach Kategorie.
export function stackedColumns(container, opts) {
  // In echter Pixelbreite zeichnen, damit Schrift nicht mitwächst; bei Größenänderung neu zeichnen.
  container._opts = opts;
  if (!container._ro) {
    let lastW = 0;
    container._ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (Math.abs(w - lastW) > 20 && container._opts && container.querySelector("svg.chart")) { lastW = w; drawColumns(container, container._opts); }
    });
    container._ro.observe(container);
  }
  return drawColumns(container, opts);
}

function drawColumns(container, { days, keys, labelFor, colorFor, dateLabel }) {
  container.replaceChildren();
  const W = Math.max(300, container.clientWidth || 640), H = 230, padL = 32, padR = 8, padT = 10, padB = 26;
  const totals = days.map((d) => keys.reduce((s, k) => s + (d.by_category[k] || 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const band = plotW / days.length;
  const bw = Math.min(24, band * 0.62);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img", "aria-label": "E-Mails pro Tag nach Kategorie" }, container);
  const y = (v) => padT + plotH - (v / max) * plotH;
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = y(v);
    el("line", { x1: padL, x2: W - padR, y1: yy, y2: yy, class: i === 0 ? "axis" : "grid" }, svg);
    el("text", { x: padL - 6, y: yy + 4, class: "tick", "text-anchor": "end" }, svg).textContent = Number.isInteger(v) ? v : v.toFixed(1);
  }
  const every = Math.ceil(days.length / Math.max(2, Math.floor(plotW / 56)));
  days.forEach((d, i) => {
    const x = padL + i * band + (band - bw) / 2;
    let acc = 0;
    const present = keys.filter((k) => d.by_category[k]);
    present.forEach((k, j) => {
      const v = d.by_category[k];
      const y0 = y(acc), y1 = y(acc + v);
      const gap = j > 0 ? 2 : 0; // 2px Abstand zwischen Segmenten
      const h = Math.max(1, y0 - y1 - gap);
      const top = j === present.length - 1;
      const path = top ? topRoundedRect(x, y1, bw, h, 4) : `M${x},${y1} h${bw} v${h} h${-bw} Z`;
      el("path", { d: path, fill: colorFor(k), class: "mark" }, svg);
      acc += v;
    });
    if (i % every === 0 || i === days.length - 1) {
      el("text", { x: padL + i * band + band / 2, y: H - 8, class: "tick", "text-anchor": "middle" }, svg).textContent = dateLabel(d.date);
    }
    // Trefferfläche: die ganze Spalte, nicht nur die Säule.
    const hit = el("rect", { x: padL + i * band, y: padT, width: band, height: plotH, class: "hit", tabindex: 0 }, svg);
    const rows = () => keys.filter((k) => d.by_category[k]).map((k) => ({ label: labelFor(k), value: d.by_category[k], color: colorFor(k) }));
    const title = () => `${dateLabel(d.date, true)} · ${totals[i]} E-Mail${totals[i] === 1 ? "" : "s"}`;
    hit.addEventListener("pointermove", (e) => showTip(e, title(), rows()));
    hit.addEventListener("pointerleave", hideTip);
    hit.addEventListener("focus", (e) => { const r = hit.getBoundingClientRect(); showTip({ clientX: r.left + r.width / 2, clientY: r.top + 20, target: hit }, title(), rows()); });
    hit.addEventListener("blur", hideTip);
  });
  return svg;
}

// Waagerechte Balken, optional zweigeteilt (z. B. dringend + übrige). Wert steht am Balkenende.
export function hBars(container, items, { segments, valueLabel = (v) => v }) {
  container.replaceChildren();
  if (!items.length) { html("p", "muted", "Keine Daten im Zeitraum.", container); return; }
  const max = Math.max(1, ...items.map((it) => segments.reduce((s, seg) => s + (it[seg.key] || 0), 0)));
  const list = html("div", "hbars", null, container);
  for (const it of items) {
    const total = segments.reduce((s, seg) => s + (it[seg.key] || 0), 0);
    const row = html("div", "hbar-row", null, list);
    const lab = html("div", "hbar-label", null, row);
    if (it.swatch) { const sw = html("span", "swatch", null, lab); sw.style.background = it.swatch; }
    html("span", null, it.label, lab);
    const track = html("div", "hbar-track", null, row);
    const W = 300, H = 14;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", class: "hbar-svg" }, track);
    let x = 0;
    const present = segments.filter((seg) => it[seg.key]);
    present.forEach((seg, j) => {
      const w = (it[seg.key] / max) * (W - 4);
      const last = j === present.length - 1;
      const gap = j > 0 ? 2 : 0;
      const d = last ? rightRoundedRect(x + gap, 0, Math.max(1, w - gap), H, 4) : `M${x + gap},0 h${Math.max(1, w - gap)} v${H} h${-Math.max(1, w - gap)} Z`;
      el("path", { d, fill: seg.color || it.swatch }, svg);
      x += w;
    });
    html("span", "hbar-value", valueLabel(total, it), row);
    row.tabIndex = 0;
    const rows = () => present.map((seg) => ({ label: seg.label, value: it[seg.key], color: seg.color || it.swatch }));
    row.addEventListener("pointermove", (e) => showTip(e, it.label, rows()));
    row.addEventListener("pointerleave", hideTip);
    row.addEventListener("focus", () => { const r = row.getBoundingClientRect(); showTip({ clientX: r.right - 120, clientY: r.top, target: row }, it.label, rows()); });
    row.addEventListener("blur", hideTip);
  }
}

// Tabelle als barrierefreie Alternative zu jedem Diagramm.
export function table(container, headers, rows) {
  container.replaceChildren();
  const t = html("table", "data-table", null, container);
  const tr = html("tr", null, null, t);
  headers.forEach((h) => html("th", null, h, tr));
  for (const r of rows) {
    const row = html("tr", null, null, t);
    r.forEach((c) => html("td", null, String(c), row));
  }
}
