import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { dueDateToDb, taskUpdateSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/tasks/:id – erledigen/öffnen, Titel oder Frist ändern. */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("task.manage");
  const { id } = await params;
  const input = taskUpdateSchema.parse(await readJson(req));
  const r = await db.task.updateMany({
    where: scoped(session, { id }),
    data: {
      ...(input.status ? { status: input.status, completedAt: input.status === "DONE" ? new Date() : null } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.dueDate !== undefined ? { dueDate: dueDateToDb(input.dueDate), dueDateText: null } : {}),
    },
  });
  if (r.count === 0) throw new HttpError(404, "Aufgabe nicht gefunden");
  await audit(session, "task.update", { type: "task", id }, input);
  return { id, ...input };
});

/** DELETE /api/tasks/:id */
export const DELETE = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("task.manage");
  const { id } = await params;
  const r = await db.task.deleteMany({ where: scoped(session, { id }) });
  if (r.count === 0) throw new HttpError(404, "Aufgabe nicht gefunden");
  await audit(session, "task.delete", { type: "task", id });
  return { ok: true };
});
