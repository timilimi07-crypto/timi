import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { labelSchema } from "@/server/validation/team";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("categories.manage");
  const { id } = await params;
  const input = labelSchema.partial().parse(await readJson(req));
  try {
    const r = await db.label.updateMany({ where: scoped(session, { id }), data: input });
    if (r.count === 0) throw new HttpError(404, "Label nicht gefunden");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError(409, "Dieses Label gibt es bereits");
    throw err;
  }
  await audit(session, "label.update", { type: "label", id }, input);
  return { ok: true };
});

/** Löschen entfernt das Label auch von allen E-Mails. Regeln mit diesem Label werden gemeldet. */
export const DELETE = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("categories.manage");
  const { id } = await params;
  const rules = await db.rule.findMany({ where: scoped(session), select: { name: true, actions: true } });
  const usedBy = rules.filter((r) => JSON.stringify(r.actions).includes(`"labelId":"${id}"`)).map((r) => r.name);
  if (usedBy.length) throw new HttpError(409, `Label wird noch in Regeln verwendet: ${usedBy.join(", ")}`);
  const r = await db.label.deleteMany({ where: scoped(session, { id }) });
  if (r.count === 0) throw new HttpError(404, "Label nicht gefunden");
  await audit(session, "label.delete", { type: "label", id });
  return { ok: true };
});
