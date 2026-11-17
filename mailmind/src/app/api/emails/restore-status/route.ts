import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { restoreStatusSchema } from "@/server/validation/settings";

/** POST /api/emails/restore-status – „Rückgängig“: vorherige Status wiederherstellen. */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("email.update");
  const { items } = restoreStatusSchema.parse(await readJson(req));
  await db.$transaction(items.map((i) => db.email.updateMany({ where: scoped(session, { id: i.id }), data: { status: i.status } })));
  await audit(session, "email.status", { type: "email", id: items[0]!.id }, { restored: items.length });
  return { ok: true };
});
