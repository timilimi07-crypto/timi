import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { statusChangeSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/emails/:id/status – Status setzen, standardmäßig für den ganzen
 * Verlauf (wie „Erledigt“ in Superhuman). Liefert die vorherigen Status
 * zurück, damit der Client „Rückgängig“ anbieten kann.
 */
export const POST = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  const { id } = await params;
  const { status, scope } = statusChangeSchema.parse(await readJson(req));
  const email = await db.email.findFirst({ where: scoped(session, { id, deletedAt: null }), select: { id: true, threadId: true } });
  if (!email) throw new HttpError(404, "E-Mail nicht gefunden");

  const where = scoped(session, scope === "thread" && email.threadId ? { threadId: email.threadId, deletedAt: null } : { id: email.id });
  const previous = await db.email.findMany({ where, select: { id: true, status: true } });
  await db.email.updateMany({ where, data: { status, ...(status === "DONE" ? { isRead: true } : {}) } });
  await audit(session, "email.status", { type: "email", id: email.id }, { status, scope, count: previous.length });
  return { previous };
});
