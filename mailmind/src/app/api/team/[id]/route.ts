import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { teamUpdateSchema } from "@/server/validation/team";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/team/:id – Rolle, Name, aktiv/deaktiviert (nur Admin).
 * Schutz: Man kann sich nicht selbst herabstufen oder deaktivieren, und es
 * bleibt immer mindestens ein aktiver Admin.
 */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("team.manage");
  const { id } = await params;
  const input = teamUpdateSchema.parse(await readJson(req));
  const user = await db.user.findFirst({ where: scoped(session, { id }) });
  if (!user) throw new HttpError(404, "Person nicht gefunden");
  if (id === session.userId && ((input.role && input.role !== "ADMIN") || input.isActive === false)) {
    throw new HttpError(409, "Du kannst dich nicht selbst herabstufen oder deaktivieren.");
  }
  const losesAdmin = user.role === "ADMIN" && user.isActive && ((input.role && input.role !== "ADMIN") || input.isActive === false);
  if (losesAdmin) {
    const admins = await db.user.count({ where: scoped(session, { role: "ADMIN" as const, isActive: true }) });
    if (admins <= 1) throw new HttpError(409, "Es muss mindestens ein aktiver Admin bleiben.");
  }
  await db.user.update({ where: { id }, data: input });
  // Deaktivierte Personen verlieren ihre offenen Zuweisungen (sonst bleiben E-Mails liegen).
  if (input.isActive === false) {
    await db.email.updateMany({ where: { assigneeId: id, status: { not: "DONE" } }, data: { assigneeId: null } });
    await db.task.updateMany({ where: { assigneeId: id, status: "OPEN" }, data: { assigneeId: null } });
  }
  await audit(session, "team.update", { type: "user", id }, input);
  return { ok: true };
});
