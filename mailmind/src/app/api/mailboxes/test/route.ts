import { apiRoute, readJson } from "@/server/api";
import { createImapConnector } from "@/server/mail/connectors";
import { assertSession } from "@/server/session";
import { imapMailboxSchema } from "@/server/validation/settings";

/** POST /api/mailboxes/test – IMAP-Zugangsdaten prüfen, ohne zu speichern. */
export const POST = apiRoute(async (req) => {
  await assertSession("mailbox.manage");
  const input = imapMailboxSchema.parse(await readJson(req));
  const connector = createImapConnector({ kind: "imap", ...input });
  try {
    await connector.verify();
    const { ids } = await connector.listChanges(null, new Date(Date.now() - (input.initialSyncDays ?? 30) * 86_400_000));
    return { ok: true, messagesInWindow: ids.length };
  } finally {
    await connector.close();
  }
});
