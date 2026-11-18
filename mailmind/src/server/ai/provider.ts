import { createAnthropicCaller, type AiCaller } from "./client";
import { createOllamaCaller, ollamaOptionsFromEnv } from "./ollama";

/**
 * Auswahl des KI-Anbieters über AI_PROVIDER:
 *  - "anthropic" (Standard, echter Betrieb): Claude Haiku 5.5 / Sonnet 5.5 / optional Opus 5.5
 *  - "ollama": lokales Modell (kostenlos, für Tests/Demos ohne API-Schlüssel)
 */
export type AiProvider = "anthropic" | "ollama";

export function getAiProvider(env: Record<string, string | undefined> = process.env): AiProvider {
  return env.AI_PROVIDER?.trim().toLowerCase() === "ollama" ? "ollama" : "anthropic";
}

/** Ist die KI nutzbar? Claude braucht einen Schlüssel, Ollama nur einen erreichbaren Server. */
export function isAiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return getAiProvider(env) === "ollama" || !!env.ANTHROPIC_API_KEY;
}

export function createAiCaller(): AiCaller {
  return getAiProvider() === "ollama" ? createOllamaCaller() : createAnthropicCaller();
}

/** Für Hinweise in der Oberfläche. */
export function describeAiProvider(): { provider: AiProvider; label: string; detail: string; configured: boolean } {
  const provider = getAiProvider();
  if (provider === "ollama") {
    const o = ollamaOptionsFromEnv();
    return {
      provider,
      label: "Ollama (lokal)",
      detail: `Modell ${o.model}${o.fastModel !== o.model ? `, Vorsortierung ${o.fastModel}` : ""} · ${o.baseUrl} · kostenlos`,
      configured: true,
    };
  }
  return { provider, label: "Anthropic Claude", detail: "Haiku 5.5 / Sonnet 5.5 (optional Opus 5.5)", configured: !!process.env.ANTHROPIC_API_KEY };
}

/** Fehlermeldung, wenn die KI nicht nutzbar ist (für API-Antworten). */
export const AI_NOT_CONFIGURED_MESSAGE =
  "KI nicht verfügbar: Es ist kein ANTHROPIC_API_KEY hinterlegt. Für lokale Tests ohne Schlüssel AI_PROVIDER=ollama setzen.";
