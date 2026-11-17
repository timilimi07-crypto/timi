import { Prisma } from "@prisma/client";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { apiRoute, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { triggerSync } from "@/server/jobs/trigger";
import { createImapConnector } from "@/server/mail/connectors";
import type { ImapCredentials } from "@/server/mail/types";
import { assertSession, HttpError } from "@/server/session";
import { imapMailboxSchema } from "@/server/validation/settings";

/** POST /api/mailboxes – IMAP-Postfach verbinden (Verbindung wird vorher geprüft). */
export const POST = apiRoute(async (req) => {
  const session = await assertSession("mailbox.manage");
  const input = imapMailboxSchema.parse(await readJson(req));
  const creds: ImapCredentials = {
    kind: "imap",
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    password: input.password,
    folder: input.folder,
  };

  const connector = createImapConnector(creds);
  try {
    await connector.verify();
  } finally {
    await connector.close();
  }

  let mailbox;
  try {
    mailbox = await db.mailbox.create({
      data: {
        organizationId: session.organizationId,
        name: input.name,
        emailAddress: input.emailAddress,
        provider: "IMAP",
        encryptedCredentials: encryptJson(creds),
        // Nur nicht geheime Daten im Klartext (Anzeige in den Einstellungen).
        config: { host: input.host, port: input.port, secure: input.secure, username: input.username, folder: input.folder },
        initialSyncDays: input.initialSyncDays,
      },
      select: { id: true, name: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Dieses Postfach ist bereits verbunden");
    }
    throw err;
  }
  await audit(session, "mailbox.create", { type: "mailbox", id: mailbox.id }, { provider: "IMAP", emailAddress: input.emailAddress });
  const sync = await triggerSync([mailbox.id]);
  return { mailbox, sync };
});
