/**
 * Erklär-Schicht: verbindet Prüfbefunde mit verständlichen Erklärungen.
 *
 * Reihenfolge je Befund:
 * 1. Erklärtabelle (de.json) – exakt oder per Präfix (z. B. "cvc-*")
 * 2. Cache (nur nach Regel-ID; Inhalte stammen aus früheren LLM-Erklärungen)
 * 3. LLM über packages/core/llm – NUR Regel-ID, bereinigte technische Meldung und BT-ID; nur bei Feature-Flag an
 * 4. Standardtext „Technische Meldung, bitte an Lieferant weitergeben“
 */
import { sortBySeverity, type ValidationFinding } from "../findings";
import type { LlmGateway } from "../llm/index";
import type { NormalizedInvoice } from "../types";
import { lookupExplanation, type ExplanationEntry } from "./table";

export {
  EXPLANATIONS,
  ExplanationEntrySchema,
  ExplanationTableSchema,
  lookupExplanation,
  type ExplanationEntry,
  type ExplanationTable,
} from "./table";

/** tabelle = gepflegter Text · automatisch = vom Sprachmodell erklärt · standardtext = Fallback */
export type ExplanationSource = "tabelle" | "automatisch" | "standardtext";

export interface Explanation extends ExplanationEntry {
  quelle: ExplanationSource;
}

export interface ExplainedFinding extends ValidationFinding {
  erklaerung: Explanation;
  /** Weitere Befunde mit derselben Bedeutung (z. B. eigene Regel und KoSIT-Regel zur selben Rechenabweichung). */
  verwandt?: Pick<ValidationFinding, "ruleId" | "source" | "location" | "technicalMessage">[];
}

/**
 * Fasst Befunde gleicher Schwere und gleichen Titels zusammen – der Empfänger sieht jedes Problem einmal,
 * die technischen Details aller beteiligten Regeln bleiben erhalten.
 */
export function mergeEquivalent(findings: readonly ExplainedFinding[]): ExplainedFinding[] {
  const out: ExplainedFinding[] = [];
  const index = new Map<string, ExplainedFinding>();
  for (const f of findings) {
    const key = `${f.severity}|${f.erklaerung.titel}`;
    const first = index.get(key);
    if (!first) {
      const copy = { ...f };
      index.set(key, copy);
      out.push(copy);
      continue;
    }
    const { ruleId, source, location, technicalMessage } = f;
    first.verwandt = [...(first.verwandt ?? []), { ruleId, source, location, technicalMessage }];
  }
  return out;
}

/** Cache für automatische Erklärungen – Schlüssel ist ausschließlich die Regel-ID. */
export interface ExplanationCache {
  get(ruleId: string): Promise<ExplanationEntry | null>;
  set(ruleId: string, entry: ExplanationEntry): Promise<void>;
}

export function memoryExplanationCache(): ExplanationCache {
  const map = new Map<string, ExplanationEntry>();
  return {
    get: async (id) => map.get(id) ?? null,
    set: async (id, e) => void map.set(id, e),
  };
}

export const FALLBACK_TEXT = "Technische Meldung, bitte an Lieferant weitergeben.";

export function fallbackExplanation(f: ValidationFinding): Explanation {
  return {
    titel: f.message && f.message !== f.ruleId ? shorten(f.message) : "Technische Meldung",
    erklaerung_einfach: FALLBACK_TEXT,
    was_tun: "Leiten Sie die technische Meldung unten an Ihren Lieferanten weiter.",
    betrifft_mich_als_empfaenger: f.severity !== "info",
    quelle: "standardtext",
  };
}

function shorten(s: string, max = 80): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

export function explainFromTable(f: ValidationFinding): Explanation | null {
  const hit = lookupExplanation(f.ruleId);
  return hit ? { ...hit.entry, quelle: "tabelle" } : null;
}

/** Betroffenes Feld (BT-/BG-ID) aus Fundstelle oder technischer Meldung. */
export function affectedField(f: ValidationFinding): string | null {
  return (
    f.location?.match(/\bB[TG]-\d+\b/)?.[0] ??
    f.technicalMessage.match(/\bB[TG]-\d+\b/)?.[0] ??
    null
  );
}

export interface ExplainOptions {
  /** LLM-Gateway; `null`/deaktiviert = Standardtext statt automatischer Erklärung. */
  llm?: LlmGateway | null;
  cache?: ExplanationCache | null;
  /** Konkrete Werte der Rechnung, die vor einem LLM-Aufruf aus der Meldung entfernt werden. */
  sensitiveValues?: readonly string[];
}

/** Alle konkreten Inhalte einer Rechnung, die nie an ein Sprachmodell gehen dürfen. */
export function sensitiveValuesOf(inv: NormalizedInvoice | undefined): string[] {
  if (!inv) return [];
  const parties = [inv.seller, inv.buyer].flatMap((p) => [
    p.name,
    p.vatId,
    p.taxNumber,
    p.address.street,
    p.address.additionalStreet,
    p.address.city,
    p.address.postalCode,
  ]);
  const values = [
    inv.invoiceNumber,
    inv.buyerReference,
    inv.issueDate,
    inv.dueDate,
    inv.deliveryDate,
    inv.taxRepresentativeVatId,
    ...parties,
    ...inv.ibans,
    ...Object.values(inv.totals),
    ...inv.taxBreakdown.flatMap((t) => [t.taxableAmount, t.taxAmount, t.exemptionReason]),
    ...inv.lines.flatMap((l) => [l.id, l.name, l.netAmount]),
  ];
  return [...new Set(values.filter((v): v is string => !!v && v.trim().length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
}

export function scrubValues(message: string, values: readonly string[]): string {
  let out = message;
  for (const v of values) out = out.split(v).join("[…]");
  return out;
}

/** Erklärt alle Befunde und sortiert sie nach Schwere (Fehler, Warnungen, Hinweise). */
export async function explainFindings(
  findings: readonly ValidationFinding[],
  opts: ExplainOptions = {},
): Promise<ExplainedFinding[]> {
  const auto = new Map<string, Promise<Explanation | null>>();

  const automatic = (f: ValidationFinding): Promise<Explanation | null> => {
    let p = auto.get(f.ruleId);
    if (!p) {
      p = (async () => {
        const cached = await opts.cache?.get(f.ruleId).catch(() => null);
        if (cached) return { ...cached, quelle: "automatisch" as const };
        if (!opts.llm?.enabled) return null;
        const answer = await opts.llm
          .explainRule({
            ruleId: f.ruleId,
            technicalMessage: scrubValues(f.technicalMessage, opts.sensitiveValues ?? []),
            field: affectedField(f),
          })
          .catch(() => null);
        if (!answer) return null;
        const entry: ExplanationEntry = {
          ...answer,
          betrifft_mich_als_empfaenger: f.severity !== "info",
        };
        await opts.cache?.set(f.ruleId, entry).catch(() => undefined);
        return { ...entry, quelle: "automatisch" as const };
      })();
      auto.set(f.ruleId, p);
    }
    return p;
  };

  const explained = await Promise.all(
    findings.map(async (f) => ({
      ...f,
      erklaerung: explainFromTable(f) ?? (await automatic(f)) ?? fallbackExplanation(f),
    })),
  );
  return sortBySeverity(explained);
}
