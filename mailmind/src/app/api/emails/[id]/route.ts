import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { getEmailDetail } from "@/server/queries/email-detail";
import { apiRoute, readJson } from "@/server/api";
import { recordCorrection } from "@/server/ai/pipeline";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { emailUpdateSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/emails/:id?images=1 – Detail (ohne Seiteneffekte, für Vorladen geeignet). */
export const GET = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.read");
  const { id } = await params;
  const detail = await getEmailDetail(session.organizationId, id, {
    allowRemoteImages: new URL(req.url).searchParams.get("images") === "1",
    showCosts: can(session.role, "ai.costs"),
  });
  if (!detail) throw new HttpError(404, "E-Mail nicht gefunden");
  return detail;
});

/**
 * PATCH /api/emails/:id – Kategorie, Priorität, Status oder Gelesen-Markierung ändern.
 * Manuelle Änderungen an Kategorie/Priorität werden als Korrektur gespeichert
 * (fließt als Beispiel in künftige KI-Prompts) und vor KI-Überschreibung geschützt.
 */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  const { id } = await params;
  const input = emailUpdateSchema.parse(await readJson(req));

  const email = await db.email.findFirst({
    where: scoped(session, { id, deletedAt: null }),
    include: { category: { select: { key: true } }, organization: { select: { maskSensitiveData: true } } },
  });
  if (!email) throw new HttpError(404, "E-Mail nicht gefunden");

  const data: Parameters<typeof db.email.update>[0]["data"] = {};
  const corrections: Promise<unknown>[] = [];
  const correctionBase = {
    organizationId: session.organizationId,
    emailId: email.id,
    userId: session.userId,
    subject: email.subject,
    fromEmail: email.fromEmail,
    mask: email.organization.maskSensitiveData,
  };

  if (input.categoryKey && input.categoryKey !== email.category?.key) {
    const category = await db.category.findFirst({ where: scoped(session, { key: input.categoryKey }) });
    if (!category) throw new HttpError(400, "Unbekannte Kategorie");
    Object.assign(data, { categoryId: category.id, isCollapsed: category.autoCollapse });
    corrections.push(recordCorrection({ ...correctionBase, field: "category", fromValue: email.category?.key ?? null, toValue: category.key }));
  }
  if (input.priority && input.priority !== email.priority) {
    data.priority = input.priority;
    corrections.push(recordCorrection({ ...correctionBase, field: "priority", fromValue: email.priority, toValue: input.priority }));
  }
  if (corrections.length) Object.assign(data, { manualOverride: true, needsReview: false, reviewReason: null });
  // „Einordnung passt“: Markierung entfernen, ohne etwas zu ändern.
  if (input.confirmReview) Object.assign(data, { needsReview: false, reviewReason: null, manualOverride: true });
  if (input.status) data.status = input.status;
  if (input.isRead !== undefined) data.isRead = input.isRead;

  const updated = await db.email.update({
    where: { id: email.id },
    data,
    select: { id: true, priority: true, status: true, isRead: true, needsReview: true, category: { select: { key: true, name: true } } },
  });
  await Promise.all(corrections);
  await audit(session, input.status ? "email.status" : "email.update", { type: "email", id: email.id }, input);
  return { ...updated, correctionsSaved: corrections.length };
});
