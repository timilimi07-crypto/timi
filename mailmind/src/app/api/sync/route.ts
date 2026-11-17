import { db } from "@/lib/db";
import { apiRoute } from "@/server/api";
import { triggerSync } from "@/server/jobs/trigger";
import { assertSession } from "@/server/session";
import { scoped } from "@/server/tenant";

/** POST /api/sync – alle aktiven Postfächer der Firma jetzt abrufen. */
export const POST = apiRoute(async () => {
  const session = await assertSession("mailbox.sync");
  const mailboxes = await db.mailbox.findMany({ where: scoped(session, { syncEnabled: true }), select: { id: true } });
  return triggerSync(mailboxes.map((m) => m.id));
});
