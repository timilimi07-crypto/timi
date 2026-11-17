import { db } from "@/lib/db";
import { apiRoute } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";

type Ctx = { params: Promise<{ id: string }> };

/** Innerhalb dieses Zeitraums wird erneutes Öffnen nicht noch einmal protokolliert. */
const AUDIT_DEDUP_MS = 30 * 60_000;

/**
 * POST /api/emails/:id/open – Nutzer hat die E-Mail tatsächlich geöffnet:
 * als gelesen markieren und im Audit-Log festhalten (DSGVO).
 */
export const POST = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("email.read");
  const { id } = await params;
  const updated = await db.email.updateMany({ where: scoped(session, { id, deletedAt: null }), data: { isRead: true } });
  if (updated.count === 0) throw new HttpError(404, "E-Mail nicht gefunden");

  const recent = await db.auditLog.findFirst({
    where: { organizationId: session.organizationId, userId: session.userId, action: "email.view", entityId: id, createdAt: { gte: new Date(Date.now() - AUDIT_DEDUP_MS) } },
    select: { id: true },
  });
  if (!recent) await audit(session, "email.view", { type: "email", id });
  return { ok: true };
});
