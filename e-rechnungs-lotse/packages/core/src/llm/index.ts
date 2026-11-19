/**
 * ZENTRALES LLM-MODUL – der einzige erlaubte Weg zu einem Sprachmodell.
 *
 * Regeln (siehe CLAUDE.md):
 * - Abschaltbar per Feature-Flag (Standard: AUS).
 * - Nur EU-Endpunkte (Host muss in `allowedHosts` stehen und in docs/subprozessoren.md dokumentiert sein).
 * - Datenminimierung: Es werden nur explizit freigegebene Felder gesendet; die technische Meldung wird
 *   zusätzlich bereinigt (keine Zahlen, keine Werte in Anführungszeichen, keine IBANs/E-Mails/URLs).
 * - Logging enthält nur Metadaten, nie Inhalte.
 * - Ergebnisse sind reine Erklärtexte. Beträge, Steuersätze, IBAN, Rechnungsnummer und Datumsangaben
 *   werden NIE aus LLM-Antworten übernommen, sondern ausschließlich aus dem XML gelesen.
 */
import { z } from "zod";

export type LlmPurpose = "erklaerung_regel";

export interface LlmConfig {
  enabled: boolean;
  endpoint: string | null;
  /** Erlaubte Hosts (EU-Region). Wird gegen den Endpunkt geprüft. */
  allowedHosts: readonly string[];
}

export interface LlmLogEvent {
  purpose: LlmPurpose;
  outcome: "deaktiviert" | "ok" | "fehler" | "ungueltig";
  durationMs: number;
  /** Nur Namen der gesendeten Felder, nie Werte. */
  sentFields: readonly string[];
}

export interface LlmTransport {
  complete(input: { endpoint: string; prompt: string }): Promise<string>;
}

/** Eingabe für die Erklärung einer unbekannten Prüfregel. Mehr Felder gibt es bewusst nicht. */
export interface RuleExplainInput {
  ruleId: string;
  technicalMessage: string;
  /** Betroffenes Feld als EN-16931-ID (z. B. "BT-10") oder `null`. */
  field: string | null;
}

export const LlmRuleExplanationSchema = z
  .object({
    titel: z.string().trim().min(3).max(80),
    erklaerung_einfach: z.string().trim().min(10).max(400),
    was_tun: z.string().trim().min(5).max(300),
  })
  .strip();

export type LlmRuleExplanation = z.infer<typeof LlmRuleExplanationSchema>;

export interface LlmGateway {
  readonly enabled: boolean;
  explainRule(input: RuleExplainInput): Promise<LlmRuleExplanation | null>;
}

/** Erlaubte Felder pro Zweck. Alles andere wird nicht gesendet. */
const ALLOWED_FIELDS: Record<LlmPurpose, readonly (keyof RuleExplainInput)[]> = {
  erklaerung_regel: ["ruleId", "technicalMessage", "field"],
};

const MAX_MESSAGE = 300;

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

/**
 * Entfernt alles, was Rechnungsinhalt sein könnte, aus einer technischen Meldung:
 * Text in Anführungszeichen, URLs, E-Mail-Adressen, IBAN-artige Zeichenketten und alle Ziffernfolgen
 * (außer in Kennungen wie BT-10, BG-23, BR-DE-15, BR-CO-10).
 */
export function redactTechnicalMessage(message: string): string {
  const keep: string[] = [];
  // Platzhalter ohne Ziffern (Zeichen aus dem Private-Use-Bereich), damit der Ziffernfilter sie nicht trifft.
  const protect = (s: string) => `\uE000${String.fromCharCode(0xe100 + keep.push(s) - 1)}\uE000`;
  let s = message
    .replace(/["„“«»][^"„“«»]*["“”»«]/g, "„…“")
    .replace(/'[^']*'/g, "'…'")
    .replace(/\bhttps?:\/\/\S+/gi, "[URL]")
    .replace(/[^\s@]+@[^\s@]+/g, "[E-Mail]")
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/g, "[IBAN]")
    .replace(
      /\b(?:BT|BG|BR(?:-[A-Z]{1,3})?|UBL-CR|CII-SR|PEPPOL-EN16931-R)-?\d+[a-z]?\b/g,
      protect,
    );
  s = s.replace(/\d+(?:[.,:/-]\d+)*/g, "#");
  s = s.replace(/\uE000(.)\uE000/g, (_m, c: string) => keep[c.charCodeAt(0) - 0xe100]!);
  s = s.replace(/\s+/g, " ").trim();
  return s.length > MAX_MESSAGE ? s.slice(0, MAX_MESSAGE) + " …" : s;
}

export function minimize(purpose: LlmPurpose, input: RuleExplainInput): Partial<RuleExplainInput> {
  const out: Partial<RuleExplainInput> = {};
  for (const key of ALLOWED_FIELDS[purpose]) {
    (out as Record<string, unknown>)[key] = input[key];
  }
  return out;
}

function sanitizeInput(input: RuleExplainInput): RuleExplainInput {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(input.ruleId)) throw new Error("Ungültige Regel-ID.");
  return {
    ruleId: input.ruleId,
    technicalMessage: redactTechnicalMessage(input.technicalMessage),
    field: input.field && /^B[TG]-\d{1,3}$/.test(input.field) ? input.field : null,
  };
}

function parseAnswer(answer: string): LlmRuleExplanation | null {
  const json = answer.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const parsed = LlmRuleExplanationSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function buildRulePrompt(payload: Partial<RuleExplainInput>): string {
  return (
    "Du erklärst Handwerkern ohne Buchhaltungswissen Prüfmeldungen zu deutschen E-Rechnungen " +
    "(XRechnung, ZUGFeRD, EN 16931). Antworte ausschließlich mit einem JSON-Objekt mit den Schlüsseln " +
    '"titel" (höchstens 6 Wörter), "erklaerung_einfach" (1–2 kurze Sätze) und "was_tun" (1 Satz). ' +
    "Einfaches Deutsch, Anrede „Sie“. Nenne keine Beträge, Daten, Namen, IBANs oder Rechnungsnummern. " +
    "Erfinde keine Rechtsfolgen.\n" +
    JSON.stringify(payload)
  );
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
    async explainRule(input) {
      const purpose: LlmPurpose = "erklaerung_regel";
      const started = now();
      if (!config.enabled) {
        log({ purpose, outcome: "deaktiviert", durationMs: 0, sentFields: [] });
        return null;
      }
      const endpoint = assertEndpointAllowed(config);
      const payload = minimize(purpose, sanitizeInput(input));
      const sentFields = Object.keys(payload);
      try {
        const answer = await transport.complete({ endpoint, prompt: buildRulePrompt(payload) });
        const parsed = parseAnswer(answer);
        log({
          purpose,
          outcome: parsed ? "ok" : "ungueltig",
          durationMs: now() - started,
          sentFields,
        });
        return parsed;
      } catch {
        log({ purpose, outcome: "fehler", durationMs: now() - started, sentFields });
        return null;
      }
    },
  };
}

/**
 * Transport für OpenAI-kompatible Chat-Completions-Endpunkte (z. B. EU-Anbieter mit diesem Format).
 * Kein SDK – nur fetch. API-Schlüssel kommt aus dem Secret-Management (LLM_API_KEY).
 */
export function createChatCompletionsTransport(opts: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}): LlmTransport {
  const doFetch = opts.fetch ?? fetch;
  return {
    async complete({ endpoint, prompt }) {
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("LLM-Antwort ohne Inhalt");
      return content;
    },
  };
}
