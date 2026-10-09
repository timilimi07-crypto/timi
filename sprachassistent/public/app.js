// T.I.M.I. – Oberfläche
// Spracherkennung und Sprachausgabe laufen über die Web Speech API des Browsers.

const $ = (id) => document.getElementById(id);
const reactor = $("reactor");
const statusEl = $("status");
const interimEl = $("interim");
const replyEl = $("reply");
const desktop = $("desktop");
const handsfreeBtn = $("handsfree");

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return null;
  }
}

let sessionId = store("sessionId") || newSessionId();
let busy = false;
let handsfree = store("handsfree") ?? true;
const chatLog = [];

function newSessionId() {
  const id = crypto.randomUUID();
  store("sessionId", id);
  return id;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) location.href = "/login"; // Cloud-Betrieb: Anmeldung abgelaufen
  return res.json();
}

// iPad und iPhone (iPadOS meldet sich wie ein Mac, hat aber einen Touchscreen)
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// ---------------------------------------------------------------------------
// Design und Schrift

const THEMES = [
  { id: "jarvis", name: "JARVIS", bg: "#01070d", accent: "#3ee8ff", text: "#d4f7ff", font: "Orbitron" },
  { id: "mark", name: "Mark", bg: "#0d0204", accent: "#ffc43d", text: "#ffe9d6", glow: "#b4141e", font: "Orbitron" },
  { id: "matrix", name: "Matrix", bg: "#000300", accent: "#39ff78", text: "#c9ffd9", font: "Share Tech Mono" },
  { id: "synthwave", name: "Synthwave", bg: "#0b0218", accent: "#ff40d6", text: "#f6defc", glow: "#a028dc", font: "Audiowide" },
  { id: "nordlicht", name: "Nordlicht", bg: "#030a12", accent: "#5effd6", text: "#e2f4ff", glow: "#7850dc", font: "Exo 2" },
  { id: "tag", name: "Tag", bg: "#eef3f7", accent: "#007acc", text: "#1f2d3a", font: "Exo 2" },
];

const FONTS = {
  standard: { name: "Wie im Design", css: null },
  orbitron: { name: "Orbitron – futuristisch", css: '"Orbitron", sans-serif' },
  rajdhani: { name: "Rajdhani – technisch", css: '"Rajdhani", sans-serif' },
  exo: { name: "Exo 2 – modern", css: '"Exo 2", sans-serif' },
  audiowide: { name: "Audiowide – retro", css: '"Audiowide", sans-serif' },
  mono: { name: "Share Tech Mono – Terminal", css: '"Share Tech Mono", monospace' },
  inter: { name: "Inter – schlicht", css: '"Inter", sans-serif' },
};

let look = { theme: "jarvis", display: "standard", body: "standard", fs: 1, ...(store("look") ?? {}) };

function applyLook(changes = {}) {
  look = { ...look, ...changes };
  store("look", look);
  const root = document.documentElement;
  if (look.theme === "jarvis") delete root.dataset.theme;
  else root.dataset.theme = look.theme;
  for (const [key, prop] of [["display", "--font-display"], ["body", "--font-body"]]) {
    const css = FONTS[look[key]]?.css;
    if (css) root.style.setProperty(prop, css);
    else root.style.removeProperty(prop);
  }
  root.style.setProperty("--fs", String(look.fs));
  const bg = THEMES.find((t) => t.id === look.theme)?.bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg ?? "#01070d");
}
applyLook();

// ---------------------------------------------------------------------------
// Uhr

function tickClock() {
  const now = new Date();
  $("clock-time").textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  $("clock-date").textContent = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}
tickClock();
setInterval(tickClock, 10000);

// ---------------------------------------------------------------------------
// Reaktor: Zustand und Pegel

let mode = "idle";
let level = 0;
let micLevel = 0;

function setMode(next) {
  mode = next;
  reactor.classList.remove("listening", "speaking", "thinking");
  if (next !== "idle") reactor.classList.add(next);
  statusEl.textContent = {
    idle: "Bereit",
    listening: "Ich höre zu",
    thinking: "Verarbeite",
    speaking: "Antworte",
  }[next];
}

function animate(t) {
  let target = 0.05 + Math.sin(t / 900) * 0.04; // leichtes Atmen im Ruhezustand
  if (mode === "listening") target = Math.max(0.12, micLevel);
  if (mode === "speaking") target = 0.35 + Math.abs(Math.sin(t / 110) * Math.sin(t / 270)) * 0.55;
  if (mode === "thinking") target = 0.2 + Math.sin(t / 160) * 0.1;
  level += (target - level) * 0.25;
  document.documentElement.style.setProperty("--level", level.toFixed(3));
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Mikrofonpegel für die Animation (nur während des Zuhörens)
let analyser = null;
async function startMeter() {
  // Auf iPad/iPhone würde der Pegelmesser der Spracherkennung das Mikrofon wegnehmen.
  if (IS_IOS || analyser || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const read = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += (v - 128) ** 2;
      micLevel = Math.min(1, Math.sqrt(sum / data.length) / 30);
      requestAnimationFrame(read);
    };
    read();
  } catch {
    // Ohne Pegel geht es auch.
  }
}

// ---------------------------------------------------------------------------
// Sprachausgabe

let germanVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("de"));
  germanVoice =
    voices.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ||
    voices.find((v) => /google/i.test(v.name)) ||
    voices[0] ||
    null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

let speechQueue = 0;
let onSpeechIdle = null;
let muted = false; // nach einer Unterbrechung den Rest der Antwort nicht mehr vorlesen

// Safari gibt die Sprachausgabe erst nach einer Berührung frei – also beim ersten Tippen
// einmal stumm „sprechen“, damit spätere Antworten hörbar sind.
let speechUnlocked = false;
function unlockSpeech() {
  if (speechUnlocked || !("speechSynthesis" in window)) return;
  speechUnlocked = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}
document.addEventListener("pointerdown", unlockSpeech, { capture: true });
document.addEventListener("keydown", unlockSpeech, { capture: true });

function speak(text) {
  if (muted) return;
  const clean = text.replace(/[*_#`>]/g, "").trim();
  if (!clean || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "de-DE";
  if (germanVoice) u.voice = germanVoice;
  u.rate = 1.05;
  speechQueue++;
  setMode("speaking");
  u.onend = u.onerror = () => {
    speechQueue = Math.max(0, speechQueue - 1);
    if (speechQueue === 0 && onSpeechIdle) onSpeechIdle();
  };
  speechSynthesis.speak(u);
}

function stopSpeaking() {
  onSpeechIdle = null;
  speechQueue = 0;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// Text kommt Stück für Stück – vorlesen, sobald ein Satz fertig ist.
function makeSentenceSpeaker() {
  let buffer = "";
  return {
    push(delta) {
      buffer += delta;
      const re = /[^.!?…:\n]+[.!?…:\n]+(\s|$)/g;
      let match, last = 0;
      while ((match = re.exec(buffer))) {
        speak(match[0]);
        last = re.lastIndex;
      }
      buffer = buffer.slice(last);
    },
    flush() {
      if (buffer.trim()) speak(buffer);
      buffer = "";
    },
  };
}

// ---------------------------------------------------------------------------
// Spracherkennung

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (Recognition) {
  recognition = new Recognition();
  recognition.lang = "de-DE";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (e) => {
    let interim = "", final = "";
    for (const r of e.results) {
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    interimEl.textContent = interim || final;
    if (final.trim()) {
      recognition.stop();
      sendMessage(final.trim());
    }
  };
  recognition.onend = () => {
    listening = false;
    if (!busy && mode === "listening") setMode("idle");
  };
  recognition.onerror = (e) => {
    listening = false;
    if (e.error === "not-allowed") statusEl.textContent = "Mikrofon nicht erlaubt";
    else if (e.error !== "no-speech" && e.error !== "aborted") statusEl.textContent = `Fehler: ${e.error}`;
  };
} else {
  statusEl.textContent = "Nur Texteingabe";
  interimEl.textContent = "Für Sprache bitte Chrome, Edge oder Safari verwenden.";
}

function startListening() {
  if (!recognition || listening || busy) return;
  stopSpeaking();
  interimEl.textContent = "";
  try {
    recognition.start();
    listening = true;
    setMode("listening");
    startMeter();
  } catch {}
}

reactor.addEventListener("click", () => {
  if (speechQueue > 0) {
    // Unterbrechen und direkt zuhören.
    muted = true;
    stopSpeaking();
    if (busy) setMode("thinking");
    else startListening();
  } else if (listening) {
    recognition.stop();
  } else {
    startListening();
  }
});

// Leertaste = Sprechen (außer beim Tippen)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.closest("input, textarea, button, a")) {
    e.preventDefault();
    reactor.click();
  }
});

function renderHandsfree() {
  handsfreeBtn.setAttribute("aria-pressed", String(handsfree));
}
handsfreeBtn.addEventListener("click", () => {
  handsfree = !handsfree;
  store("handsfree", handsfree);
  renderHandsfree();
});
renderHandsfree();

// ---------------------------------------------------------------------------
// Gespräch

async function sendMessage(text) {
  if (busy) return;
  busy = true;
  muted = false;
  interimEl.textContent = text;
  replyEl.textContent = "";
  logAdd({ role: "user", text });
  setMode("thinking");

  const entry = logAdd({ role: "assistant", text: "", tools: [] });
  const speaker = makeSentenceSpeaker();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, text }),
    });
    if (res.status === 401) return void (location.href = "/login");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (line.startsWith("data: ")) handleEvent(JSON.parse(line.slice(6)), entry, speaker);
      }
    }
  } catch {
    logAdd({ role: "error", text: "Keine Verbindung zum Server." });
    replyEl.textContent = "Keine Verbindung zum Server.";
  }

  speaker.flush();
  interimEl.textContent = "";
  busy = false;
  renderWindow("protokoll");
  if (speechQueue === 0) afterReply();
  else onSpeechIdle = afterReply;
}

function afterReply() {
  onSpeechIdle = null;
  setMode("idle");
  if (handsfree && recognition) startListening();
}

const TOOL_LABELS = {
  fenster_oeffnen: "Fenster geöffnet",
  anzeigen: "Angezeigt",
  kalender_termine_abrufen: "Kalender abgefragt",
  kalender_termin_erstellen: "Termin eingetragen",
  kalender_termin_loeschen: "Termin gelöscht",
  mails_suchen: "Mails durchsucht",
  mail_lesen: "Mail gelesen",
  mail_senden: "Mail gesendet",
  aufgabe_hinzufuegen: "Aufgabe gespeichert",
  aufgaben_auflisten: "Aufgaben abgefragt",
  aufgabe_erledigen: "Aufgabe abgehakt",
  aufgabe_loeschen: "Aufgabe gelöscht",
  notiz_speichern: "Gemerkt",
  notizen_abrufen: "Gedächtnis abgefragt",
  notiz_loeschen: "Vergessen",
  design_wechseln: "Design gewechselt",
  spotify_status: "Spotify abgefragt",
  spotify_abspielen: "Musik gestartet",
  spotify_steuern: "Wiedergabe gesteuert",
  spotify_warteschlange: "In Warteschlange",
  spotify_suchen: "Spotify durchsucht",
};

function toolLabel(name) {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  const [service, tool] = name.split("__");
  return tool ? `${service}: ${tool.replace(/[-_]/g, " ")}` : name;
}

function handleEvent(ev, entry, speaker) {
  switch (ev.type) {
    case "text":
      entry.text += ev.text;
      replyEl.textContent = entry.text;
      speaker.push(ev.text);
      break;
    case "tool":
      entry.tools.push(toolLabel(ev.name));
      statusEl.textContent = toolLabel(ev.name);
      break;
    case "window":
      openWindow(ev.fenster);
      break;
    case "display":
      openDisplay(ev.titel, ev.inhalt);
      break;
    case "theme":
      applyLook({ theme: ev.design });
      renderWindow("design");
      break;
    case "refresh":
      renderWindow(ev.was);
      break;
    case "error":
      logAdd({ role: "error", text: ev.message });
      replyEl.textContent = ev.message;
      speak(ev.message);
      break;
  }
}

function logAdd(item) {
  chatLog.push(item);
  return item;
}

$("command").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("command-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  stopSpeaking();
  if (listening) recognition.abort();
  sendMessage(text);
});

$("reset").addEventListener("click", async () => {
  stopSpeaking();
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  sessionId = newSessionId();
  chatLog.length = 0;
  replyEl.textContent = "";
  interimEl.textContent = "";
  renderWindow("protokoll");
  setMode("idle");
});

// ---------------------------------------------------------------------------
// Fenster-Manager

const windows = new Map(); // key -> { el, render }
let zTop = 10;
let displayCount = 0;
const isNarrow = () => matchMedia("(max-width: 760px)").matches;

const WINDOW_DEFS = {
  kalender: { title: "Kalender · 7 Tage", render: renderCalendar, refresh: true, w: 400, h: 480 },
  aufgaben: { title: "Aufgaben", render: renderTasks, refresh: true, w: 360, h: 420 },
  notizen: { title: "Gedächtnis", render: renderNotes, refresh: true, w: 360, h: 380 },
  mails: { title: "Posteingang", render: renderMails, refresh: true, w: 440, h: 500 },
  musik: { title: "Musik", render: renderMusic, refresh: true, w: 360, h: 470, onClose: stopMusicPolling },
  design: { title: "Design & Schrift", render: renderDesign, w: 440, h: 560 },
  einstellungen: { title: "Einstellungen", render: renderSettings, w: 440, h: 580 },
  protokoll: { title: "Protokoll", render: renderLog, w: 420, h: 460 },
  verbindungen: { title: "Dienste & Verbindungen", render: renderConnections, refresh: true, w: 420, h: 480 },
};

// Freien Platz suchen: möglichst wenig Überdeckung mit anderen Fenstern und dem
// Reaktor, bevorzugt rechts oben, dann links neben der Leiste.
function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function findSpot(w, h) {
  const W = window.innerWidth, H = window.innerHeight;
  const left = 124, top = 92, bottom = H - 96;
  h = Math.min(h, bottom - top);
  w = Math.min(w, W - left - 20);
  const taken = [...windows.values()].map(({ el }) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, weight: 1 }));
  const r = reactor.getBoundingClientRect();
  taken.push({ x: r.x, y: r.y, w: r.width, h: r.height, weight: 1.6 });
  const rightX = W - w - 20;
  let best = null;
  for (let x = rightX; x >= left; x -= 24) {
    for (let y = top; y <= bottom - h; y += 24) {
      const cand = { x, y, w, h };
      let cost = taken.reduce((sum, t) => sum + overlap(cand, t) * t.weight, 0);
      // Leichte Vorliebe für die Ränder (rechts, dann links) und für oben
      cost += Math.min(rightX - x, x - left) * 40 + y * 8;
      if (!best || cost < best.cost) best = { x, y, w, h, cost };
    }
  }
  return best ?? { x: left, y: top, w, h };
}

function createWindow(key, { title, w = 380, h = 420, refresh = false, saved = true }) {
  const el = $("win-template").content.firstElementChild.cloneNode(true);
  el.dataset.key = key;
  el.querySelector(".win-title").textContent = title;
  const rect = (saved && store(`win:${key}`)) || findSpot(w, h);
  rect.x = Math.min(Math.max(0, rect.x), window.innerWidth - 120);
  rect.y = Math.min(Math.max(60, rect.y), window.innerHeight - 60);
  Object.assign(el.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });

  el.querySelector(".win-close").onclick = () => closeWindow(key);
  const refreshBtn = el.querySelector(".win-refresh");
  refreshBtn.hidden = !refresh;
  refreshBtn.onclick = () => renderWindow(key);
  el.addEventListener("pointerdown", () => focusWindow(el));

  // Größe ändern über den Eckgriff (funktioniert auch mit dem Finger)
  const grip = el.querySelector(".win-resize");
  grip.addEventListener("pointerdown", (e) => {
    if (isNarrow()) return;
    e.preventDefault();
    e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight };
    const move = (ev) => {
      el.style.width = `${Math.max(260, start.w + ev.clientX - start.x)}px`;
      el.style.height = `${Math.max(180, start.h + ev.clientY - start.y)}px`;
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      saveRect(key, el);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  });

  // Verschieben an der Titelleiste
  const head = el.querySelector(".win-head");
  head.addEventListener("pointerdown", (e) => {
    if (isNarrow() || e.target.closest("button")) return;
    const startX = e.clientX - el.offsetLeft;
    const startY = e.clientY - el.offsetTop;
    head.setPointerCapture(e.pointerId);
    const move = (ev) => {
      el.style.left = `${Math.min(Math.max(0, ev.clientX - startX), window.innerWidth - 120)}px`;
      el.style.top = `${Math.min(Math.max(0, ev.clientY - startY), window.innerHeight - 40)}px`;
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      saveRect(key, el);
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });

  // Größe merken
  let t;
  new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => saveRect(key, el), 300);
  }).observe(el);

  desktop.appendChild(el);
  focusWindow(el);
  if (isNarrow()) el.scrollIntoView({ behavior: "smooth", block: "start" });
  return el;
}

function saveRect(key, el) {
  if (isNarrow() || key.startsWith("anz-") || !el.isConnected) return;
  store(`win:${key}`, { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
}

function focusWindow(el) {
  document.querySelectorAll(".win.focused").forEach((w) => w.classList.remove("focused"));
  el.classList.add("focused");
  el.style.zIndex = ++zTop;
}

function openWindow(key) {
  const def = WINDOW_DEFS[key];
  if (!def) return;
  const existing = windows.get(key);
  if (existing) {
    focusWindow(existing.el);
    existing.el.classList.remove("flash");
    void existing.el.offsetWidth;
    existing.el.classList.add("flash");
    renderWindow(key);
    return;
  }
  const el = createWindow(key, def);
  windows.set(key, { el, render: def.render });
  renderWindow(key);
  syncDock();
}

function closeWindow(key) {
  WINDOW_DEFS[key]?.onClose?.();
  windows.get(key)?.el.remove();
  windows.delete(key);
  syncDock();
  saveOpen();
}

function renderWindow(key) {
  const w = windows.get(key);
  if (w) w.render(w.el.querySelector(".win-body"));
  if (key === "verbindungen") loadChips();
  saveOpen();
}

function syncDock() {
  document.querySelectorAll("[data-open]").forEach((b) => b.classList.toggle("active", windows.has(b.dataset.open)));
}

function saveOpen() {
  store("openWindows", [...windows.keys()].filter((k) => WINDOW_DEFS[k]));
}

document.querySelectorAll("[data-open]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.open;
    if (windows.has(key) && windows.get(key).el.classList.contains("focused")) closeWindow(key);
    else openWindow(key);
  });
});
$("chips").addEventListener("click", () => openWindow("verbindungen"));

// Freie Anzeige-Fenster, die Timi selbst öffnet
function openDisplay(title, content) {
  const key = `anz-${++displayCount}`;
  const el = createWindow(key, { title, w: 420, h: 440, saved: false });
  el.querySelector(".win-body").innerHTML = `<div class="rich">${richText(content)}</div>`;
  windows.set(key, { el, render: () => {} });
}

// Einfache Formatierung: "# " Überschrift, "- " Aufzählung, Rest Absätze
function richText(text) {
  const out = [];
  let list = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-•*] /.test(line)) {
      list ??= [];
      list.push(`<li>${esc(line.replace(/^\s*[-•*] /, ""))}</li>`);
      continue;
    }
    if (list) {
      out.push(`<ul>${list.join("")}</ul>`);
      list = null;
    }
    if (/^#+ /.test(line)) out.push(`<h3>${esc(line.replace(/^#+ /, ""))}</h3>`);
    else if (line.trim()) out.push(`<p>${esc(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join("")}</ul>`);
  return out.join("");
}

// ---------------------------------------------------------------------------
// Fensterinhalte

function notConnected(body, message) {
  body.innerHTML = `<p class="err">${esc(message)}</p><button class="btn">Verbindungen öffnen</button>`;
  body.querySelector("button").onclick = () => openWindow("verbindungen");
}

async function renderCalendar(body) {
  body.innerHTML = `<p class="hint">Lade Termine…</p>`;
  const data = await getJSON("/api/kalender?tage=7").catch(() => ({ fehler: "Server nicht erreichbar." }));
  if (data.fehler) return notConnected(body, data.fehler);
  if (!data.termine.length) return (body.innerHTML = `<p class="empty">Keine Termine in den nächsten 7 Tagen.</p>`);
  const fmtDay = (s) => new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = (s) => new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  let html = "", lastDay = "";
  for (const t of data.termine) {
    const day = fmtDay(t.start);
    if (day !== lastDay) html += `<div class="day">${esc(day)}</div>`;
    lastDay = day;
    const time = t.ganztaegig ? "Ganztägig" : `${fmtTime(t.start)}–${fmtTime(t.ende)}`;
    html += `<div class="ev"><span class="ev-time">${time}</span><span><span class="ev-title">${esc(t.titel)}</span>
      <span class="ev-sub">${esc([t.ort, t.kalender].filter(Boolean).join(" · "))}</span></span></div>`;
  }
  body.innerHTML = html;
}

async function renderTasks(body) {
  const { tasks } = await getJSON("/api/aufgaben");
  if (!tasks.length) return (body.innerHTML = `<p class="empty">Keine Aufgaben. Sag zum Beispiel: „Erinnere mich, morgen Mama anzurufen.“</p>`);
  const sorted = [...tasks.filter((t) => !t.erledigt), ...tasks.filter((t) => t.erledigt)];
  body.innerHTML = `<ul class="list">${sorted
    .map((t) => {
      const due = t.faellig ? t.faellig.split("-").reverse().join(".") : "";
      return `<li class="${t.erledigt ? "done" : ""}"><input type="checkbox" data-id="${esc(t.id)}" ${t.erledigt ? "checked" : ""}/>
        <span class="txt">${esc(t.titel)}</span><span class="meta">${esc(due)}</span></li>`;
    })
    .join("")}</ul>`;
  body.querySelectorAll("input[data-id]").forEach((box) => {
    box.onchange = async () => {
      await fetch(`/api/aufgaben/${box.dataset.id}/umschalten`, { method: "POST" });
      renderTasks(body);
    };
  });
}

async function renderNotes(body) {
  const { notes } = await getJSON("/api/aufgaben");
  if (!notes.length) return (body.innerHTML = `<p class="empty">Noch nichts gespeichert. Sag zum Beispiel: „Merk dir, dass ich vegetarisch esse.“</p>`);
  body.innerHTML = `<ul class="list">${notes
    .map((n) => `<li><span class="txt">${esc(n.inhalt)}</span><button class="x" data-id="${esc(n.id)}" title="Vergessen">✕</button></li>`)
    .join("")}</ul>`;
  body.querySelectorAll("button[data-id]").forEach((b) => {
    b.onclick = async () => {
      await fetch(`/api/notizen/${b.dataset.id}`, { method: "DELETE" });
      renderNotes(body);
    };
  });
}

async function renderMails(body) {
  body.innerHTML = `<p class="hint">Lade Posteingang…</p>`;
  const data = await getJSON("/api/mails").catch(() => ({ fehler: "Server nicht erreichbar." }));
  if (data.fehler) return notConnected(body, data.fehler);
  if (!data.mails.length) return (body.innerHTML = `<p class="empty">Posteingang ist leer.</p>`);
  const fmt = (d) => {
    const date = new Date(d);
    return isNaN(date) ? "" : date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };
  body.innerHTML = `<ul class="list">${data.mails
    .map(
      (m) => `<li class="mail ${m.ungelesen ? "unread" : ""}" data-id="${esc(m.id)}">
      <span class="from"><span>${esc(m.von.replace(/<.*>/, "").trim() || m.von)}</span><span class="meta">${fmt(m.datum)}</span></span>
      <span class="subj">${esc(m.betreff || "(kein Betreff)")}</span><span class="snip">${esc(m.vorschau)}</span></li>`,
    )
    .join("")}</ul>`;
  body.querySelectorAll(".mail").forEach((li) => {
    li.onclick = async () => {
      const m = await getJSON(`/api/mails/${li.dataset.id}`);
      if (m.fehler) return openDisplay("Fehler", m.fehler);
      openDisplay(m.betreff || "Mail", `Von: ${m.von}\nAn: ${m.an}\nDatum: ${m.datum}\n\n${m.text}`);
    };
  });
}

// Musik

let musicTimer = null;
function stopMusicPolling() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function fmtMs(ms) {
  const s = Math.floor((ms ?? 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function renderMusic(body) {
  if (!musicTimer) {
    musicTimer = setInterval(() => {
      const w = windows.get("musik");
      if (w) renderMusic(w.el.querySelector(".win-body"));
      else stopMusicPolling();
    }, 5000);
  }
  const data = await getJSON("/api/spotify").catch(() => ({ fehler: "Server nicht erreichbar." }));
  if (data.fehler) {
    stopMusicPolling();
    return notConnected(body, data.fehler);
  }
  const t = data.titel;
  const pct = t?.dauer_ms ? Math.min(100, (data.fortschritt_ms / t.dauer_ms) * 100) : 0;
  body.innerHTML = `
    <div class="player">
      <div class="cover">${t?.cover ? `<img src="${esc(t.cover)}" alt="" />` : `<span>♪</span>`}</div>
      <div class="track">${esc(t?.titel ?? "Gerade läuft nichts")}</div>
      <div class="artist">${esc(t?.kuenstler ?? "Sag zum Beispiel: Spiel etwas von Daft Punk")}</div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="times"><span>${fmtMs(data.fortschritt_ms)}</span><span>${fmtMs(t?.dauer_ms)}</span></div>
      <div class="controls">
        <button data-act="zurueck" title="Zurück">⏮</button>
        <button data-act="${data.spielt ? "pause" : "fortsetzen"}" class="main" title="${data.spielt ? "Pause" : "Abspielen"}">${data.spielt ? "❚❚" : "▶"}</button>
        <button data-act="weiter" title="Weiter">⏭</button>
      </div>
      <label class="volume">Lautstärke <input type="range" min="0" max="100" value="${data.lautstaerke ?? 50}" /></label>
      <div class="device">${data.geraet ? `Gerät: ${esc(data.geraet)}` : ""}</div>
    </div>`;
  body.querySelectorAll("[data-act]").forEach((b) => {
    b.onclick = () => musicControl(body, { aktion: b.dataset.act });
  });
  body.querySelector(".volume input").onchange = (e) => musicControl(body, { aktion: "lautstaerke", lautstaerke: Number(e.target.value) });
}

async function musicControl(body, payload) {
  const res = await getJSON("/api/spotify/steuern", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.fehler) openDisplay("Spotify", res.fehler);
  setTimeout(() => renderMusic(body), 400);
}

// Einstellungen

const SETTINGS = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic-API-Schlüssel (erforderlich)", secret: true, hint: "sk-ant-…" },
  { key: "ASSISTANT_NAME", label: "Name des Assistenten (wirkt nach Neustart)", hint: "Timi" },
  { key: "GOOGLE_CLIENT_ID", label: "Google Client-ID", hint: "….apps.googleusercontent.com" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google Clientschlüssel", secret: true },
  { key: "SPOTIFY_CLIENT_ID", label: "Spotify Client ID" },
  { key: "SPOTIFY_CLIENT_SECRET", label: "Spotify Client Secret", secret: true },
];

async function renderSettings(body) {
  const data = await getJSON("/api/einstellungen");
  const ready = data.gesetzt.ANTHROPIC_API_KEY;
  body.innerHTML = `
    ${ready ? "" : `<div class="welcome">Willkommen! Trag zuerst deinen API-Schlüssel ein. Den bekommst du auf
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</div>`}
    <form class="settings-form">
      ${SETTINGS.map(
        (s) => `<label class="set-row">${esc(s.label)} ${data.gesetzt[s.key] ? `<span class="ok">✓ gespeichert</span>` : ""}
          <input name="${s.key}" type="${s.secret ? "password" : "text"}" autocomplete="off"
            placeholder="${data.gesetzt[s.key] ? "unverändert lassen" : esc(s.hint ?? "")}" /></label>`,
      ).join("")}
      <button class="btn" type="submit">Speichern</button>
    </form>
    <p class="hint">Wie du die Google- und Spotify-Zugänge bekommst, steht in der Anleitung (README).
      ${data.cloud ? "Gespeichert wird nur auf deinem eigenen Timi-Server." : `Gespeichert wird nur auf diesem Rechner, in ${esc(data.datenordner)}.`}</p>
    <div class="sect">System</div>
    <p class="hint">Adresse: ${esc(data.adresse)}</p>
    ${data.cloud ? `<button class="btn ghost" data-logout>Abmelden</button>` : `<button class="btn ghost" data-quit>Timi beenden</button>`}`;
  body.querySelector(".settings-form").onsubmit = async (e) => {
    e.preventDefault();
    const changes = {};
    for (const [k, v] of new FormData(e.target)) if (v.trim()) changes[k] = v.trim();
    await getJSON("/api/einstellungen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    renderSettings(body);
    loadChips();
    if (changes.ANTHROPIC_API_KEY) replyEl.textContent = "Alles bereit. Tipp auf den Reaktor und sprich los.";
  };
  body.querySelector("[data-logout]")?.addEventListener("click", async () => {
    await fetch("/api/abmelden", { method: "POST" });
    location.href = "/login";
  });
  const quit = body.querySelector("[data-quit]");
  if (quit) quit.onclick = async () => {
    if (!confirm("Timi beenden?")) return;
    await fetch("/api/beenden", { method: "POST" }).catch(() => {});
    document.body.innerHTML = `<p style="padding:40px;text-align:center">Timi wurde beendet. Du kannst dieses Fenster schließen.</p>`;
  };
}

// Design

function renderDesign(body) {
  const fontOptions = (selected) =>
    Object.entries(FONTS).map(([id, f]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${esc(f.name)}</option>`).join("");
  body.innerHTML = `
    <div class="sect">Design</div>
    <div class="themes">
      ${THEMES.map(
        (t) => `<button class="theme-card ${t.id === look.theme ? "active" : ""}" data-theme-id="${t.id}"
          style="--tb:${t.bg};--ta:${t.accent};--tt:${t.text};--tg:${t.glow ?? t.accent}">
          <span class="theme-preview"><span class="theme-ring"></span></span>
          <span class="theme-name" style="font-family:'${t.font}'">${esc(t.name)}</span>
        </button>`,
      ).join("")}
    </div>
    <div class="sect">Schrift</div>
    <label class="field">Überschriften<select data-font="display">${fontOptions(look.display)}</select></label>
    <label class="field">Text<select data-font="body">${fontOptions(look.body)}</select></label>
    <label class="field">Schriftgröße <b>${Math.round(look.fs * 100)} %</b>
      <input type="range" min="0.85" max="1.3" step="0.05" value="${look.fs}" data-fs /></label>
    <p class="hint">Du kannst das Design auch per Sprache wechseln, zum Beispiel: „Wechsel auf Matrix.“</p>`;
  body.querySelectorAll("[data-theme-id]").forEach((b) => {
    b.onclick = () => {
      applyLook({ theme: b.dataset.themeId });
      renderDesign(body);
    };
  });
  body.querySelectorAll("[data-font]").forEach((sel) => {
    sel.onchange = () => applyLook({ [sel.dataset.font]: sel.value });
  });
  const fs = body.querySelector("[data-fs]");
  fs.oninput = () => {
    applyLook({ fs: Number(fs.value) });
    fs.previousElementSibling.textContent = `${Math.round(look.fs * 100)} %`;
  };
}

function renderLog(body) {
  if (!chatLog.length) return (body.innerHTML = `<p class="empty">Noch kein Gespräch.</p>`);
  const who = { user: "Du", assistant: "Timi", error: "System" };
  body.innerHTML = chatLog
    .map(
      (m) => `<div class="msg ${m.role}"><div class="who">${who[m.role]}</div>
      ${m.tools?.length ? `<div class="tool">⟡ ${esc(m.tools.join(" · "))}</div>` : ""}
      <div>${esc(m.text)}</div></div>`,
    )
    .join("");
  body.scrollTop = body.scrollHeight;
}

async function renderConnections(body) {
  const data = await getJSON("/api/verbindungen");
  const g = data.google;
  let googleAction, googleSub, googleDot = "";
  if (!g.configured) {
    googleSub = "Noch nicht eingerichtet: Zugangsdaten in der .env fehlen (Anleitung in der README)";
    googleAction = "";
  } else if (g.connected && g.needsReconnect) {
    googleDot = "warn";
    googleSub = "Neue Berechtigungen (Gmail) – bitte einmal neu verbinden";
    googleAction = `<a class="btn" href="/auth/google">Neu verbinden</a>`;
  } else if (g.connected) {
    googleDot = "on";
    googleSub = "Kalender und Gmail";
    googleAction = `<button class="btn ghost" data-google-off>Trennen</button>`;
  } else {
    googleSub = "Kalender und Gmail";
    googleAction = `<a class="btn" href="/auth/google">Verbinden</a>`;
  }

  body.innerHTML = `
    <div class="sect">Google</div>
    <div class="conn"><span class="dot ${googleDot}"></span><span class="name">Google<small>${esc(googleSub)}</small></span>${googleAction}</div>
    <div class="sect">Spotify</div>
    ${spotifyRow(data.spotify)}
    <div class="sect">Weitere Dienste</div>
    ${data.dienste
      .map(
        (d) => `<div class="conn"><span class="dot ${d.connected ? "on" : ""}"></span>
        <span class="name">${esc(d.name)}<small>${d.connected ? `verbunden${d.tools ? ` · ${d.tools} Funktionen` : ""}` : esc(d.url)}</small></span>
        ${d.connected
          ? `<button class="btn ghost" data-off="${esc(d.id)}">Trennen</button>`
          : `<a class="btn" href="/auth/mcp/${encodeURIComponent(d.id)}">Verbinden</a><button class="btn ghost" data-del="${esc(d.id)}" title="Entfernen">✕</button>`}
      </div>`,
      )
      .join("")}
    <form class="add-form">
      <div class="sect">Dienst hinzufügen</div>
      <input name="name" placeholder="Name, z. B. Linear" required />
      <input name="url" placeholder="MCP-Adresse, z. B. https://mcp.linear.app/mcp" required />
      <button class="btn" type="submit">Hinzufügen</button>
      <p class="hint">Jeder Dienst mit einer öffentlichen MCP-Adresse lässt sich hier anbinden.</p>
    </form>`;

  body.querySelector("[data-google-off]")?.addEventListener("click", async () => {
    await fetch("/api/google/trennen", { method: "POST" });
    renderWindow("verbindungen");
  });
  body.querySelector("[data-spotify-off]")?.addEventListener("click", async () => {
    await fetch("/api/spotify/trennen", { method: "POST" });
    renderWindow("verbindungen");
  });
  body.querySelectorAll("[data-off]").forEach((b) => {
    b.onclick = async () => {
      await fetch(`/api/verbindungen/${b.dataset.off}/trennen`, { method: "POST" });
      renderWindow("verbindungen");
    };
  });
  body.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      await fetch(`/api/verbindungen/${b.dataset.del}`, { method: "DELETE" });
      renderWindow("verbindungen");
    };
  });
  body.querySelector(".add-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const res = await getJSON("/api/verbindungen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), url: form.get("url") }),
    });
    if (res.error) return alert(res.error);
    renderWindow("verbindungen");
  };
}

function spotifyRow(s) {
  let sub, action, dot = "";
  if (!s.configured) {
    sub = "Noch nicht eingerichtet: Zugangsdaten in der .env fehlen (Anleitung in der README)";
    action = "";
  } else if (s.connected) {
    dot = "on";
    sub = "Abspielen, steuern, suchen";
    action = `<button class="btn ghost" data-spotify-off>Trennen</button>`;
  } else {
    sub = "Abspielen, steuern, suchen";
    action = `<a class="btn" href="/auth/spotify">Verbinden</a>`;
  }
  return `<div class="conn"><span class="dot ${dot}"></span><span class="name">Spotify<small>${esc(sub)}</small></span>${action}</div>`;
}

// Statusanzeige oben rechts
async function loadChips() {
  const data = await getJSON("/api/verbindungen").catch(() => null);
  if (!data) return;
  const chips = [];
  if (data.google.configured) {
    chips.push({ name: "Google", cls: data.google.needsReconnect ? "warn" : data.google.connected ? "on" : "" });
  }
  if (data.spotify.configured) chips.push({ name: "Spotify", cls: data.spotify.connected ? "on" : "" });
  for (const d of data.dienste) chips.push({ name: d.name, cls: d.connected ? "on" : "" });
  $("chips").innerHTML = chips.map((c) => `<span class="chip ${c.cls}">${esc(c.name)}</span>`).join("");
}

// ---------------------------------------------------------------------------
// Start

setMode("idle");
loadChips();
getJSON("/api/einstellungen")
  .then((d) => {
    if (!d.gesetzt.ANTHROPIC_API_KEY) openWindow("einstellungen");
  })
  .catch(() => {});
for (const key of store("openWindows") ?? []) openWindow(key);

const params = new URLSearchParams(location.search);
if (params.has("verbunden")) {
  history.replaceState(null, "", "/");
  openWindow("verbindungen");
  replyEl.textContent = "Verbindung hergestellt.";
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
