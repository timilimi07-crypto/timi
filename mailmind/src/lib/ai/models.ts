/**
 * KI-Modelle, Aufgaben-Routing und Kostenberechnung.
 *
 * Zwei Stufen:
 *  - "fast" (Standard Claude Haiku 5.5): einfache Aufgaben – Spam/Newsletter
 *    erkennen, Kategorie bestimmen ("Triage").
 *  - "main" (Standard Claude Sonnet 5.5): Zusammenfassung, Priorität,
 *    Aufgaben, erkannte Daten, Antwortvorschläge, Thread-Zusammenfassungen.
 *    Claude Opus 5.5 ist pro Firma optional wählbar.
 *
 * Preise in USD pro 1 Mio. Token (Anthropic-Listenpreise, Stand 11/2026).
 * Bei Preisänderungen nur diese Tabelle anpassen.
 */

export type ModelTier = "fast" | "main";

export type ModelInfo = {
  id: string;
  label: string;
  description: string;
  /** In welcher Stufe darf das Modell gewählt werden? */
  tiers: readonly ModelTier[];
  pricing: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    /** Optionaler Aufpreis für sehr lange Prompts (Haiku 5.5: > 100k Token). */
    longPrompt?: { thresholdTokens: number; input: number; output: number };
  };
};

export const AI_MODELS: Record<string, ModelInfo> = {
  "claude-haiku-5-5": {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    description: "Sehr schnell und günstig – ideal für Spam-/Newsletter-Erkennung und Kategorien.",
    tiers: ["fast"],
    pricing: {
      input: 0.1,
      output: 0.5,
      cacheRead: 0.01,
      cacheWrite: 0.125,
      longPrompt: { thresholdTokens: 100_000, input: 0.5, output: 2.5 },
    },
  },
  "claude-sonnet-5-5": {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Empfohlen – sehr gute Qualität bei moderaten Kosten.",
    tiers: ["main", "fast"],
    pricing: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  },
  "claude-opus-5-5": {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Höchste Qualität für anspruchsvolle Korrespondenz – etwa doppelte Kosten von Sonnet.",
    tiers: ["main"],
    pricing: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  },
};

/**
 * Nicht wählbare Modelle, die als serverseitiger Fallback antworten können
 * (bei Ablehnung durch das gewählte Modell). Nur für die Kostenberechnung.
 */
const FALLBACK_ONLY: Record<string, ModelInfo> = {
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5 (Fallback)",
    description: "",
    tiers: [],
    pricing: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  },
  "claude-opus-5": {
    id: "claude-opus-5",
    label: "Claude Opus 5 (Fallback)",
    description: "",
    tiers: [],
    pricing: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  },
};
Object.assign(AI_MODELS, FALLBACK_ONLY);

export const DEFAULT_MAIN_MODEL = "claude-sonnet-5-5";
export const DEFAULT_FAST_MODEL = "claude-haiku-5-5";

/** Modelle, die in den Firmeneinstellungen für eine Stufe wählbar sind. */
export function modelsForTier(tier: ModelTier): ModelInfo[] {
  return Object.values(AI_MODELS).filter((m) => m.tiers.includes(tier));
}

export function isAllowedModel(id: string, tier: ModelTier): boolean {
  return AI_MODELS[id]?.tiers.includes(tier) ?? false;
}

/**
 * Welche Aufgabe läuft auf welcher Stufe? Zentrale Stelle für das Routing,
 * damit die KI-Pipeline (Phase 3) nirgends Modelle fest verdrahtet.
 */
export const OPERATION_TIER = {
  triage: "fast", // Spam/Newsletter + Kategorie
  analyze: "main", // Zusammenfassung, Priorität, Stimmung, Aufgaben, Daten
  thread_summary: "main",
  reply: "main",
  digest: "main",
} as const satisfies Record<string, ModelTier>;

export type AiOperation = keyof typeof OPERATION_TIER;

/**
 * Effektive Modelle einer Firma: Firmeneinstellung → Umgebungsvariable →
 * Standard. Ungültige Werte (z. B. Tippfehler in .env) fallen auf den Standard zurück.
 */
export function resolveModels(
  org: { aiModel?: string | null; aiModelFast?: string | null },
  envVars: { ANTHROPIC_MODEL?: string; ANTHROPIC_MODEL_FAST?: string } = {
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ANTHROPIC_MODEL_FAST: process.env.ANTHROPIC_MODEL_FAST,
  },
): Record<ModelTier, string> {
  const pick = (tier: ModelTier, ...candidates: (string | null | undefined)[]) =>
    candidates.find((c): c is string => !!c && isAllowedModel(c, tier)) ??
    (tier === "main" ? DEFAULT_MAIN_MODEL : DEFAULT_FAST_MODEL);

  return {
    main: pick("main", org.aiModel, envVars.ANTHROPIC_MODEL),
    fast: pick("fast", org.aiModelFast, envVars.ANTHROPIC_MODEL_FAST),
  };
}

export function modelForOperation(
  op: AiOperation,
  org: { aiModel?: string | null; aiModelFast?: string | null },
  envVars?: { ANTHROPIC_MODEL?: string; ANTHROPIC_MODEL_FAST?: string },
): string {
  return resolveModels(org, envVars)[OPERATION_TIER[op]];
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/** Kosten eines Aufrufs in USD. Unbekannte Modelle werden wie Sonnet berechnet. */
export function computeCostUsd(modelId: string, u: TokenUsage): number {
  if (modelId.startsWith("ollama:")) return 0; // lokales Modell: keine API-Kosten
  const p = (AI_MODELS[modelId] ?? AI_MODELS[DEFAULT_MAIN_MODEL]!).pricing;
  const promptTokens = u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);
  const long = p.longPrompt && promptTokens > p.longPrompt.thresholdTokens ? p.longPrompt : null;
  const input = long?.input ?? p.input;
  const output = long?.output ?? p.output;
  const cost =
    (u.inputTokens * input +
      u.outputTokens * output +
      (u.cacheReadTokens ?? 0) * p.cacheRead +
      (u.cacheWriteTokens ?? 0) * p.cacheWrite) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000; // auf 6 Nachkommastellen (DB-Spalte)
}

export function modelLabel(id: string): string {
  if (id.startsWith("ollama:")) return `${id.slice("ollama:".length)} (Ollama, lokal)`;
  return AI_MODELS[id]?.label ?? id;
}
