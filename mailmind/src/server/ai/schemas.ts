import { z } from "zod";

/**
 * Strukturierte KI-Ausgaben (zod). Die Schemas werden als JSON-Schema an die
 * API übergeben (Structured Outputs) und zusätzlich clientseitig validiert.
 * Die erlaubten Kategorien sind pro Firma unterschiedlich → Schema pro Firma.
 */

const confidence = z
  .number()
  .min(0)
  .max(1)
  .describe("Selbsteinschätzung 0–1: 0.9+ eindeutig, 0.7–0.9 wahrscheinlich, < 0.7 unsicher");

function categoryEnum(keys: string[]) {
  if (keys.length === 0) throw new Error("Firma hat keine Kategorien");
  return z.enum(keys as [string, ...string[]]);
}

export function triageSchema(categoryKeys: string[]) {
  return z.object({
    category: categoryEnum(categoryKeys).describe("Schlüssel der passendsten Kategorie"),
    categoryConfidence: confidence,
    isBulk: z.boolean().describe("true bei Newsletter, Werbung, Massen- oder automatisch erzeugten Benachrichtigungen"),
    summary: z.string().describe("Ein kurzer deutscher Satz, worum es geht"),
  });
}
export type TriageResult = z.infer<ReturnType<typeof triageSchema>>;

export const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;
export const ENTITY_TYPES = ["AMOUNT", "INVOICE_NUMBER", "ORDER_NUMBER", "DATE", "CONTACT", "PHONE", "OTHER"] as const;

export function analysisSchema(categoryKeys: string[]) {
  return z.object({
    summary: z.string().describe("1–3 deutsche Sätze: wer will was bis wann"),
    category: categoryEnum(categoryKeys),
    categoryConfidence: confidence,
    priority: z.enum(PRIORITIES),
    priorityConfidence: confidence,
    priorityReason: z.string().describe("Kurze Begründung der Priorität, max. 1 Satz"),
    sentiment: z.enum(SENTIMENTS).describe("Stimmung des Absenders"),
    tasks: z
      .array(
        z.object({
          title: z.string().describe("Konkrete Aufgabe für uns, im Imperativ, max. 80 Zeichen"),
          dueDate: z.string().nullable().describe("Frist als YYYY-MM-DD oder null"),
          dueDateText: z.string().nullable().describe("Originalformulierung der Frist oder null"),
        }),
      )
      .describe("Leer, wenn nichts zu tun ist"),
    entities: z.array(
      z.object({
        type: z.enum(ENTITY_TYPES),
        label: z.string().describe("Deutsche Bezeichnung, z. B. Rechnungsbetrag, Rechnungsnummer, Termin, Ansprechpartner"),
        value: z.string().describe("Wert wie in der E-Mail"),
        normalizedValue: z.string().nullable().describe("Betrag als 1234.50 EUR, Datum als YYYY-MM-DD, sonst null"),
      }),
    ),
  });
}
export type AnalysisResult = z.infer<ReturnType<typeof analysisSchema>>;

export const threadSummarySchema = z.object({
  summary: z.string().describe("2–4 deutsche Sätze zum gesamten Verlauf inkl. aktuellem Stand und was offen ist"),
});
export type ThreadSummaryResult = z.infer<typeof threadSummarySchema>;

/** Gültiges ISO-Datum (YYYY-MM-DD) → Date (12:00 Uhr UTC, damit die Zeitzone den Tag nicht verschiebt). */
export function parseDueDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}
