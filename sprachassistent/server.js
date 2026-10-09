// Sprachassistent – Backend
// Hält die Zugangsdaten geheim, führt das Gespräch mit Claude und stellt die
// Werkzeuge bereit: Aufgaben, Notizen, Google (Kalender, Gmail), verbundene
// Dienste (Notion, Canva, …), Websuche und die Fenster der Oberfläche.

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { APP_DIR, DATA_DIR, IS_PACKAGED, dataPath, loadSettings, saveSettings, SETTING_KEYS } from "./paths.js";
import {
  CALENDAR_TOOLS,
  GMAIL_TOOLS,
  executeGoogleTool,
  googleConfigured,
  googleConnected,
  googleNeedsReconnect,
  authUrl,
  configureGoogle,
  handleCallback,
  disconnect,
  resetGoogle,
} from "./google.js";
import {
  configureMcp,
  connectorStatus,
  startConnect,
  finishConnect,
  disconnectConnector,
  addConnector,
  removeConnector,
  mcpTools,
  isMcpTool,
  executeMcpTool,
} from "./mcp.js";
import {
  SPOTIFY_TOOLS,
  executeSpotifyTool,
  configureSpotify,
  spotifyConfigured,
  spotifyConnected,
  spotifyAuthUrl,
  spotifyCallback,
  spotifyDisconnect,
  nowPlaying,
  control,
  spotifyMessage,
} from "./spotify.js";

loadSettings();

const DATA_FILE = dataPath("store.json");
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const MODEL = process.env.ASSISTANT_MODEL ?? "claude-opus-5-5";
// Für ein flüssiges Gespräch zählt Tempo mehr als Tiefe – "low" ist hier der beste Startpunkt.
const EFFORT = process.env.ASSISTANT_EFFORT ?? "low";
const NAME = process.env.ASSISTANT_NAME ?? "Timi";
const TIMEZONE = process.env.TZ_USER ?? "Europe/Berlin";

configureGoogle(process.env.GOOGLE_REDIRECT_URI ?? `${BASE_URL}/auth/google/callback`);
configureMcp(`${BASE_URL}/auth/mcp/callback`);
// Spotify akzeptiert für lokale Apps nur 127.0.0.1, nicht "localhost".
configureSpotify(process.env.SPOTIFY_REDIRECT_URI ?? `http://127.0.0.1:${PORT}/auth/spotify/callback`);

let client = new Anthropic();

const SYSTEM_PROMPT = `Du bist ${NAME}, der persönliche KI-Assistent des Nutzers, ein bisschen wie JARVIS: souverän, aufmerksam, vorausdenkend und mit einem trockenen, freundlichen Humor. Du sprichst Deutsch und duzt den Nutzer.

Deine Antworten werden laut vorgelesen. Deshalb:
- Sprich kurz und natürlich, meist ein bis drei Sätze. Längere Erklärungen nur, wenn ausdrücklich gewünscht.
- Kein Markdown, keine Aufzählungszeichen, keine Emojis, keine Links im gesprochenen Text.
- Zahlen, Uhrzeiten und Daten so formulieren, dass sie gut vorlesbar sind.

Die Oberfläche hat Fenster. Nutze sie:
- Wenn der Nutzer etwas sehen will (Kalender, Aufgaben, Notizen, Mails, Musik, Verbindungen, Design, Gesprächsprotokoll), öffne das passende Fenster mit fenster_oeffnen.
- Wenn er ein anderes Aussehen möchte, wechsle das Design mit design_wechseln.
- Wenn du viel Information hast (Listen, Suchergebnisse, Mailtexte, Entwürfe, Pläne, Rezepte), zeig die Details mit anzeigen in einem eigenen Fenster und fasse sie mündlich nur kurz zusammen. Im Fenster darfst du einfache Formatierung nutzen: Zeilen, die mit "- " beginnen, und Überschriften mit "# ".

Du hilfst bei allem im Alltag:
- Aufgaben: Biete an, Dinge auf die Aufgabenliste zu setzen, oder tu es direkt, wenn der Nutzer darum bittet.
- Merken: Speichere Persönliches, das später nützlich ist (Vorlieben, Namen, Ziele), als Notiz. Schau in deine Notizen, wenn Wissen über den Nutzer hilft.
- Kalender: Schau nach, wenn er nach Terminen, seinem Tag oder seiner Woche fragt oder ein neuer Termin kollidieren könnte. Bestätige neue Termine kurz mit Tag und Uhrzeit.
- Mails: Fasse Mails kurz zusammen. Bevor du eine Mail sendest, lies Empfänger, Betreff und Kern des Inhalts vor und warte auf ein klares Ja.
- Musik: Über Spotify spielst du Songs, Künstler, Alben und Playlists ab und steuerst die Wiedergabe. Bei Wünschen wie "spiel was zum Entspannen" such eine passende Playlist. Bestätige nur ganz kurz, was läuft, denn die Musik spricht für sich.
- Verbundene Dienste: Werkzeuge mit einem Dienstnamen in eckigen Klammern gehören zu verbundenen Diensten wie Notion. Nutze sie, wenn es passt.
- Aktuelles (Wetter, Nachrichten, Öffnungszeiten, Fakten) suchst du im Web.
- Vor allem, was sich nicht rückgängig machen lässt (löschen, senden, bestellen, veröffentlichen), fragst du kurz nach.
- Wenn ein Dienst nicht verbunden ist, sag es und schlag vor, ihn im Fenster Verbindungen zu verbinden. Öffne das Fenster dafür.

Jede Nutzernachricht beginnt mit einer Zeitangabe in eckigen Klammern. Nutze sie für Datumsfragen, erwähne sie aber nicht von dir aus.
Die Spracherkennung macht manchmal Fehler. Wenn etwas komisch klingt, rate sinnvoll oder frag kurz nach.`;

// ---------------------------------------------------------------------------
// Datenspeicher (einfache JSON-Datei)

async function loadStore() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    return { tasks: [], notes: [] };
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

// ---------------------------------------------------------------------------
// Werkzeuge

const str = { type: "string" };
const WINDOWS = ["kalender", "aufgaben", "notizen", "mails", "musik", "verbindungen", "design", "protokoll"];
const THEMES = ["jarvis", "mark", "matrix", "synthwave", "nordlicht", "tag"];

const LOCAL_TOOLS = [
  {
    name: "fenster_oeffnen",
    description: "Öffnet ein Fenster der Oberfläche, damit der Nutzer die Inhalte sieht.",
    input_schema: {
      type: "object",
      properties: { fenster: { type: "string", enum: WINDOWS } },
      required: ["fenster"],
    },
  },
  {
    name: "anzeigen",
    description:
      "Zeigt Informationen in einem eigenen Fenster an (Listen, Suchergebnisse, Mailtexte, Entwürfe, Pläne). Zeilen mit '- ' werden zu Aufzählungen, Zeilen mit '# ' zu Überschriften.",
    input_schema: {
      type: "object",
      properties: { titel: str, inhalt: str },
      required: ["titel", "inhalt"],
    },
  },
  {
    name: "design_wechseln",
    description:
      "Wechselt das Aussehen der Oberfläche. jarvis: Cyan-Hologramm (Standard), mark: Iron-Man-Rot und Gold, matrix: grüner Code, synthwave: Neon-Pink, nordlicht: Türkis und Violett, tag: hell.",
    input_schema: {
      type: "object",
      properties: { design: { type: "string", enum: THEMES } },
      required: ["design"],
    },
  },
  {
    name: "aufgabe_hinzufuegen",
    description: "Fügt eine Aufgabe zur Aufgabenliste des Nutzers hinzu.",
    input_schema: {
      type: "object",
      properties: {
        titel: { ...str, description: "Kurze Beschreibung der Aufgabe" },
        faellig: { ...str, description: "Optionales Fälligkeitsdatum im Format JJJJ-MM-TT" },
      },
      required: ["titel"],
    },
  },
  {
    name: "aufgaben_auflisten",
    description: "Listet die Aufgaben des Nutzers auf.",
    input_schema: {
      type: "object",
      properties: { auch_erledigte: { type: "boolean", description: "Auch erledigte Aufgaben anzeigen" } },
    },
  },
  {
    name: "aufgabe_erledigen",
    description: "Markiert eine Aufgabe als erledigt. Die ID bekommst du über aufgaben_auflisten.",
    input_schema: { type: "object", properties: { id: str }, required: ["id"] },
  },
  {
    name: "aufgabe_loeschen",
    description: "Löscht eine Aufgabe dauerhaft. Die ID bekommst du über aufgaben_auflisten.",
    input_schema: { type: "object", properties: { id: str }, required: ["id"] },
  },
  {
    name: "notiz_speichern",
    description: "Speichert etwas, das du dir über den Nutzer merken sollst (Vorlieben, Fakten, Ziele, Personen).",
    input_schema: { type: "object", properties: { inhalt: str }, required: ["inhalt"] },
  },
  {
    name: "notizen_abrufen",
    description: "Ruft alle gespeicherten Notizen über den Nutzer ab.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "notiz_loeschen",
    description: "Löscht eine Notiz, die nicht mehr stimmt. Die ID bekommst du über notizen_abrufen.",
    input_schema: { type: "object", properties: { id: str }, required: ["id"] },
  },
];

const BUILTIN_TOOLS = [...LOCAL_TOOLS, ...CALENDAR_TOOLS, ...GMAIL_TOOLS, ...SPOTIFY_TOOLS];
const SERVER_TOOLS = [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }];

// Feste Werkzeuge zuerst, verbundene Dienste sortiert dahinter – so bleibt der
// Anfang der Anfrage gleich und kann zwischengespeichert werden.
async function allTools() {
  const tools = [...BUILTIN_TOOLS, ...(await mcpTools())].map((t) => ({ ...t, eager_input_streaming: true }));
  return [...tools, ...SERVER_TOOLS];
}

// Die Eingaben werden gestreamt und vom Server nicht mehr geprüft – daher hier validieren.
function validateInput(name, input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const schema = BUILTIN_TOOLS.find((t) => t.name === name)?.input_schema;
  if (!schema) return isMcpTool(name);
  for (const key of schema.required ?? []) {
    if (typeof input[key] !== "string" || input[key].trim() === "") return false;
  }
  return true;
}

async function executeTool(name, input, send) {
  if (name.startsWith("kalender_") || name.startsWith("mail")) {
    const result = await executeGoogleTool(name, input, TIMEZONE);
    if (!result.fehler && name !== "mails_suchen" && name !== "mail_lesen") {
      send({ type: "refresh", was: name.startsWith("kalender_") ? "kalender" : "mails" });
    }
    return result;
  }
  if (name.startsWith("spotify_")) {
    const result = await executeSpotifyTool(name, input);
    if (!result.fehler && name !== "spotify_suchen") send({ type: "refresh", was: "musik" });
    return result;
  }
  if (isMcpTool(name)) return executeMcpTool(name, input);

  switch (name) {
    case "fenster_oeffnen":
      if (!WINDOWS.includes(input.fenster)) return { fehler: `Unbekanntes Fenster: ${input.fenster}` };
      send({ type: "window", fenster: input.fenster });
      return { ok: true };
    case "design_wechseln":
      if (!THEMES.includes(input.design)) return { fehler: `Unbekanntes Design: ${input.design}` };
      send({ type: "theme", design: input.design });
      return { ok: true };
    case "anzeigen":
      send({ type: "display", titel: input.titel, inhalt: input.inhalt });
      return { ok: true };
  }

  const store = await loadStore();
  const changed = (was) => send({ type: "refresh", was });
  switch (name) {
    case "aufgabe_hinzufuegen": {
      const task = {
        id: randomUUID().slice(0, 8),
        titel: input.titel.trim(),
        faellig: input.faellig || null,
        erledigt: false,
        erstellt: new Date().toISOString(),
      };
      store.tasks.push(task);
      await saveStore(store);
      changed("aufgaben");
      return { ok: true, aufgabe: task };
    }
    case "aufgaben_auflisten": {
      const tasks = input.auch_erledigte ? store.tasks : store.tasks.filter((t) => !t.erledigt);
      return { aufgaben: tasks };
    }
    case "aufgabe_erledigen": {
      const task = store.tasks.find((t) => t.id === input.id);
      if (!task) return { fehler: "Keine Aufgabe mit dieser ID gefunden." };
      task.erledigt = true;
      await saveStore(store);
      changed("aufgaben");
      return { ok: true, aufgabe: task };
    }
    case "aufgabe_loeschen": {
      const before = store.tasks.length;
      store.tasks = store.tasks.filter((t) => t.id !== input.id);
      if (store.tasks.length === before) return { fehler: "Keine Aufgabe mit dieser ID gefunden." };
      await saveStore(store);
      changed("aufgaben");
      return { ok: true };
    }
    case "notiz_speichern": {
      const note = { id: randomUUID().slice(0, 8), inhalt: input.inhalt.trim(), erstellt: new Date().toISOString() };
      store.notes.push(note);
      await saveStore(store);
      changed("notizen");
      return { ok: true, notiz: note };
    }
    case "notizen_abrufen":
      return { notizen: store.notes };
    case "notiz_loeschen": {
      const before = store.notes.length;
      store.notes = store.notes.filter((n) => n.id !== input.id);
      if (store.notes.length === before) return { fehler: "Keine Notiz mit dieser ID gefunden." };
      await saveStore(store);
      changed("notizen");
      return { ok: true };
    }
    default:
      return { fehler: `Unbekanntes Werkzeug: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Gesprächsverlauf (pro Browser-Sitzung im Speicher, nur angehängt – nie umgeschrieben)

const conversations = new Map();

function nowLabel() {
  return new Date().toLocaleString("de-DE", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Nach einem Modellwechsel mitten in der Antwort (Fallback) dürfen Denk- und
// Werkzeugblöcke vor dem letzten Wechselpunkt nicht zurückgeschickt werden.
function contentForHistory(content) {
  const lastFallback = content.findLastIndex((b) => b.type === "fallback");
  if (lastFallback === -1) return content;
  const dropBefore = new Set(["thinking", "redacted_thinking", "tool_use"]);
  return content.filter((b, i) => i > lastFallback || !dropBefore.has(b.type));
}

function toolResultContent(result) {
  return typeof result === "string" ? result : JSON.stringify(result);
}

async function runTurn(messages, send) {
  const tools = await allTools();
  let jsonRetries = 0;
  for (let step = 0; step < 12; step++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    stream.on("text", (delta) => send({ type: "text", text: delta }));

    let message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue; // Werkzeug-Eingabe war kein gültiges JSON – Schritt wiederholen
    }

    if (message.stop_reason === "refusal") {
      send({ type: "text", text: "Dabei kann ich leider nicht helfen." });
      return;
    }

    messages.push({ role: "assistant", content: contentForHistory(message.content) });

    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b) => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) return;

    const results = await Promise.all(
      toolUses.map(async (call) => {
        send({ type: "tool", name: call.name });
        if (!validateInput(call.name, call.input)) {
          return {
            type: "tool_result",
            tool_use_id: call.id,
            is_error: true,
            content: "Ungültige oder unvollständige Eingabe. Bitte erneut versuchen.",
          };
        }
        const result = await executeTool(call.name, call.input, send);
        return {
          type: "tool_result",
          tool_use_id: call.id,
          content: toolResultContent(result),
          ...(result?.fehler ? { is_error: true } : {}),
        };
      }),
    );
    messages.push({ role: "user", content: results });
  }
}

// ---------------------------------------------------------------------------
// HTTP

const app = express();

// Nur Anfragen an diesen Rechner selbst annehmen (Schutz gegen DNS-Rebinding).
app.use((req, res, next) => {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) return next();
  res.status(403).send("Nur lokal erreichbar.");
});
app.use(express.json());

if (IS_PACKAGED) {
  // Als fertige App stecken die Oberflächen-Dateien im Programm selbst.
  // eslint-disable-next-line no-undef
  const { getAsset } = require("node:sea");
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json",
  };
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/auth/")) return next();
    const file = req.path === "/" ? "index.html" : req.path.slice(1);
    try {
      const data = Buffer.from(getAsset(`public/${file}`));
      res.type(TYPES[path.extname(file)] ?? "application/octet-stream").send(data);
    } catch {
      next();
    }
  });
} else {
  app.use(express.static(path.join(APP_DIR, "public")));
}

app.post("/api/chat", async (req, res) => {
  const { sessionId, text } = req.body ?? {};
  if (typeof sessionId !== "string" || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "sessionId und text sind erforderlich" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const messages = conversations.get(sessionId) ?? [];
  conversations.set(sessionId, messages);
  const checkpoint = messages.length;
  messages.push({ role: "user", content: `[${nowLabel()}] ${text.trim()}` });

  try {
    await runTurn(messages, send);
  } catch (err) {
    // Unvollständigen Zug verwerfen, damit der Verlauf gültig bleibt.
    messages.length = checkpoint;
    console.error(err);
    let msg = "Da ist etwas schiefgelaufen. Versuch es bitte gleich nochmal.";
    if (err instanceof Anthropic.AuthenticationError) msg = "Der API-Schlüssel fehlt oder ist ungültig.";
    else if (err instanceof Anthropic.RateLimitError) msg = "Ich bin gerade etwas überlastet. Versuch es gleich nochmal.";
    else if (err instanceof Anthropic.APIConnectionError) msg = "Ich erreiche den Server gerade nicht. Prüf bitte die Internetverbindung.";
    send({ type: "error", message: msg });
  }
  send({ type: "done" });
  res.end();
});

// Einstellungen (API-Schlüssel und Zugangsdaten) – Geheimnisse werden nie zurückgegeben.

app.get("/api/einstellungen", (_req, res) => {
  res.json({
    gesetzt: Object.fromEntries(SETTING_KEYS.map((k) => [k, Boolean(process.env[k])])),
    name: NAME,
    datenordner: DATA_DIR,
    app: IS_PACKAGED,
    adresse: BASE_URL,
  });
});

app.post("/api/einstellungen", (req, res) => {
  const changes = Object.fromEntries(
    Object.entries(req.body ?? {}).filter(([k, v]) => SETTING_KEYS.includes(k) && typeof v === "string"),
  );
  saveSettings(changes);
  client = new Anthropic();
  resetGoogle();
  res.json({ ok: true });
});

app.post("/api/beenden", (_req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

app.post("/api/reset", (req, res) => {
  conversations.delete(req.body?.sessionId);
  res.json({ ok: true });
});

// Daten für die Fenster

app.get("/api/aufgaben", async (_req, res) => {
  res.json(await loadStore());
});

app.post("/api/aufgaben/:id/umschalten", async (req, res) => {
  const store = await loadStore();
  const task = store.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "nicht gefunden" });
  task.erledigt = !task.erledigt;
  await saveStore(store);
  res.json(task);
});

app.delete("/api/notizen/:id", async (req, res) => {
  const store = await loadStore();
  store.notes = store.notes.filter((n) => n.id !== req.params.id);
  await saveStore(store);
  res.json({ ok: true });
});

function isoDate(d) {
  return d.toLocaleDateString("sv-SE", { timeZone: TIMEZONE }); // JJJJ-MM-TT
}

app.get("/api/kalender", async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.tage) || 7, 1), 31);
  const from = new Date();
  const to = new Date(from.getTime() + (days - 1) * 86400000);
  res.json(await executeGoogleTool("kalender_termine_abrufen", { von: isoDate(from), bis: isoDate(to) }, TIMEZONE));
});

app.get("/api/mails", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(await executeGoogleTool("mails_suchen", { suchanfrage: q, anzahl: 20 }, TIMEZONE));
});

app.get("/api/mails/:id", async (req, res) => {
  res.json(await executeGoogleTool("mail_lesen", { id: req.params.id }, TIMEZONE));
});

// Verbindungen

app.get("/api/verbindungen", async (_req, res) => {
  res.json({
    google: {
      configured: googleConfigured(),
      connected: await googleConnected(),
      needsReconnect: await googleNeedsReconnect(),
    },
    spotify: { configured: spotifyConfigured(), connected: await spotifyConnected() },
    dienste: await connectorStatus(),
  });
});

app.post("/api/verbindungen", async (req, res) => {
  try {
    const { name, url } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || typeof url !== "string") throw new Error("Name und Adresse fehlen.");
    res.json({ id: await addConnector(name.trim(), url.trim()) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/verbindungen/:id", async (req, res) => {
  await removeConnector(req.params.id);
  res.json({ ok: true });
});

app.post("/api/verbindungen/:id/trennen", async (req, res) => {
  await disconnectConnector(req.params.id);
  res.json({ ok: true });
});

app.get("/auth/mcp/callback", async (req, res) => {
  const id = String(req.query.state ?? "");
  try {
    if (typeof req.query.code !== "string") throw new Error(String(req.query.error ?? "kein Code erhalten"));
    await finishConnect(id, req.query.code);
    res.redirect("/?verbunden=" + encodeURIComponent(id));
  } catch (err) {
    console.error(err);
    res.status(400).send(page("Verbindung fehlgeschlagen", err.message));
  }
});

app.get("/auth/mcp/:id", async (req, res) => {
  try {
    const result = await startConnect(req.params.id);
    if (result.authUrl) return res.redirect(result.authUrl);
    res.redirect("/?verbunden=" + encodeURIComponent(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(400).send(page("Verbindung fehlgeschlagen", err.message));
  }
});

app.get("/auth/google", (_req, res) => {
  if (!googleConfigured()) {
    return res.status(400).send(page("Google ist nicht eingerichtet", "GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET fehlen in der .env. Die Anleitung steht in der README."));
  }
  res.redirect(authUrl());
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    if (typeof req.query.code !== "string") throw new Error(String(req.query.error ?? "kein Code erhalten"));
    await handleCallback(req.query.code);
    res.redirect("/?verbunden=google");
  } catch (err) {
    console.error(err);
    res.status(400).send(page("Verbindung mit Google fehlgeschlagen", err.message));
  }
});

// Spotify

app.get("/api/spotify", async (_req, res) => {
  if (!(await spotifyConnected())) return res.json({ fehler: "Spotify ist nicht verbunden." });
  try {
    res.json(await nowPlaying());
  } catch (err) {
    res.json({ fehler: spotifyMessage(err) });
  }
});

app.post("/api/spotify/steuern", async (req, res) => {
  try {
    res.json(await control(String(req.body?.aktion ?? ""), req.body?.lautstaerke));
  } catch (err) {
    res.json({ fehler: spotifyMessage(err) });
  }
});

app.get("/auth/spotify", (_req, res) => {
  if (!spotifyConfigured()) {
    return res.status(400).send(page("Spotify ist nicht eingerichtet", "SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET fehlen in der .env. Die Anleitung steht in der README."));
  }
  res.redirect(spotifyAuthUrl());
});

app.get("/auth/spotify/callback", async (req, res) => {
  try {
    if (typeof req.query.code !== "string") throw new Error(String(req.query.error ?? "kein Code erhalten"));
    await spotifyCallback(req.query.code, String(req.query.state ?? ""));
    // Zurück zur gewohnten Adresse (die Anmeldung läuft über 127.0.0.1)
    res.redirect(`${BASE_URL}/?verbunden=spotify`);
  } catch (err) {
    console.error(err);
    res.status(400).send(page("Verbindung mit Spotify fehlgeschlagen", err.message));
  }
});

app.post("/api/spotify/trennen", async (_req, res) => {
  await spotifyDisconnect();
  res.json({ ok: true });
});

app.post("/api/google/trennen", async (_req, res) => {
  await disconnect();
  res.json({ ok: true });
});

function page(title, text) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<body style="background:#020b14;color:#bfefff;font-family:system-ui;padding:40px">
<h1 style="color:#2ee6ff">${esc(title)}</h1><p>${esc(text)}</p><p><a style="color:#2ee6ff" href="/">Zurück</a></p>`;
}

// Timi als eigenes App-Fenster öffnen (Edge oder Chrome im App-Modus, sonst Standardbrowser).
function openAppWindow() {
  const url = BASE_URL;
  const cmd = {
    win32: `start "" msedge --app=${url} || start "" chrome --app=${url} || start "" ${url}`,
    darwin: `open -na "Google Chrome" --args --app=${url} || open -na "Microsoft Edge" --args --app=${url} || open ${url}`,
  }[process.platform] ?? `xdg-open ${url}`;
  exec(cmd, { shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" }, () => {});
}

const shouldOpen = IS_PACKAGED || process.env.TIMI_OPEN === "1";
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`${NAME} ist bereit: ${BASE_URL}`);
  console.log(`Daten: ${DATA_DIR}`);
  if (IS_PACKAGED) console.log("Dieses Fenster offen lassen, solange du Timi benutzt.");
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn("Hinweis: Noch kein API-Schlüssel – bitte in der App unter Einstellungen eintragen.");
  }
  if (shouldOpen) openAppWindow();
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && shouldOpen) {
    // Timi läuft schon – nur das Fenster öffnen.
    openAppWindow();
    setTimeout(() => process.exit(0), 1500);
  } else {
    throw err;
  }
});
