// Sprachassistent – Browser
// Spracherkennung und Sprachausgabe laufen über die Web Speech API des Browsers.

const $ = (id) => document.getElementById(id);
const micBtn = $("mic");
const statusEl = $("status");
const interimEl = $("interim");
const logEl = $("log");
const handsfree = $("handsfree");

let sessionId = localStorageGet("sessionId") || newSessionId();
let busy = false;

function newSessionId() {
  const id = crypto.randomUUID();
  localStorageSet("sessionId", id);
  return id;
}
function localStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function localStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

// ---------------------------------------------------------------------------
// Sprachausgabe

let germanVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("de"));
  // Natürlich klingende Stimmen bevorzugen, falls vorhanden.
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
    if (!busy) setMode("idle");
  };
  recognition.onerror = (e) => {
    listening = false;
    if (e.error === "not-allowed") setStatus("Bitte erlaube den Zugriff aufs Mikrofon.");
    else if (e.error !== "no-speech" && e.error !== "aborted") setStatus(`Spracherkennung: ${e.error}`);
  };
} else {
  setStatus("Dein Browser unterstützt keine Spracherkennung. Nimm Chrome, Edge oder Safari – oder schreib unten.");
}

function startListening() {
  if (!recognition || listening || busy) return;
  stopSpeaking();
  interimEl.textContent = "";
  try {
    recognition.start();
    listening = true;
    setMode("listening");
  } catch {}
}

micBtn.addEventListener("click", () => {
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

// ---------------------------------------------------------------------------
// Gespräch

async function sendMessage(text) {
  if (busy) return;
  busy = true;
  muted = false;
  interimEl.textContent = "";
  addMsg("user", text);
  setMode("thinking");

  const bubble = addMsg("assistant", "");
  const speaker = makeSentenceSpeaker();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, text }),
    });
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
        if (!line.startsWith("data: ")) continue;
        handleEvent(JSON.parse(line.slice(6)), bubble, speaker);
      }
    }
  } catch {
    addMsg("error", "Keine Verbindung zum Server.");
  }

  speaker.flush();
  if (!bubble.textContent) bubble.remove();
  busy = false;
  if (speechQueue === 0) afterReply();
  else onSpeechIdle = afterReply;
}

function afterReply() {
  onSpeechIdle = null;
  setMode("idle");
  if (handsfree.checked && recognition) startListening();
}

const TOOL_LABELS = {
  kalender_termine_abrufen: "Kalender angeschaut",
  kalender_termin_erstellen: "Termin eingetragen",
  kalender_termin_loeschen: "Termin gelöscht",
  aufgabe_hinzufuegen: "Aufgabe gespeichert",
  aufgaben_auflisten: "Aufgaben angeschaut",
  aufgabe_erledigen: "Aufgabe abgehakt",
  aufgabe_loeschen: "Aufgabe gelöscht",
  notiz_speichern: "Gemerkt",
  notizen_abrufen: "Notizen nachgeschaut",
  notiz_loeschen: "Notiz gelöscht",
};

function handleEvent(ev, bubble, speaker) {
  if (ev.type === "text") {
    bubble.textContent += ev.text;
    speaker.push(ev.text);
    scrollDown();
  } else if (ev.type === "tool") {
    const note = document.createElement("div");
    note.className = "tool-note";
    note.textContent = "· " + (TOOL_LABELS[ev.name] || ev.name);
    logEl.insertBefore(note, bubble);
  } else if (ev.type === "tasks_changed") {
    loadTasks();
  } else if (ev.type === "error") {
    addMsg("error", ev.message);
    speak(ev.message);
  }
}

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  logEl.appendChild(div);
  scrollDown();
  return div;
}
function scrollDown() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function setStatus(text) {
  statusEl.textContent = text;
}
function setMode(mode) {
  micBtn.classList.remove("listening", "speaking", "thinking");
  if (mode !== "idle") micBtn.classList.add(mode);
  setStatus({
    idle: "Tippe aufs Mikrofon und sprich los.",
    listening: "Ich höre zu…",
    thinking: "Moment…",
    speaking: "Tippen zum Unterbrechen",
  }[mode]);
}

$("textform").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("textinput");
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
  logEl.innerHTML = "";
  setMode("idle");
});

// ---------------------------------------------------------------------------
// Aufgabenliste

async function loadTasks() {
  const { tasks } = await (await fetch("/api/tasks")).json();
  const list = $("tasklist");
  list.innerHTML = "";
  const open = tasks.filter((t) => !t.erledigt);
  $("taskcount").textContent = open.length ? `(${open.length} offen)` : "";
  if (!tasks.length) {
    list.innerHTML = '<li class="empty">Noch keine Aufgaben. Sag einfach: „Erinnere mich daran, …“</li>';
    return;
  }
  for (const t of [...open, ...tasks.filter((t) => t.erledigt)]) {
    const li = document.createElement("li");
    if (t.erledigt) li.classList.add("done");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = t.erledigt;
    box.onchange = async () => {
      await fetch(`/api/tasks/${t.id}/toggle`, { method: "POST" });
      loadTasks();
    };
    const label = document.createElement("span");
    label.textContent = t.titel;
    li.append(box, label);
    if (t.faellig) {
      const due = document.createElement("small");
      due.className = "due";
      const [y, m, d] = t.faellig.split("-");
      due.textContent = d && m ? `${d}.${m}.${y}` : t.faellig;
      li.append(due);
    }
    list.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Google Kalender

async function loadGoogleStatus() {
  const btn = $("gcal");
  const { configured, connected } = await (await fetch("/api/google/status")).json();
  btn.hidden = !configured;
  btn.textContent = connected ? "Kalender ✓" : "Kalender verbinden";
  btn.title = connected ? "Verbunden – klicken zum Trennen" : "Google Kalender verbinden";
  btn.onclick = async () => {
    if (!connected) return (location.href = "/auth/google");
    if (!confirm("Verbindung zum Google Kalender trennen?")) return;
    await fetch("/api/google/disconnect", { method: "POST" });
    loadGoogleStatus();
  };
}

setMode("idle");
loadTasks();
loadGoogleStatus();
if (location.search.includes("kalender=verbunden")) {
  history.replaceState(null, "", "/");
  setStatus("Kalender verbunden! Frag mich zum Beispiel: Was steht heute an?");
}
