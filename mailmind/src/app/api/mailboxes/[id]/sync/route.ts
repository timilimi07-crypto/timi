import { db } from "@/lib/db";
import { apiRoute } from "@/server/api";
import { triggerSync } from "@/server/jobs/trigger";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/mailboxes/:id/sync – ein Postfach jetzt abrufen. */
export const POST = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("mailbox.sync");
  const { id } = await params;
  const mailbox = await db.mailbox.findFirst({ where: scoped(session, { id }), select: { id: true, syncEnabled: true } });
  if (!mailbox) throw new HttpError(404, "Postfach nicht gefunden");
  if (!mailbox.syncEnabled) throw new HttpError(409, "Der Abruf ist für dieses Postfach deaktiviert");
  return triggerSync([mailbox.id]);
});
