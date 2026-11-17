import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { assertSession, HttpError } from "@/server/session";
import { scoped } from "@/server/tenant";
import { mailboxUpdateSchema } from "@/server/validation/settings";

type Ctx = { params: Promise<{ id: string }> };

async function load(session: { organizationId: string }, id: string) {
  const mb = await db.mailbox.findFirst({ where: scoped(session, { id }) });
  if (!mb) throw new HttpError(404, "Postfach nicht gefunden");
  return mb;
}

/** PATCH /api/mailboxes/:id – Name ändern, Abruf pausieren/fortsetzen. */
export const PATCH = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("mailbox.manage");
  const { id } = await params;
  await load(session, id);
  const input = mailboxUpdateSchema.parse(await readJson(req));
  const updated = await db.mailbox.update({
    where: { id },
    data: {
      ...input,
      ...(input.syncEnabled === false ? { status: "DISABLED" as const } : {}),
      ...(input.syncEnabled === true ? { status: "ACTIVE" as const, lastError: null } : {}),
    },
    select: { id: true, name: true, syncEnabled: true, status: true },
  });
  await audit(session, "mailbox.update", { type: "mailbox", id }, input);
  return updated;
});

/** DELETE /api/mailboxes/:id – Postfach samt aller abgerufenen E-Mails entfernen. */
export const DELETE = apiRoute<Ctx>(async (_req, { params }) => {
  const session = await assertSession("mailbox.manage");
  const { id } = await params;
  const mb = await load(session, id);
  const emailCount = await db.email.count({ where: { mailboxId: id } });
  await db.mailbox.delete({ where: { id } });
  await audit(session, "mailbox.delete", { type: "mailbox", id }, { name: mb.name, emailAddress: mb.emailAddress, emailCount });
  return { ok: true, deletedEmails: emailCount };
});
