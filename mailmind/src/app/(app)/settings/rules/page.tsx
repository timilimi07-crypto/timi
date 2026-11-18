import type { Metadata } from "next";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { parseRule } from "@/server/rules/engine";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { RulesEditor, type RuleRow } from "./rules-editor";

export const metadata: Metadata = { title: "Regeln" };

/** Regel-Editor: „Wenn Absender/Kategorie/Stichwort X, dann zuweisen/labeln/priorisieren“. */
export default async function RulesPage() {
  const session = await requireSession();
  const [rules, users, labels, categories, mailboxes] = await Promise.all([
    db.rule.findMany({ where: scoped(session), orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.user.findMany({ where: scoped(session, { isActive: true }), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.label.findMany({ where: scoped(session), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ where: scoped(session), orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    db.mailbox.findMany({ where: scoped(session), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const rows: RuleRow[] = rules.flatMap((r) => {
    const p = parseRule(r);
    return p ? [{ id: r.id, name: r.name, enabled: r.enabled, stopProcessing: r.stopProcessing, conditions: p.conditions, actions: p.actions, matchCount: r.matchCount }] : [];
  });
  return <RulesEditor rules={rows} options={{ users, labels, categories, mailboxes }} canEdit={can(session.role, "rules.manage")} />;
}
