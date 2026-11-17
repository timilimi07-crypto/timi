import type { Mailbox } from "@prisma/client";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import type { DemoSet } from "../demo/emails";
import { MailboxError, type ImapCredentials, type MailboxCredentials, type MailConnector, type OAuthCredentials } from "../types";
import { DemoConnector } from "./demo";
import { GmailConnector } from "./gmail";
import { ImapConnector } from "./imap";
import { OutlookConnector } from "./outlook";

/** Erzeugt den passenden Connector für ein gespeichertes Postfach. */
export function createConnector(mailbox: Pick<Mailbox, "id" | "provider" | "encryptedCredentials" | "config" | "createdAt">): MailConnector {
  const persist = async (c: OAuthCredentials) => {
    await db.mailbox.update({ where: { id: mailbox.id }, data: { encryptedCredentials: encryptJson(c) } });
  };

  if (mailbox.provider === "DEMO") {
    const set = ((mailbox.config as { demoSet?: DemoSet } | null)?.demoSet ?? "info") as DemoSet;
    return new DemoConnector(set, mailbox.createdAt);
  }

  if (!mailbox.encryptedCredentials) {
    throw new MailboxError("Für dieses Postfach sind keine Zugangsdaten hinterlegt.", "config");
  }
  const creds = decryptJson<MailboxCredentials>(mailbox.encryptedCredentials);

  switch (mailbox.provider) {
    case "IMAP":
      if (creds.kind !== "imap") throw new MailboxError("Ungültige IMAP-Zugangsdaten.", "config");
      return new ImapConnector(creds);
    case "GMAIL":
      if (creds.kind !== "oauth") throw new MailboxError("Ungültige Gmail-Zugangsdaten.", "config");
      return new GmailConnector(creds, persist);
    case "OUTLOOK":
      if (creds.kind !== "oauth") throw new MailboxError("Ungültige Outlook-Zugangsdaten.", "config");
      return new OutlookConnector(creds, persist);
  }
}

/** Für den Verbindungstest vor dem Speichern eines IMAP-Postfachs. */
export function createImapConnector(creds: ImapCredentials): MailConnector {
  return new ImapConnector(creds);
}
