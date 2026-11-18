import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { emailLabelSchema } from "@/server/validation/team";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/emails/:id/labels { labelId, on } – Label setzen/entfernen. */
export const POST = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("email.update");
  const { id } = await params;
  const { labelId, on } = emailLabelSchema.parse(await readJson(req));
  const [email, label] = await Promise.all([
    db.email.findFirst({ where: scoped(session, { id, deletedAt: null }), select: { id: true } }),
    db.label.findFirst({ where: scoped(session, { id: labelId }), select: { id: true, name: true } }),
  ]);
  if (!email || !label) throw new HttpError(404, "E-Mail oder Label nicht gefunden");
  if (on) await db.emailLabel.upsert({ where: { emailId_labelId: { emailId: id, labelId } }, create: { emailId: id, labelId }, update: {} });
  else await db.emailLabel.deleteMany({ where: { emailId: id, labelId } });
  await audit(session, "email.label", { type: "email", id }, { label: label.name, on });
  return { ok: true };
});
