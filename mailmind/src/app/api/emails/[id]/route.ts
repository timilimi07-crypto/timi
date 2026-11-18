import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
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

  // --- Zuweisen (ganzer Verlauf) ---
  let assignment: { assigneeId: string | null; assigneeName: string | null } | null = null;
  if (input.assigneeId !== undefined && input.assigneeId !== email.assigneeId) {
    const selfService = input.assigneeId === session.userId || (input.assigneeId === null && email.assigneeId === session.userId);
    if (!selfService && !can(session.role, "email.assign")) {
      throw new HttpError(403, "Nur Admins und Manager können anderen Personen E-Mails zuweisen. Du kannst sie aber selbst übernehmen.");
    }
    const assignee = input.assigneeId
      ? await db.user.findFirst({ where: scoped(session, { id: input.assigneeId, isActive: true }), select: { id: true, name: true } })
      : null;
    if (input.assigneeId && !assignee) throw new HttpError(400, "Unbekannte oder deaktivierte Person");
    const threadWhere: Prisma.EmailWhereInput = email.threadId ? { threadId: email.threadId, organizationId: session.organizationId, deletedAt: null } : { id: email.id };
    await db.email.updateMany({ where: threadWhere, data: { assigneeId: assignee?.id ?? null } });
    // Übernommen → „In Bearbeitung“ (wer bearbeitet was), nur wenn noch „Neu“.
    if (assignee) await db.email.updateMany({ where: { ...threadWhere, status: "NEW" }, data: { status: "IN_PROGRESS" } });
    // Offene Aufgaben des Verlaufs mitnehmen.
    await db.task.updateMany({ where: { email: threadWhere, status: "OPEN" }, data: { assigneeId: assignee?.id ?? null } });
    assignment = { assigneeId: assignee?.id ?? null, assigneeName: assignee?.name ?? null };
  }

  const updated = await db.email.update({
    where: { id: email.id },
    data,
    select: {
      id: true,
      priority: true,
      status: true,
      isRead: true,
      needsReview: true,
      category: { select: { key: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  await Promise.all(corrections);
  if (assignment) await audit(session, "email.assign", { type: "email", id: email.id }, assignment);
  const { assigneeId: _a, ...rest } = input;
  void _a;
  if (Object.keys(rest).length) await audit(session, input.status ? "email.status" : "email.update", { type: "email", id: email.id }, rest);
  return { ...updated, correctionsSaved: corrections.length };
});
