import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ruleConditionsSchema, actionSchema, type Condition, type RuleAction, type RuleConditions } from "./schema";

/** Die Merkmale einer E-Mail, gegen die Regeln geprüft werden. */
export type EmailFacts = {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  categoryKey: string | null;
  priority: string | null;
  mailboxId: string;
  hasAttachments: boolean;
};

const norm = (s: string) => s.normalize("NFC").toLowerCase().trim();

function textMatch(haystack: string, op: Condition["op"], needle: string): boolean {
  const h = norm(haystack);
  const n = norm(needle);
  switch (op) {
    case "contains":
      return h.includes(n);
    case "notContains":
      return !h.includes(n);
    case "equals":
      return h === n;
    case "notEquals":
      return h !== n;
    case "startsWith":
      return h.startsWith(n);
    case "endsWith":
      return h.endsWith(n);
  }
}

/** Prüft eine einzelne Bedingung (Groß-/Kleinschreibung egal). */
export function matchesCondition(c: Condition, e: EmailFacts): boolean {
  switch (c.field) {
    case "from": {
      // „ist“/„endet auf“ beziehen sich auf die Adresse (z. B. „@steuerberater.de“),
      // „enthält“ zusätzlich auf den Anzeigenamen.
      if (c.op === "equals" || c.op === "endsWith") return textMatch(e.fromEmail, c.op, c.value);
      const both = `${e.fromName ?? ""} <${e.fromEmail}>`;
      return textMatch(both, c.op, c.value);
    }
    case "subject":
      return textMatch(e.subject, c.op, c.value);
    case "body":
      return textMatch(e.bodyText, c.op, c.value);
    case "any":
      return c.op === "notContains"
        ? textMatch(e.subject, "notContains", c.value) && textMatch(e.bodyText, "notContains", c.value)
        : textMatch(e.subject, "contains", c.value) || textMatch(e.bodyText, "contains", c.value);
    case "category":
      return c.op === "equals" ? e.categoryKey === c.value : e.categoryKey !== c.value;
    case "priority":
      return c.op === "equals" ? e.priority === c.value : e.priority !== c.value;
    case "mailbox":
      return c.op === "equals" ? e.mailboxId === c.value : e.mailboxId !== c.value;
    case "hasAttachments":
      return e.hasAttachments === (c.value === "ja");
  }
}

export function matchesRule(conditions: RuleConditions, e: EmailFacts): boolean {
  const results = conditions.items.map((c) => matchesCondition(c, e));
  return conditions.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

type ParsedRule = { id: string; name: string; stopProcessing: boolean; conditions: RuleConditions; actions: RuleAction[] };

/** Gespeicherte Regeln einlesen; fehlerhafte (z. B. von Hand in der DB geändert) werden übersprungen. */
export function parseRule(r: { id: string; name: string; stopProcessing: boolean; conditions: Prisma.JsonValue; actions: Prisma.JsonValue }): ParsedRule | null {
  const c = ruleConditionsSchema.safeParse(r.conditions);
  const a = actionSchema.array().safeParse(r.actions);
  if (!c.success || !a.success) return null;
  return { id: r.id, name: r.name, stopProcessing: r.stopProcessing, conditions: c.data, actions: a.data };
}

/**
 * Welche Regeln greifen und was ergibt sich daraus? Reine Funktion (testbar).
 * Reihenfolge = sortOrder; spätere Regeln überschreiben frühere beim selben
 * Feld (Priorität, Kategorie, …). Labels sammeln sich. „Weitere Regeln nicht
 * ausführen“ beendet die Auswertung.
 */
export function evaluateRules(rules: ParsedRule[], e: EmailFacts) {
  const matched: ParsedRule[] = [];
  const result: {
    assigneeId?: string;
    priority?: string;
    categoryKey?: string;
    status?: string;
    collapse?: boolean;
    markRead?: boolean;
    labelIds: string[];
  } = { labelIds: [] };

  for (const rule of rules) {
    if (!matchesRule(rule.conditions, e)) continue;
    matched.push(rule);
    for (const a of rule.actions) {
      if (a.type === "assign") result.assigneeId = a.userId;
      if (a.type === "priority") result.priority = a.priority;
      if (a.type === "category") result.categoryKey = a.categoryKey;
      if (a.type === "status") result.status = a.status;
      if (a.type === "collapse") result.collapse = true;
      if (a.type === "markRead") result.markRead = true;
      if (a.type === "label" && !result.labelIds.includes(a.labelId)) result.labelIds.push(a.labelId);
    }
    if (rule.stopProcessing) break;
  }
  return { matched, result };
}

export function factsFromEmail(e: {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  priority: string | null;
  mailboxId: string;
  hasAttachments: boolean;
  category: { key: string } | null;
}): EmailFacts {
  return {
    fromEmail: e.fromEmail,
    fromName: e.fromName,
    subject: e.subject,
    bodyText: e.bodyText,
    categoryKey: e.category?.key ?? null,
    priority: e.priority,
    mailboxId: e.mailboxId,
    hasAttachments: e.hasAttachments,
  };
}

export async function loadRules(organizationId: string): Promise<ParsedRule[]> {
  const rules = await db.rule.findMany({ where: { organizationId, enabled: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rules.map(parseRule).filter((r): r is ParsedRule => !!r);
}

/**
 * Regeln auf eine E-Mail anwenden. Läuft nach der KI-Auswertung (damit
 * Bedingungen auf Kategorie/Priorität möglich sind und Regeln die KI
 * übersteuern) bzw. direkt nach dem Abruf, wenn keine KI aktiv ist.
 * Idempotent: erneutes Anwenden setzt dieselben Werte; der Trefferzähler
 * zählt nur die erste Anwendung.
 */
export async function applyRules(emailId: string, opts: { rules?: ParsedRule[]; force?: boolean; skipCounter?: boolean } = {}) {
  const email = await db.email.findUnique({
    where: { id: emailId },
    include: { category: { select: { key: true } } },
  });
  if (!email || email.deletedAt) return { matched: [] as string[] };
  if (email.rulesAppliedAt && !opts.force) return { matched: [] as string[] };

  const rules = opts.rules ?? (await loadRules(email.organizationId));
  const { matched, result } = evaluateRules(rules, factsFromEmail(email));
  const firstTime = !email.rulesAppliedAt;

  const data: Prisma.EmailUncheckedUpdateInput = { rulesAppliedAt: new Date() };
  if (matched.length) {
    // Nur Personen/Kategorien/Labels der eigenen Firma übernehmen (Schutz gegen veraltete IDs).
    const [assignee, category, labels] = await Promise.all([
      result.assigneeId
        ? db.user.findFirst({ where: { id: result.assigneeId, organizationId: email.organizationId, isActive: true }, select: { id: true } })
        : null,
      result.categoryKey
        ? db.category.findFirst({ where: { organizationId: email.organizationId, key: result.categoryKey }, select: { id: true, autoCollapse: true } })
        : null,
      result.labelIds.length ? db.label.findMany({ where: { organizationId: email.organizationId, id: { in: result.labelIds } }, select: { id: true } }) : [],
    ]);
    if (assignee) data.assigneeId = assignee.id;
    if (category) Object.assign(data, { categoryId: category.id, isCollapsed: category.autoCollapse && !email.phishingSuspected });
    if (result.priority) data.priority = result.priority as Prisma.EmailUncheckedUpdateInput["priority"];
    // Von einer Regel festgelegte Einordnung gilt als bestätigt (kein „Bitte prüfen“, KI ändert sie nicht mehr).
    if (category || result.priority) Object.assign(data, { manualOverride: true, needsReview: false, reviewReason: null });
    if (result.status) data.status = result.status as Prisma.EmailUncheckedUpdateInput["status"];
    if (result.collapse && !email.phishingSuspected) data.isCollapsed = true;
    if (result.markRead) data.isRead = true;

    await db.$transaction([
      db.email.update({ where: { id: emailId }, data }),
      ...(labels.length ? [db.emailLabel.createMany({ data: labels.map((l) => ({ emailId, labelId: l.id })), skipDuplicates: true })] : []),
      ...(firstTime && !opts.skipCounter ? matched.map((r) => db.rule.update({ where: { id: r.id }, data: { matchCount: { increment: 1 } } })) : []),
      // Im Bearbeitungsverlauf festhalten (auch beim nachträglichen Anwenden).
      ...(firstTime || opts.force
        ? [
            db.auditLog.create({
              data: {
                organizationId: email.organizationId,
                action: "rule.apply",
                entityType: "email",
                entityId: emailId,
                metadata: { rules: matched.map((r) => r.name), ...result } as Prisma.InputJsonValue,
              },
            }),
          ]
        : []),
    ]);
    if (assignee && email.threadId) {
      await db.task.updateMany({ where: { email: { threadId: email.threadId }, status: "OPEN", assigneeId: null }, data: { assigneeId: assignee.id } });
    }
  } else {
    await db.email.update({ where: { id: emailId }, data });
  }
  return { matched: matched.map((r) => r.name) };
}
