import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { categoryUpdateSchema } from "@/server/validation/team";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH – Name, Beschreibung (für die KI), Farbe, „automatisch einklappen“. Der Schlüssel bleibt stabil. */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("categories.manage");
  const { id } = await params;
  const input = categoryUpdateSchema.parse(await readJson(req));
  const cat = await db.category.findFirst({ where: scoped(session, { id }) });
  if (!cat) throw new HttpError(404, "Kategorie nicht gefunden");
  await db.category.update({ where: { id }, data: input });
  // Einklappen nachziehen, damit die Einstellung sofort für vorhandene E-Mails gilt (Phishing bleibt sichtbar).
  if (input.autoCollapse !== undefined && input.autoCollapse !== cat.autoCollapse) {
    await db.email.updateMany({ where: { categoryId: id, phishingSuspected: false }, data: { isCollapsed: input.autoCollapse } });
  }
  await audit(session, "category.update", { type: "category", id }, input);
  return { ok: true };
});

/** DELETE – nur eigene (nicht vorinstallierte) Kategorien; E-Mails verlieren die Kategorie. */
export const DELETE = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("categories.manage");
  const { id } = await params;
  const cat = await db.category.findFirst({ where: scoped(session, { id }) });
  if (!cat) throw new HttpError(404, "Kategorie nicht gefunden");
  if (cat.isSystem) throw new HttpError(409, "Standard-Kategorien können nicht gelöscht werden – Name und Beschreibung lassen sich aber anpassen.");
  const rules = await db.rule.findMany({ where: scoped(session), select: { name: true, conditions: true, actions: true } });
  const usedBy = rules.filter((r) => `${JSON.stringify(r.conditions)}${JSON.stringify(r.actions)}`.includes(`"${cat.key}"`)).map((r) => r.name);
  if (usedBy.length) throw new HttpError(409, `Kategorie wird noch in Regeln verwendet: ${usedBy.join(", ")}`);
  await db.category.delete({ where: { id } });
  await audit(session, "category.delete", { type: "category", id }, { name: cat.name });
  return { ok: true };
});
