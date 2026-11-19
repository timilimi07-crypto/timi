import "server-only";
import { memoryExplanationCache, type ExplainOptions, type ExplanationCache } from "@erl/core";
import { createChatCompletionsTransport, createLlmGateway, readLlmConfig } from "@erl/core/llm";

let cached: Promise<ExplainOptions> | null = null;

/** Ist der LLM-Fallback für unbekannte Prüfregeln eingeschaltet? */
export function llmFallbackEnabled(): boolean {
  return readLlmConfig(process.env).enabled;
}

async function createCache(): Promise<ExplanationCache> {
  // Der Cache speichert nur Erklärungen je Regel-ID – keine Rechnungsdaten.
  if (!process.env["DATABASE_URL"]) return memoryExplanationCache();
  const { createDb, createDbExplanationCache } = await import("@erl/db");
  return createDbExplanationCache(createDb().db);
}

/**
 * Optionen für die Erklär-Schicht. Bei ausgeschaltetem Flag: keine LLM-Aufrufe, kein Cache,
 * unbekannte Regeln erhalten den Standardtext.
 */
export function explainOptions(): Promise<ExplainOptions> {
  if (!cached) {
    cached = (async () => {
      const config = readLlmConfig(process.env);
      if (!config.enabled) return { llm: null, cache: null };
      const transport = createChatCompletionsTransport({
        apiKey: process.env["LLM_API_KEY"] ?? "",
        model: process.env["LLM_MODEL"] ?? "",
      });
      return {
        llm: createLlmGateway({
          config,
          transport,
          // Nur Metadaten loggen (Zweck, Ergebnis, Dauer, Feldnamen).
          log: (e) => console.info("[llm]", JSON.stringify(e)),
        }),
        cache: await createCache(),
      };
    })();
  }
  return cached;
}
