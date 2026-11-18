import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { commentSchema } from "@/server/validation/team";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/emails/:id/comments – interner Kommentar oder angeheftete Notiz (nie für den Absender sichtbar). */
export const POST = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  const { id } = await params;
  const input = commentSchema.parse(await readJson(req));
  if (!(await db.email.findFirst({ where: scoped(session, { id, deletedAt: null }), select: { id: true } }))) throw new HttpError(404, "E-Mail nicht gefunden");
  const comment = await db.comment.create({
    data: { emailId: id, authorId: session.userId, body: input.body, isNote: input.isNote },
    include: { author: { select: { id: true, name: true } } },
  });
  await audit(session, input.isNote ? "note.create" : "comment.create", { type: "email", id }, { commentId: comment.id });
  return { ...comment, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString() };
});
