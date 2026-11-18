import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { dueDateToDb, taskCreateSchema } from "@/server/validation/settings";

/** POST /api/tasks – Aufgabe manuell anlegen (optional zu einer E-Mail). */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("task.manage");
  const input = taskCreateSchema.parse(await readJson(req));
  if (input.emailId && !(await db.email.findFirst({ where: scoped(session, { id: input.emailId }), select: { id: true } }))) {
    throw new HttpError(404, "E-Mail nicht gefunden");
  }
  const task = await db.task.create({
    data: {
      organizationId: session.organizationId,
      title: input.title,
      dueDate: dueDateToDb(input.dueDate),
      emailId: input.emailId,
      source: "MANUAL",
      createdById: session.userId,
    },
    select: { id: true },
  });
  await audit(session, "task.create", { type: "task", id: task.id });
  return task;
});
