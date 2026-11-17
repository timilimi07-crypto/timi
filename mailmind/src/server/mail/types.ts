/**
 * Gemeinsame Typen der Postfach-Anbindung. Jeder Provider (IMAP, Gmail,
 * Outlook, Demo) liefert Nachrichten in diesem normalisierten Format, damit
 * Sync, Threading und KI-Pipeline providerunabhängig bleiben.
 *
 * Wichtig: Dieses Modul (und alles unter src/server/mail) darf weder
 * "server-only" noch next/* importieren – es läuft auch im Worker-Prozess.
 */

export type Address = { name?: string; email: string };

export type FetchedAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  /** Referenz zum späteren Nachladen beim Provider. */
  providerAttachmentId?: string;
};

export type FetchedMessage = {
  providerMessageId: string;
  /** Thread-ID des Providers (Gmail threadId, Graph conversationId), falls vorhanden. */
  providerThreadId?: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];
  subject: string;
  from: Address;
  to: Address[];
  cc: Address[];
  replyTo?: string;
  date: Date;
  text: string;
  html?: string;
  isRead: boolean;
  attachments: FetchedAttachment[];
};

/** Provider-spezifischer Cursor (frei strukturiert, JSON-serialisierbar). */
export type ProviderCursor = Record<string, unknown>;

export type ChangeList = {
  /** Neue Nachrichten-IDs, NEUESTE ZUERST. */
  ids: string[];
  cursor: ProviderCursor;
};

export interface MailConnector {
  /** Verbindung/Anmeldung prüfen. Liefert die echte Adresse, falls ermittelbar. */
  verify(): Promise<{ emailAddress?: string }>;
  /**
   * Neue Nachrichten seit dem letzten Cursor. Ohne Cursor (erster Abruf):
   * alle Nachrichten ab `since`.
   */
  listChanges(cursor: ProviderCursor | null, since: Date): Promise<ChangeList>;
  /** Eine Nachricht vollständig laden; null, wenn sie inzwischen gelöscht wurde. */
  fetchMessage(id: string): Promise<FetchedMessage | null>;
  /** Verbindungen schließen (IMAP). */
  close(): Promise<void>;
}

/** Zugangsdaten (verschlüsselt in Mailbox.encryptedCredentials). */
export type ImapCredentials = {
  kind: "imap";
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  folder: string;
};

export type OAuthCredentials = {
  kind: "oauth";
  accessToken: string;
  refreshToken: string;
  /** Ablaufzeit des Access-Tokens (ms seit Epoch). */
  expiresAt: number;
};

export type MailboxCredentials = ImapCredentials | OAuthCredentials;

/** Gespeicherter Sync-Zustand (Mailbox.syncState). */
export type SyncState = {
  /** Älteste E-Mail, die abgerufen wird (ISO). Wird beim ersten Abruf festgelegt. */
  windowStart: string;
  /** Bereits erkannte, aber noch nicht abgerufene IDs (neueste zuerst). */
  pending: string[];
  cursor: ProviderCursor | null;
};

/** Fehler mit einer für Nutzer verständlichen deutschen Meldung. */
export class MailboxError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "network" | "config" | "provider" = "provider",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MailboxError";
  }
}
