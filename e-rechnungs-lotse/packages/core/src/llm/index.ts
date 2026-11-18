/**
 * ZENTRALES LLM-MODUL – der einzige erlaubte Weg zu einem Sprachmodell.
 *
 * Regeln (siehe CLAUDE.md):
 * - Abschaltbar per Feature-Flag (Standard: AUS).
 * - Nur EU-Endpunkte (Host muss in `allowedHosts` stehen und in docs/subprozessoren.md dokumentiert sein).
 * - Datenminimierung: Es werden nur explizit freigegebene Felder gesendet.
 * - Logging enthält nur Metadaten, nie Inhalte.
 * - Ergebnisse sind reine Erklärtexte. Beträge, Steuersätze, IBAN, Rechnungsnummer und Datumsangaben
 *   werden NIE aus LLM-Antworten übernommen, sondern ausschließlich aus dem XML gelesen.
 */
import type { NormalizedInvoice } from "../types.js";

export type LlmPurpose = "erklaerung_pruefergebnis";

export interface LlmConfig {
  enabled: boolean;
  endpoint: string | null;
  /** Erlaubte Hosts (EU-Region). Wird gegen den Endpunkt geprüft. */
  allowedHosts: readonly string[];
}

export interface LlmLogEvent {
  purpose: LlmPurpose;
  outcome: "deaktiviert" | "ok" | "fehler";
  durationMs: number;
  /** Nur Namen der gesendeten Felder, nie Werte. */
  sentFields: readonly string[];
}

export interface LlmTransport {
  complete(input: { endpoint: string; prompt: string }): Promise<string>;
}

export interface LlmGateway {
  readonly enabled: boolean;
  explainFindings(input: ExplainInput): Promise<string | null>;
}

export interface ExplainInput {
  findingMessages: readonly string[];
  profile: NormalizedInvoice["format"]["profile"];
}

/** Erlaubte Felder pro Zweck. Alles andere wird nicht gesendet. */
const ALLOWED_FIELDS: Record<LlmPurpose, readonly (keyof ExplainInput)[]> = {
  erklaerung_pruefergebnis: ["findingMessages", "profile"],
};

export function readLlmConfig(env: Record<string, string | undefined>): LlmConfig {
  return {
    enabled: env["LLM_ENABLED"] === "true",
    endpoint: env["LLM_ENDPOINT"] || null,
    allowedHosts: (env["LLM_ALLOWED_HOSTS"] ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  };
}

export function assertEndpointAllowed(config: LlmConfig): string {
  if (!config.endpoint) throw new Error("LLM_ENDPOINT ist nicht gesetzt.");
  const host = new URL(config.endpoint).hostname;
  if (!config.allowedHosts.includes(host)) {
    throw new Error(
      `LLM-Endpunkt ${host} ist nicht freigegeben. Nur EU-Endpunkte aus LLM_ALLOWED_HOSTS sind erlaubt.`,
    );
  }
  return config.endpoint;
}

export function minimize<P extends LlmPurpose>(
  purpose: P,
  input: ExplainInput,
): Partial<ExplainInput> {
  const out: Partial<ExplainInput> = {};
  for (const key of ALLOWED_FIELDS[purpose]) {
    (out as Record<string, unknown>)[key] = input[key];
  }
  return out;
}

export function createLlmGateway(deps: {
  config: LlmConfig;
  transport: LlmTransport;
  log?: (event: LlmLogEvent) => void;
  now?: () => number;
}): LlmGateway {
  const { config, transport, log = () => {}, now = Date.now } = deps;
  return {
    enabled: config.enabled,
    async explainFindings(input) {
      const purpose: LlmPurpose = "erklaerung_pruefergebnis";
      const started = now();
      if (!config.enabled) {
        log({ purpose, outcome: "deaktiviert", durationMs: 0, sentFields: [] });
        return null;
      }
      const endpoint = assertEndpointAllowed(config);
      const payload = minimize(purpose, input);
      const sentFields = Object.keys(payload);
      try {
        const prompt =
          "Erkläre die folgenden Prüfhinweise zu einer E-Rechnung in einfachem Deutsch (Sie-Form). " +
          "Nenne keine Beträge, Daten, IBANs oder Rechnungsnummern.\n" +
          JSON.stringify(payload);
        const answer = await transport.complete({ endpoint, prompt });
        log({ purpose, outcome: "ok", durationMs: now() - started, sentFields });
        return answer;
      } catch {
        log({ purpose, outcome: "fehler", durationMs: now() - started, sentFields });
        return null;
      }
    },
  };
}
