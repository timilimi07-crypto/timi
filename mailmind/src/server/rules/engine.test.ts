import { describe, expect, it } from "vitest";
import { evaluateRules, matchesCondition, matchesRule, type EmailFacts } from "./engine";
import { ruleInputSchema } from "./schema";

const mail: EmailFacts = {
  fromEmail: "s.kurz@kanzlei-seidel.de",
  fromName: "Sabine Kurz",
  subject: "Unterlagen für die Umsatzsteuer-Voranmeldung Oktober",
  bodyText: "Bitte laden Sie die Kontoauszüge bis 10.12. hoch.",
  categoryKey: "rechnung",
  priority: "NORMAL",
  mailboxId: "mb-buchhaltung",
  hasAttachments: false,
};

const rule = (id: string, items: object[], actions: object[], extra: object = {}) => ({
  id,
  name: id,
  stopProcessing: false,
  conditions: { match: "all" as const, items: items as never },
  actions: actions as never,
  ...extra,
});

describe("Bedingungen", () => {
  it("Absender: Domain per „endet auf“, Name per „enthält“, ohne Groß-/Kleinschreibung", () => {
    expect(matchesCondition({ field: "from", op: "endsWith", value: "@Kanzlei-Seidel.de" }, mail)).toBe(true);
    expect(matchesCondition({ field: "from", op: "contains", value: "sabine" }, mail)).toBe(true);
    expect(matchesCondition({ field: "from", op: "equals", value: "s.kurz@kanzlei-seidel.de" }, mail)).toBe(true);
    expect(matchesCondition({ field: "from", op: "notContains", value: "seidel" }, mail)).toBe(false);
  });

  it("Betreff/Text/„Betreff oder Text“ mit Umlauten", () => {
    expect(matchesCondition({ field: "subject", op: "startsWith", value: "unterlagen" }, mail)).toBe(true);
    expect(matchesCondition({ field: "body", op: "contains", value: "KONTOAUSZÜGE" }, mail)).toBe(true);
    expect(matchesCondition({ field: "any", op: "contains", value: "umsatzsteuer" }, mail)).toBe(true);
    expect(matchesCondition({ field: "any", op: "notContains", value: "mahnung" }, mail)).toBe(true);
  });

  it("Kategorie, Priorität, Postfach, Anhang", () => {
    expect(matchesCondition({ field: "category", op: "equals", value: "rechnung" }, mail)).toBe(true);
    expect(matchesCondition({ field: "category", op: "notEquals", value: "rechnung" }, mail)).toBe(false);
    expect(matchesCondition({ field: "priority", op: "equals", value: "URGENT" }, mail)).toBe(false);
    expect(matchesCondition({ field: "mailbox", op: "equals", value: "mb-buchhaltung" }, mail)).toBe(true);
    expect(matchesCondition({ field: "hasAttachments", op: "equals", value: "nein" }, mail)).toBe(true);
  });

  it("„alle“ vs. „mindestens eine“", () => {
    const items = [
      { field: "from" as const, op: "endsWith" as const, value: "kanzlei-seidel.de" },
      { field: "subject" as const, op: "contains" as const, value: "Mahnung" },
    ];
    expect(matchesRule({ match: "all", items }, mail)).toBe(false);
    expect(matchesRule({ match: "any", items }, mail)).toBe(true);
  });
});

describe("Auswertung mehrerer Regeln", () => {
  it("spätere Regel überschreibt, Labels sammeln sich, „stopp“ beendet", () => {
    const rules = [
      rule("steuerberater", [{ field: "from", op: "endsWith", value: "kanzlei-seidel.de" }], [
        { type: "assign", userId: "anna" },
        { type: "priority", priority: "HIGH" },
        { type: "label", labelId: "steuer" },
      ]),
      rule("frist", [{ field: "body", op: "contains", value: "bis" }], [
        { type: "priority", priority: "URGENT" },
        { type: "label", labelId: "frist" },
      ], { stopProcessing: true }),
      rule("nie-erreicht", [{ field: "any", op: "contains", value: "Umsatzsteuer" }], [{ type: "assign", userId: "lea" }]),
    ];
    const { matched, result } = evaluateRules(rules, mail);
    expect(matched.map((r) => r.id)).toEqual(["steuerberater", "frist"]);
    expect(result).toEqual({ assigneeId: "anna", priority: "URGENT", labelIds: ["steuer", "frist"] });
  });
});

describe("Validierung", () => {
  it("verlangt passende Vergleiche, Werte und mindestens eine Aktion", () => {
    const ok = {
      name: "Steuerberater",
      conditions: { match: "all", items: [{ field: "from", op: "endsWith", value: "@kanzlei-seidel.de" }] },
      actions: [{ type: "priority", priority: "HIGH" }],
    };
    expect(ruleInputSchema.safeParse(ok).success).toBe(true);
    const badOp = ruleInputSchema.safeParse({ ...ok, conditions: { match: "all", items: [{ field: "category", op: "contains", value: "x" }] } });
    expect(badOp.error?.issues[0]?.message).toBe("Dieser Vergleich passt nicht zum Feld");
    expect(ruleInputSchema.safeParse({ ...ok, actions: [] }).error?.issues[0]?.message).toBe("Mindestens eine Aktion");
    expect(ruleInputSchema.safeParse({ ...ok, conditions: { match: "all", items: [{ field: "from", op: "contains", value: " " }] } }).success).toBe(false);
  });
});
