import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";

/** POST /api/rules/reorder { ids: [...] } – Ausführungsreihenfolge festlegen. */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("rules.manage");
  const { ids } = z.object({ ids: z.array(z.string()).min(1).max(200) }).parse(await readJson(req));
  const own = await db.rule.count({ where: scoped(session, { id: { in: ids } }) });
  if (own !== new Set(ids).size) throw new HttpError(400, "Unbekannte Regel");
  await db.$transaction(ids.map((id, i) => db.rule.update({ where: { id }, data: { sortOrder: i } })));
  return { ok: true };
});
