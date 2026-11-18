import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { commentUpdateSchema } from "@/server/validation/team";

type Ctx = { params: Promise<{ id: string }> };

/** Eigene Kommentare bearbeiten/löschen; Admins dürfen alle löschen. Anheften/Lösen darf jeder. */
async function load(id: string, session: { organizationId: string }) {
  const c = await db.comment.findFirst({ where: { id, email: { organizationId: session.organizationId } } });
  if (!c) throw new HttpError(404, "Kommentar nicht gefunden");
  return c;
}

export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  const { id } = await params;
  const c = await load(id, session);
  const input = commentUpdateSchema.parse(await readJson(req));
  if (input.body !== undefined && c.authorId !== session.userId) throw new HttpError(403, "Nur eigene Kommentare können bearbeitet werden");
  await db.comment.update({ where: { id }, data: input });
  return { ok: true };
});

export const DELETE = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("email.update");
  const { id } = await params;
  const c = await load(id, session);
  if (c.authorId !== session.userId && !can(session.role, "team.manage")) throw new HttpError(403, "Nur eigene Kommentare können gelöscht werden");
  await db.comment.delete({ where: { id } });
  await audit(session, "comment.delete", { type: "email", id: c.emailId });
  return { ok: true };
});
