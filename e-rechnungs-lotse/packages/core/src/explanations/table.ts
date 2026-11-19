/**
 * Erklärtabelle (de.json) – die EINZIGE Quelle für deutsche Anzeigetexte zu Prüfregeln.
 * Wird beim Laden mit zod validiert; ein fehlerhafter Eintrag bricht den Start (und die Tests) ab.
 */
import { z } from "zod";
import raw from "./de.json";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const ExplanationEntrySchema = z
  .object({
    /** Kurzer Titel, wenige Wörter. */
    titel: text(3, 80),
    /** Ein bis zwei einfache Sätze: Was ist los? */
    erklaerung_einfach: text(10, 400),
    /** Konkrete Handlung für den Empfänger. */
    was_tun: text(5, 300),
    /** Ist der Punkt für Zahlung oder Vorsteuerabzug des Empfängers relevant? */
    betrifft_mich_als_empfaenger: z.boolean(),
    /** Optional: Warum das wichtig ist (z. B. Vorsteuer). */
    schwere_hinweis: text(5, 300).optional(),
    /** Optional: Satz für die Rückfrage-E-Mail an den Lieferanten. */
    bitte_an_lieferant: text(10, 400).optional(),
  })
  .strict();

export type ExplanationEntry = z.infer<typeof ExplanationEntrySchema>;

export const ExplanationTableSchema = z
  .object({
    schemaVersion: z.literal(1),
    /** Inhaltsversion, z. B. "2026-11-19.1" – bei jeder Textänderung erhöhen. */
    version: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
    sprache: z.literal("de"),
    /** Schlüssel: exakte Regel-ID oder Präfix mit "*" am Ende (z. B. "cvc-*"). */
    regeln: z.record(z.string().regex(/^[A-Za-z0-9.-]+\*?$/), ExplanationEntrySchema),
  })
  .strict();

export type ExplanationTable = z.infer<typeof ExplanationTableSchema>;

export const EXPLANATIONS: ExplanationTable = ExplanationTableSchema.parse(raw);

const wildcards = Object.keys(EXPLANATIONS.regeln)
  .filter((k) => k.endsWith("*"))
  .sort((a, b) => b.length - a.length);

/** Sucht den Eintrag zu einer Regel-ID: zuerst exakt, dann längster passender Präfix-Eintrag. */
export function lookupExplanation(
  ruleId: string,
  table: ExplanationTable = EXPLANATIONS,
): { key: string; entry: ExplanationEntry } | null {
  const exact = table.regeln[ruleId];
  if (exact) return { key: ruleId, entry: exact };
  const key = (
    table === EXPLANATIONS ? wildcards : Object.keys(table.regeln).filter((k) => k.endsWith("*"))
  ).find((k) => ruleId.startsWith(k.slice(0, -1)));
  return key ? { key, entry: table.regeln[key]! } : null;
}
