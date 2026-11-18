import { z } from "zod";

/**
 * Regeln: „Wenn <Bedingungen> dann <Aktionen>“.
 * Gespeichert in Rule.conditions = { match, items } und Rule.actions = [...].
 */

export const CONDITION_FIELDS = {
  from: "Absender",
  subject: "Betreff",
  body: "Text",
  any: "Betreff oder Text",
  category: "Kategorie",
  priority: "Priorität",
  mailbox: "Postfach",
  hasAttachments: "Hat Anhang",
} as const;

export const CONDITION_OPS = {
  contains: "enthält",
  notContains: "enthält nicht",
  equals: "ist",
  notEquals: "ist nicht",
  startsWith: "beginnt mit",
  endsWith: "endet auf",
} as const;

/** Welche Operatoren pro Feld sinnvoll sind (UI + Validierung). */
export const OPS_BY_FIELD: Record<keyof typeof CONDITION_FIELDS, (keyof typeof CONDITION_OPS)[]> = {
  from: ["contains", "notContains", "equals", "endsWith"],
  subject: ["contains", "notContains", "startsWith", "equals"],
  body: ["contains", "notContains"],
  any: ["contains", "notContains"],
  category: ["equals", "notEquals"],
  priority: ["equals", "notEquals"],
  mailbox: ["equals", "notEquals"],
  hasAttachments: ["equals"],
};

export const conditionSchema = z
  .object({
    field: z.enum(Object.keys(CONDITION_FIELDS) as [keyof typeof CONDITION_FIELDS, ...(keyof typeof CONDITION_FIELDS)[]]),
    op: z.enum(Object.keys(CONDITION_OPS) as [keyof typeof CONDITION_OPS, ...(keyof typeof CONDITION_OPS)[]]),
    value: z.string().trim().min(1, "Bitte einen Wert für jede Bedingung angeben").max(200),
  })
  .refine((c) => OPS_BY_FIELD[c.field].includes(c.op), { message: "Dieser Vergleich passt nicht zum Feld", path: ["op"] });

const PRIORITY = z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]);
const STATUS = z.enum(["NEW", "IN_PROGRESS", "WAITING", "DONE"]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign"), userId: z.string().min(1, "Bitte eine Person wählen") }),
  z.object({ type: z.literal("label"), labelId: z.string().min(1, "Bitte ein Label wählen") }),
  z.object({ type: z.literal("priority"), priority: PRIORITY }),
  z.object({ type: z.literal("category"), categoryKey: z.string().min(1, "Bitte eine Kategorie wählen") }),
  z.object({ type: z.literal("status"), status: STATUS }),
  z.object({ type: z.literal("collapse") }),
  z.object({ type: z.literal("markRead") }),
]);

export const ACTION_LABELS: Record<z.infer<typeof actionSchema>["type"], string> = {
  assign: "Zuweisen an",
  label: "Label setzen",
  priority: "Priorität setzen",
  category: "Kategorie setzen",
  status: "Status setzen",
  collapse: "Einklappen (wie Newsletter)",
  markRead: "Als gelesen markieren",
};

export const ruleConditionsSchema = z.object({
  match: z.enum(["all", "any"]).default("all"),
  items: z.array(conditionSchema).min(1, "Mindestens eine Bedingung").max(10),
});

export const ruleInputSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben").max(80),
  enabled: z.boolean().default(true),
  stopProcessing: z.boolean().default(false),
  conditions: ruleConditionsSchema,
  actions: z.array(actionSchema).min(1, "Mindestens eine Aktion").max(10),
});

export type Condition = z.infer<typeof conditionSchema>;
export type RuleAction = z.infer<typeof actionSchema>;
export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type RuleInput = z.infer<typeof ruleInputSchema>;
