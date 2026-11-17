import { ImapFlow } from "imapflow";
import { parseRawMessage } from "../parse";
import { MailboxError, type ChangeList, type FetchedMessage, type ImapCredentials, type MailConnector, type ProviderCursor } from "../types";

type ImapCursor = { uidValidity: string; highUid: number };

/**
 * IMAP-Anbindung (imapflow). Cursor = UIDVALIDITY + höchste bekannte UID.
 * Ändert sich UIDVALIDITY (Ordner neu aufgebaut), wird ab `since` neu
 * gelistet; Dubletten verhindert der eindeutige Schlüssel (Message-ID).
 */
export class ImapConnector implements MailConnector {
  private client: ImapFlow | null = null;
  private release: (() => void) | null = null;
  private uidValidity = "";

  constructor(private readonly creds: ImapCredentials) {}

  private async open(): Promise<ImapFlow> {
    if (this.client) return this.client;
    const client = new ImapFlow({
      host: this.creds.host,
      port: this.creds.port,
      secure: this.creds.secure,
      auth: { user: this.creds.username, pass: this.creds.password },
      logger: false,
      socketTimeout: 60_000,
    });
    client.on("error", () => {}); // Fehler werden über die Promises behandelt.
    try {
      await client.connect();
    } catch (err) {
      const e = err as { authenticationFailed?: boolean; code?: string; message?: string };
      if (e.authenticationFailed) {
        throw new MailboxError("Anmeldung am IMAP-Server fehlgeschlagen. Benutzername und Passwort prüfen.", "auth", { cause: err });
      }
      if (e.code === "ENOTFOUND" || e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT") {
        throw new MailboxError(`IMAP-Server ${this.creds.host}:${this.creds.port} nicht erreichbar.`, "network", { cause: err });
      }
      throw new MailboxError(`IMAP-Verbindung fehlgeschlagen: ${e.message ?? "unbekannter Fehler"}`, "provider", { cause: err });
    }
    try {
      const lock = await client.getMailboxLock(this.creds.folder || "INBOX");
      this.release = () => lock.release();
    } catch (err) {
      await client.logout().catch(() => {});
      throw new MailboxError(`Ordner „${this.creds.folder}“ nicht gefunden.`, "config", { cause: err });
    }
    const mb = client.mailbox;
    this.uidValidity = mb && typeof mb === "object" ? String(mb.uidValidity) : "";
    this.client = client;
    return client;
  }

  async verify() {
    await this.open();
    return { emailAddress: this.creds.username.includes("@") ? this.creds.username : undefined };
  }

  async listChanges(cursor: ProviderCursor | null, since: Date): Promise<ChangeList> {
    const client = await this.open();
    const c = cursor as ImapCursor | null;
    const sameFolder = c && c.uidValidity === this.uidValidity;

    const found = sameFolder
      ? await client.search({ uid: `${c.highUid + 1}:*` }, { uid: true })
      : await client.search({ since }, { uid: true });
    const uids = (found || []).filter((u) => !sameFolder || u > c.highUid).sort((a, b) => b - a);

    const mb = client.mailbox;
    const uidNext = mb && typeof mb === "object" ? Number(mb.uidNext ?? 1) : 1;
    const highUid = Math.max(sameFolder ? c.highUid : 0, uids[0] ?? 0, uidNext - 1);

    return { ids: uids.map(String), cursor: { uidValidity: this.uidValidity, highUid } satisfies ImapCursor };
  }

  async fetchMessage(id: string): Promise<FetchedMessage | null> {
    const client = await this.open();
    const msg = await client.fetchOne(id, { source: true, flags: true, internalDate: true }, { uid: true });
    if (!msg || !msg.source) return null;
    const parsed = await parseRawMessage(msg.source, {
      isRead: msg.flags?.has("\\Seen") ?? false,
      fallbackDate: msg.internalDate ? new Date(msg.internalDate) : undefined,
    });
    // Ohne Message-ID-Header: stabile ID aus UIDVALIDITY + UID.
    if (!parsed.messageIdHeader) parsed.providerMessageId = `uid:${this.uidValidity}:${id}`;
    return parsed;
  }

  async close() {
    this.release?.();
    this.release = null;
    if (this.client) await this.client.logout().catch(() => {});
    this.client = null;
  }
}
