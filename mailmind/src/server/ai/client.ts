import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { computeCostUsd, type AiOperation } from "@/lib/ai/models";

/**
 * Dünne, testbare Schicht um die Claude API.
 * - Strukturierte Ausgabe (JSON-Schema aus zod) + clientseitige Validierung
 * - Prompt-Caching: cache_control an den System-Blöcken
 * - Wiederholung bei ungültiger/abgeschnittener Ausgabe (max. 3 Versuche);
 *   429/5xx wiederholt das SDK selbst (maxRetries)
 * - Jeder Versuch wird mit Tokens und Kosten gemeldet (onAttempt → AiUsageLog)
 * - Ablehnungen (stop_reason "refusal") werden nicht wiederholt, sondern gemeldet
 */

export type SystemBlock = { text: string; cache: boolean };

export type AiAttempt = {
  operation: AiOperation;
  model: string;
  attempt: number;
  success: boolean;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
};

export type AiCallParams<S extends z.ZodType> = {
  operation: AiOperation;
  model: string;
  system: SystemBlock[];
  user: string;
  schema: S;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  onAttempt?: (a: AiAttempt) => Promise<void> | void;
};

export type AiCallResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; refused: boolean; error: string; model: string };

export type AiCaller = <S extends z.ZodType>(p: AiCallParams<S>) => Promise<AiCallResult<z.infer<S>>>;

export const MAX_ATTEMPTS = 3;

/** Modelle mit serverseitigem Fallback bei Ablehnungen (Haiku 5.5 hat keinen). */
const SUPPORTS_FALLBACK = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);

export function createAnthropicCaller(client = new Anthropic({ maxRetries: 3, timeout: 120_000 })): AiCaller {
  return async function call<S extends z.ZodType>(p: AiCallParams<S>): Promise<AiCallResult<z.infer<S>>> {
    let lastError = "Unbekannter Fehler";
    let maxTokens = p.maxTokens;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      let response: Awaited<ReturnType<typeof client.beta.messages.parse>> | null = null;
      try {
        response = await client.beta.messages.parse({
          model: p.model,
          max_tokens: maxTokens,
          system: p.system.map((b) => ({
            type: "text" as const,
            text: b.text,
            ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
          })),
          messages: [{ role: "user", content: p.user }],
          output_config: { effort: p.effort, format: betaZodOutputFormat(p.schema) },
          ...(SUPPORTS_FALLBACK.has(p.model)
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
        });
      } catch (err) {
        // Validierungsfehler der Ausgabe → erneut versuchen; API-Fehler (nach SDK-Retries) → abbrechen.
        if (err instanceof Anthropic.APIError) throw err;
        lastError = `Ausgabe ungültig: ${err instanceof Error ? err.message : String(err)}`;
        await p.onAttempt?.(emptyAttempt(p, attempt, lastError, Date.now() - started));
        continue;
      }

      const u = response.usage;
      const model = response.model || p.model;
      const usage = {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      };
      const base = { operation: p.operation, model, attempt, durationMs: Date.now() - started, ...usage, costUsd: computeCostUsd(model, usage) };

      if (response.stop_reason === "refusal") {
        const error = `Auswertung abgelehnt (${response.stop_details?.category ?? "ohne Kategorie"})`;
        await p.onAttempt?.({ ...base, success: false, error });
        return { ok: false, refused: true, error, model };
      }
      if (response.stop_reason === "max_tokens") {
        lastError = "Ausgabe abgeschnitten (max_tokens)";
        await p.onAttempt?.({ ...base, success: false, error: lastError });
        maxTokens = Math.min(maxTokens * 2, 32_000);
        continue;
      }
      const parsed = p.schema.safeParse(response.parsed_output);
      if (!parsed.success) {
        lastError = `Ausgabe ungültig: ${parsed.error.issues[0]?.message ?? "Schema"}`;
        await p.onAttempt?.({ ...base, success: false, error: lastError });
        continue;
      }
      await p.onAttempt?.({ ...base, success: true });
      return { ok: true, data: parsed.data, model };
    }
    return { ok: false, refused: false, error: lastError, model: p.model };
  };
}

function emptyAttempt(p: AiCallParams<z.ZodType>, attempt: number, error: string, durationMs: number): AiAttempt {
  return {
    operation: p.operation,
    model: p.model,
    attempt,
    success: false,
    error,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    durationMs,
  };
}
