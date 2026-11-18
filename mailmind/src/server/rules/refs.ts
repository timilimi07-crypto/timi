import { db } from "@/lib/db";
import { HttpError } from "@/server/session";
import type { RuleInput } from "./schema";

/** Prüft, dass alle in einer Regel genannten Personen, Labels, Kategorien und Postfächer zur Firma gehören. */
export async function validateRuleRefs(organizationId: string, input: Pick<RuleInput, "conditions" | "actions">) {
  const userIds = input.actions.flatMap((a) => (a.type === "assign" ? [a.userId] : []));
  const labelIds = input.actions.flatMap((a) => (a.type === "label" ? [a.labelId] : []));
  const categoryKeys = [
    ...input.actions.flatMap((a) => (a.type === "category" ? [a.categoryKey] : [])),
    ...input.conditions.items.filter((c) => c.field === "category").map((c) => c.value),
  ];
  const mailboxIds = input.conditions.items.filter((c) => c.field === "mailbox").map((c) => c.value);

  const [users, labels, categories, mailboxes] = await Promise.all([
    userIds.length ? db.user.count({ where: { organizationId, id: { in: userIds }, isActive: true } }) : 0,
    labelIds.length ? db.label.count({ where: { organizationId, id: { in: labelIds } } }) : 0,
    categoryKeys.length ? db.category.count({ where: { organizationId, key: { in: categoryKeys } } }) : 0,
    mailboxIds.length ? db.mailbox.count({ where: { organizationId, id: { in: mailboxIds } } }) : 0,
  ]);
  const uniq = (a: string[]) => new Set(a).size;
  if (users !== uniq(userIds)) throw new HttpError(400, "Unbekannte oder deaktivierte Person in der Regel");
  if (labels !== uniq(labelIds)) throw new HttpError(400, "Unbekanntes Label in der Regel");
  if (categories !== uniq(categoryKeys)) throw new HttpError(400, "Unbekannte Kategorie in der Regel");
  if (mailboxes !== uniq(mailboxIds)) throw new HttpError(400, "Unbekanntes Postfach in der Regel");
}
