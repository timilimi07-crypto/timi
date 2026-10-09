// Kostenlose KI-Anbieter für Timi: Google Gemini (Gratis-Kontingent) und Ollama
// (läuft lokal auf dem eigenen Rechner). Beide sprechen das OpenAI-kompatible
// Chat-Format; dieses Modul führt damit das Gespräch samt Werkzeugaufrufen.

export const PROVIDERS = {
  claude: { name: "Claude (Anthropic, kostenpflichtig)", defaultModel: "claude-opus-5-5" },
  gemini: {
    name: "Google Gemini (gratis mit Tageslimit)",
    defaultModel: "gemini-flash-latest",
    baseUrl: () => "https://generativelanguage.googleapis.com/v1beta/openai",
    key: () => process.env.GEMINI_API_KEY,
  },
  ollama: {
    name: "Ollama (gratis, läuft auf deinem PC)",
    defaultModel: "qwen2.5:7b",
    baseUrl: () => `${(process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1`,
    key: () => null,
  },
};

// Welcher Anbieter gilt? Ausdrücklich gewählt, sonst der, für den ein Schlüssel da ist.
export function currentProvider() {
  const chosen = process.env.KI_ANBIETER;
  if (chosen && PROVIDERS[chosen]) return chosen;
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "claude";
}

export function currentModel(provider = currentProvider()) {
  if (process.env.KI_MODELL) return process.env.KI_MODELL;
  if (provider === "claude" && process.env.ASSISTANT_MODEL) return process.env.ASSISTANT_MODEL;
  return PROVIDERS[provider].defaultModel;
}

export function providerReady(provider = currentProvider()) {
  if (provider === "claude") return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return true; // Ollama braucht keinen Schlüssel
}

export class ProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Verständliche Fehlermeldung für die Sprachausgabe
export function providerMessage(provider, err) {
  if (provider === "ollama" && (err instanceof TypeError || err.cause?.code === "ECONNREFUSED")) {
    return "Ollama läuft nicht. Bitte starte das Programm Ollama auf deinem Computer.";
  }
  if (provider === "ollama" && err.status === 404) {
    return `Das Modell ${currentModel(provider)} ist noch nicht installiert. Gib in der Eingabeaufforderung ein: ollama pull ${currentModel(provider)}`;
  }
  if (err.status === 401 || err.status === 403 || err.status === 400 && /api key/i.test(err.message)) {
    return "Der Gemini-Schlüssel fehlt oder ist ungültig. Bitte prüf ihn in den Einstellungen.";
  }
  if (err.status === 429) return "Das Gratis-Kontingent ist gerade aufgebraucht. Warte kurz oder versuch es morgen wieder.";
  if (err instanceof TypeError) return "Ich erreiche den KI-Dienst gerade nicht. Prüf bitte die Internetverbindung.";
  return "Da ist etwas schiefgelaufen. Versuch es bitte gleich nochmal.";
}

// Gemini versteht nur einen Teil von JSON-Schema – alles andere herausfiltern.
function simplifySchema(schema) {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  const out = {};
  let type = schema.type;
  if (Array.isArray(type)) type = type.find((t) => t !== "null") ?? "string";
  if (type) out.type = type;
  if (typeof schema.description === "string") out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (schema.properties && typeof schema.properties === "object") {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, simplifySchema(v)]));
  }
  if (Array.isArray(schema.required) && schema.required.length) out.required = schema.required;
  if (schema.items) out.items = simplifySchema(schema.items);
  if (out.type === "object" && !out.properties) out.properties = {};
  if (!out.type) out.type = out.properties ? "object" : "string";
  return out;
}

// Server-Sent-Events Zeile für Zeile lesen
async function* sseData(body) {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

// Manche lokalen Modelle schreiben ihr „Nachdenken“ in <think>…</think> – das nicht vorlesen.
function thinkFilter() {
  let inThink = false;
  let pending = "";
  return (delta) => {
    pending += delta;
    let out = "";
    while (pending) {
      if (inThink) {
        const end = pending.indexOf("</think>");
        if (end === -1) return out;
        pending = pending.slice(end + 8);
        inThink = false;
      } else {
        const start = pending.indexOf("<think>");
        if (start === -1) {
          // Ein angefangenes "<thi…" am Ende zurückhalten
          const keep = pending.lastIndexOf("<");
          if (keep !== -1 && "<think>".startsWith(pending.slice(keep))) {
            out += pending.slice(0, keep);
            pending = pending.slice(keep);
            return out;
          }
          out += pending;
          pending = "";
        } else {
          out += pending.slice(0, start);
          pending = pending.slice(start + 7);
          inThink = true;
        }
      }
    }
    return out;
  };
}

/**
 * Führt einen Gesprächszug mit Gemini oder Ollama.
 * messages: Verlauf im OpenAI-Format (wird ergänzt)
 * tools: Werkzeuge im Format { name, description, input_schema }
 * runTool(name, input) -> { content, isError }
 */
export async function runTurnCompatible({ provider, system, messages, tools, send, runTool }) {
  const p = PROVIDERS[provider];
  const toolDefs = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: (t.description ?? "").slice(0, 1000), parameters: simplifySchema(t.input_schema) },
  }));

  for (let step = 0; step < 10; step++) {
    const key = p.key();
    const res = await fetch(`${p.baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: currentModel(provider),
        stream: true,
        messages: [{ role: "system", content: system }, ...messages],
        tools: toolDefs,
      }),
    });
    if (!res.ok) throw new ProviderError(res.status, (await res.text()).slice(0, 500));

    const filter = thinkFilter();
    let text = "";
    const calls = [];
    for await (const data of sseData(res.body)) {
      if (data === "[DONE]") break;
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new ProviderError(chunk.error.code ?? 500, chunk.error.message ?? "Fehler");
      const delta = chunk.choices?.[0]?.delta ?? {};
      if (delta.content) {
        const visible = filter(delta.content);
        if (visible) {
          text += visible;
          send({ type: "text", text: visible });
        }
      }
      for (const [i, tc] of (delta.tool_calls ?? []).entries()) {
        const index = tc.index ?? i;
        calls[index] ??= { id: "", name: "", arguments: "" };
        if (tc.id) calls[index].id = tc.id;
        if (tc.function?.name) calls[index].name += tc.function.name;
        if (tc.function?.arguments) calls[index].arguments += tc.function.arguments;
      }
    }

    const toolCalls = calls.filter((c) => c?.name).map((c, i) => ({ ...c, id: c.id || `call_${step}_${i}` }));
    messages.push({
      role: "assistant",
      content: text || null,
      ...(toolCalls.length
        ? { tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments || "{}" } })) }
        : {}),
    });
    if (!toolCalls.length) return;

    for (const call of toolCalls) {
      let input;
      try {
        input = JSON.parse(call.arguments || "{}");
      } catch {
        input = null;
      }
      const { content } = input === null
        ? { content: "Die Eingabe war kein gültiges JSON. Bitte erneut versuchen." }
        : await runTool(call.name, input);
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
}
