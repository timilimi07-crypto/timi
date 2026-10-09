// Sprachassistent – Backend
// Hält den API-Schlüssel geheim, führt das Gespräch mit Claude und stellt
// einfache Werkzeuge bereit (Aufgaben, Notizen, Websuche).

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(here, "data", "store.json");
const PORT = Number(process.env.PORT ?? 3000);
const MODEL = process.env.ASSISTANT_MODEL ?? "claude-opus-5-5";
// Für ein flüssiges Gespräch zählt Tempo mehr als Tiefe – "low" ist hier der beste Startpunkt.
const EFFORT = process.env.ASSISTANT_EFFORT ?? "low";
const NAME = process.env.ASSISTANT_NAME ?? "Timi";
const TIMEZONE = process.env.TZ_USER ?? "Europe/Berlin";

const client = new Anthropic();

const SYSTEM_PROMPT = `Du bist ${NAME}, ein persönlicher Sprachassistent. Du sprichst Deutsch, locker und herzlich, wie ein guter Freund, der gleichzeitig sehr hilfsbereit und organisiert ist.

Deine Antworten werden laut vorgelesen. Deshalb:
- Antworte kurz und natürlich, meist ein bis drei Sätze. Längere Erklärungen nur, wenn ausdrücklich gewünscht.
- Keine Aufzählungszeichen, keine Überschriften, kein Markdown, keine Emojis, keine Links. Schreib so, wie man spricht.
- Zahlen, Uhrzeiten und Daten so formulieren, dass sie gut vorlesbar sind.

Du hilfst bei Aufgaben und im Alltag:
- Aufgaben verwalten: Wenn der Nutzer etwas erledigen muss, biete an, es auf die Aufgabenliste zu setzen, oder tu es direkt, wenn er darum bittet. Bestätige kurz, was du gespeichert hast.
- Merken: Wenn der Nutzer dir etwas Persönliches erzählt, das später nützlich ist (Vorlieben, Namen, Termine, Ziele), speichere es als Notiz. Schau in deinen Notizen nach, wenn Wissen über den Nutzer helfen würde.
- Aktuelle Informationen (Wetter, Nachrichten, Öffnungszeiten, Fakten) suchst du im Web.
- Beim Planen, Brainstormen, Formulieren oder Entscheiden bist du ein ehrlicher Gesprächspartner.

Jede Nutzernachricht beginnt mit einer Zeitangabe in eckigen Klammern. Nutze sie für Datumsfragen und Fälligkeiten, erwähne sie aber nicht von dir aus.
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

const TOOLS = [
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
      properties: {
        auch_erledigte: { type: "boolean", description: "Auch erledigte Aufgaben anzeigen" },
      },
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
].map((tool) => ({ ...tool, eager_input_streaming: true }));

const SERVER_TOOLS = [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }];

// Die Eingaben werden gestreamt und vom Server nicht mehr geprüft – daher hier validieren.
function validateInput(tool, input) {
  if (typeof input !== "object" || input === null) return false;
  const schema = TOOLS.find((t) => t.name === tool)?.input_schema;
  if (!schema) return false;
  for (const key of schema.required ?? []) {
    if (typeof input[key] !== "string" || input[key].trim() === "") return false;
  }
  return true;
}

async function executeTool(name, input) {
  const store = await loadStore();
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
      return { ok: true, aufgabe: task };
    }
    case "aufgabe_loeschen": {
      const before = store.tasks.length;
      store.tasks = store.tasks.filter((t) => t.id !== input.id);
      if (store.tasks.length === before) return { fehler: "Keine Aufgabe mit dieser ID gefunden." };
      await saveStore(store);
      return { ok: true };
    }
    case "notiz_speichern": {
      const note = { id: randomUUID().slice(0, 8), inhalt: input.inhalt.trim(), erstellt: new Date().toISOString() };
      store.notes.push(note);
      await saveStore(store);
      return { ok: true, notiz: note };
    }
    case "notizen_abrufen":
      return { notizen: store.notes };
    case "notiz_loeschen": {
      const before = store.notes.length;
      store.notes = store.notes.filter((n) => n.id !== input.id);
      if (store.notes.length === before) return { fehler: "Keine Notiz mit dieser ID gefunden." };
      await saveStore(store);
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

async function runTurn(messages, send) {
  let jsonRetries = 0;
  for (let step = 0; step < 8; step++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools: [...TOOLS, ...SERVER_TOOLS],
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

    const results = [];
    for (const call of toolUses) {
      send({ type: "tool", name: call.name });
      if (!validateInput(call.name, call.input)) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content: "Ungültige oder unvollständige Eingabe. Bitte erneut versuchen.",
        });
        continue;
      }
      const result = await executeTool(call.name, call.input);
      results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: results });
    send({ type: "tasks_changed" });
  }
}

// ---------------------------------------------------------------------------
// HTTP

const app = express();
app.use(express.json());
app.use(express.static(path.join(here, "public")));

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

app.post("/api/reset", (req, res) => {
  conversations.delete(req.body?.sessionId);
  res.json({ ok: true });
});

app.get("/api/tasks", async (_req, res) => {
  const store = await loadStore();
  res.json(store);
});

app.post("/api/tasks/:id/toggle", async (req, res) => {
  const store = await loadStore();
  const task = store.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "nicht gefunden" });
  task.erledigt = !task.erledigt;
  await saveStore(store);
  res.json(task);
});

app.listen(PORT, () => {
  console.log(`${NAME} hört zu auf http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn("Hinweis: Kein ANTHROPIC_API_KEY gesetzt. Trag ihn in die Datei .env ein (siehe .env.example).");
  }
});
