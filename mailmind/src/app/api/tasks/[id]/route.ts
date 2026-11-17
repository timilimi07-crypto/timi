import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { taskUpdateSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/tasks/:id – Aufgabe erledigen / wieder öffnen. */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("task.manage");
  const { id } = await params;
  const { status } = taskUpdateSchema.parse(await readJson(req));
  const r = await db.task.updateMany({
    where: scoped(session, { id }),
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  if (r.count === 0) throw new HttpError(404, "Aufgabe nicht gefunden");
  await audit(session, "task.update", { type: "task", id }, { status });
  return { id, status };
});
