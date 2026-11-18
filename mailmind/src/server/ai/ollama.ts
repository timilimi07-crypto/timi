import { z } from "zod";
import { OPERATION_TIER } from "@/lib/ai/models";
import type { AiCallParams, AiCallResult, AiCaller } from "./client";
import { MAX_ATTEMPTS } from "./client";

/**
 * Lokaler KI-Anbieter über Ollama (https://ollama.com) – kostenlos, ohne
 * API-Schlüssel, z. B. mit qwen2.5 oder llama3.1. Gedacht für Tests und
 * Demos; im echten Betrieb bleibt Claude der Standard.
 *
 * Gleiche Schnittstelle wie der Claude-Client (AiCaller): strukturierte
 * Ausgabe per JSON-Schema (Ollama „format“), Validierung mit zod,
 * bis zu 3 Versuche bei ungültiger Ausgabe, Protokoll je Versuch (Kosten 0 $).
 */

export type OllamaOptions = {
  baseUrl: string;
  /** Modell für Analyse, Antworten, Thread-Zusammenfassungen. */
  model: string;
  /** Modell für die Vorsortierung (Standard: gleiches Modell). */
  fastModel: string;
  /** Kontextfenster in Token. Ollama nutzt sonst nur 2048 und schneidet Prompts still ab. */
  numCtx: number;
  timeoutMs: number;
};

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaError";
  }
}

export function ollamaOptionsFromEnv(env: Record<string, string | undefined> = process.env): OllamaOptions {
  const model = env.OLLAMA_MODEL || "qwen2.5:7b";
  return {
    baseUrl: (env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, ""),
    model,
    fastModel: env.OLLAMA_MODEL_FAST || model,
    numCtx: Number(env.OLLAMA_NUM_CTX) || 16_384,
    timeoutMs: Number(env.OLLAMA_TIMEOUT_MS) || 300_000,
  };
}

/** Kennung im Kostenprotokoll und an der E-Mail, z. B. „ollama:qwen2.5:7b“. */
export const ollamaModelId = (model: string) => `ollama:${model}`;

type ChatResponse = {
  model: string;
  message?: { role: string; content: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

async function post<T>(opts: OllamaOptions, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    throw new OllamaError(
      timeout
        ? `Ollama hat nicht innerhalb von ${Math.round(opts.timeoutMs / 1000)} s geantwortet (Modell zu groß für den Rechner?).`
        : `Ollama ist unter ${opts.baseUrl} nicht erreichbar. Läuft „ollama serve“?`,
    );
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const msg = json.error ?? `HTTP ${res.status}`;
    if (res.status === 404 && /not found/i.test(msg)) {
      throw new OllamaError(`Ollama-Modell nicht installiert: ${msg}. Bitte „ollama pull <modell>“ ausführen.`);
    }
    throw new OllamaError(`Ollama-Fehler: ${msg}`);
  }
  return json;
}

export function createOllamaCaller(opts: OllamaOptions = ollamaOptionsFromEnv()): AiCaller {
  return async function call<S extends z.ZodType>(p: AiCallParams<S>): Promise<AiCallResult<z.infer<S>>> {
    // Modellwahl nach Stufe der Aufgabe (Vorsortierung = schnelles Modell).
    const model = OPERATION_TIER[p.operation] === "fast" ? opts.fastModel : opts.model;
    const id = ollamaModelId(model);
    const schema = z.toJSONSchema(p.schema);
    const system = `${p.system.map((b) => b.text).join("\n\n")}\n\nAntworte ausschließlich mit einem JSON-Objekt gemäß dem vorgegebenen Schema – ohne Erklärungen davor oder danach.`;
    let lastError = "Unbekannter Fehler";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      const r = await post<ChatResponse>(opts, "/api/chat", {
        model,
        stream: false,
        format: schema,
        options: { temperature: 0, num_ctx: opts.numCtx },
        messages: [
          { role: "system", content: system },
          { role: "user", content: p.user },
        ],
      });
      const usage = { inputTokens: r.prompt_eval_count ?? 0, outputTokens: r.eval_count ?? 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      const base = { operation: p.operation, model: id, attempt, durationMs: Date.now() - started, costUsd: 0, ...usage };

      if (r.done_reason === "length") {
        lastError = "Ausgabe abgeschnitten (Kontext/Länge)";
        await p.onAttempt?.({ ...base, success: false, error: lastError });
        continue;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(r.message?.content ?? "");
      } catch {
        lastError = "Ausgabe ist kein gültiges JSON";
        await p.onAttempt?.({ ...base, success: false, error: lastError });
        continue;
      }
      const parsed = p.schema.safeParse(raw);
      if (!parsed.success) {
        lastError = `Ausgabe ungültig: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message ?? ""}`.trim();
        await p.onAttempt?.({ ...base, success: false, error: lastError });
        continue;
      }
      await p.onAttempt?.({ ...base, success: true });
      return { ok: true, data: parsed.data, model: id };
    }
    return { ok: false, refused: false, error: lastError, model: id };
  };
}

/**
 * Prüft beim Start, ob Ollama erreichbar ist und die Modelle installiert sind.
 * Liefert verständliche Hinweise statt kryptischer Fehler beim ersten Aufruf.
 */
export async function checkOllama(opts: OllamaOptions = ollamaOptionsFromEnv()): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${opts.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    const json = (await res.json()) as { models?: { name: string }[] };
    const installed = new Set((json.models ?? []).flatMap((m) => [m.name, m.name.replace(/:latest$/, "")]));
    const missing = [...new Set([opts.model, opts.fastModel])].filter((m) => !installed.has(m) && !installed.has(`${m}:latest`));
    if (missing.length) {
      return { ok: false, message: `Ollama läuft, aber folgende Modelle fehlen: ${missing.join(", ")}. Installieren mit: ${missing.map((m) => `ollama pull ${m}`).join(" && ")}` };
    }
    return { ok: true, message: `Ollama bereit (${opts.baseUrl}, Modell ${opts.model}${opts.fastModel !== opts.model ? `, Vorsortierung ${opts.fastModel}` : ""}).` };
  } catch {
    return { ok: false, message: `Ollama ist unter ${opts.baseUrl} nicht erreichbar. Läuft „ollama serve“?` };
  }
}
