import { Prisma, type Mailbox, type Organization } from "@prisma/client";
import { db } from "@/lib/db";
import { createConnector } from "./connectors";
import { makeSnippet } from "./parse";
import { checkPhishing } from "./phishing";
import { deriveThreadKey, normalizeSubject, relatedMessageIds } from "./threading";
import { MailboxError, type FetchedMessage, type MailConnector, type SyncState } from "./types";

/**
 * Postfach-Abruf.
 *
 * Schutz vor „tausenden alten E-Mails auf einmal“:
 *  1. Zeitfenster: Beim ersten Abruf werden nur E-Mails der letzten
 *     `initialSyncDays` Tage berücksichtigt (Firma, pro Postfach überschreibbar).
 *     Das Fenster wird gespeichert und gilt auch für spätere Läufe.
 *  2. Limit pro Lauf: Höchstens `maxEmailsPerSync` E-Mails werden pro Lauf
 *     geladen – neueste zuerst. Der Rest bleibt in `syncState.pending` und
 *     wird in den nächsten Läufen nachgeholt.
 * Damit landen auch höchstens so viele E-Mails pro Lauf in der KI-Warteschlange.
 */

/** Maximal gemerkte, noch abzurufende IDs (Sicherheitsgrenze). */
const MAX_PENDING = 5000;
/** Ein „hängender“ Lauf gilt nach dieser Zeit als abgebrochen. */
const LOCK_TIMEOUT_MS = 15 * 60_000;

export type SyncResult = {
  mailboxId: string;
  status: "ok" | "locked" | "disabled" | "error";
  created: number;
  duplicates: number;
  skippedOld: number;
  /** Noch nicht abgerufene E-Mails (werden im nächsten Lauf geladen). */
  remaining: number;
  newEmailIds: string[];
  error?: string;
};

type SyncOptions = {
  now?: Date;
  /** Für Tests: eigenen Connector einschleusen. */
  connectorFactory?: (mailbox: Mailbox) => MailConnector;
};

export function computeWindowStart(now: Date, days: number): Date {
  return new Date(now.getTime() - Math.max(1, days) * 24 * 60 * 60_000);
}

/** Einen Abruf-Lauf für ein Postfach ausführen. Wirft nicht – Fehler stehen im Ergebnis und am Postfach. */
export async function syncMailbox(mailboxId: string, opts: SyncOptions = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const base: SyncResult = { mailboxId, status: "ok", created: 0, duplicates: 0, skippedOld: 0, remaining: 0, newEmailIds: [] };

  // Sperre: nur ein Lauf pro Postfach gleichzeitig (auch über mehrere Worker hinweg).
  const locked = await db.mailbox.updateMany({
    where: {
      id: mailboxId,
      syncEnabled: true,
      OR: [{ syncStartedAt: null }, { syncStartedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } }],
    },
    data: { syncStartedAt: now, status: "SYNCING" },
  });
  if (locked.count === 0) {
    const mb = await db.mailbox.findUnique({ where: { id: mailboxId }, select: { syncEnabled: true } });
    return { ...base, status: mb && !mb.syncEnabled ? "disabled" : "locked" };
  }

  const mailbox = await db.mailbox.findUniqueOrThrow({ where: { id: mailboxId }, include: { organization: true } });
  const prev = (mailbox.syncState as SyncState | null) ?? null;
  const windowStart = prev?.windowStart
    ? new Date(prev.windowStart)
    : computeWindowStart(now, mailbox.initialSyncDays ?? mailbox.organization.initialSyncDays);
  const limit = Math.max(1, mailbox.organization.maxEmailsPerSync);

  let connector: MailConnector | null = null;
  let pending = prev?.pending ?? [];
  let cursor = prev?.cursor ?? null;

  try {
    connector = (opts.connectorFactory ?? createConnector)(mailbox);
    const changes = await connector.listChanges(cursor, windowStart);
    cursor = changes.cursor;
    // Neue IDs (neueste) vor die bereits wartenden setzen, Dubletten entfernen.
    pending = [...new Set([...changes.ids, ...pending])].slice(0, MAX_PENDING);

    const batch = pending.slice(0, limit);
    for (const id of batch) {
      const msg = await connector.fetchMessage(id);
      pending = pending.filter((p) => p !== id); // Fortschritt sofort merken
      if (!msg) continue;
      if (msg.date < windowStart) {
        base.skippedOld++;
        continue;
      }
      const stored = await storeMessage(mailbox, mailbox.organization, msg);
      if (stored) {
        base.created++;
        base.newEmailIds.push(stored);
      } else {
        base.duplicates++;
      }
    }

    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        syncState: { windowStart: windowStart.toISOString(), pending, cursor } satisfies SyncState as Prisma.InputJsonValue,
        lastSyncAt: now,
        status: "ACTIVE",
        lastError: null,
        syncStartedAt: null,
      },
    });
    return { ...base, remaining: pending.length };
  } catch (err) {
    const message =
      err instanceof MailboxError ? err.message : `Abruf fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[sync] Postfach ${mailboxId}:`, err);
    // Bereits Geladenes bleibt gespeichert; der Fortschritt wird ebenfalls gesichert.
    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        syncState: { windowStart: windowStart.toISOString(), pending, cursor } satisfies SyncState as Prisma.InputJsonValue,
        status: "ERROR",
        lastError: message,
        syncStartedAt: null,
      },
    });
    return { ...base, status: "error", error: message, remaining: pending.length };
  } finally {
    await connector?.close().catch(() => {});
  }
}

/**
 * Speichert eine Nachricht samt Thread und Anhängen.
 * @returns ID der neuen E-Mail oder null, wenn sie bereits existierte.
 */
export async function storeMessage(
  mailbox: Pick<Mailbox, "id" | "organizationId" | "emailAddress">,
  _org: Pick<Organization, "id">,
  msg: FetchedMessage,
): Promise<string | null> {
  const exists = await db.email.findUnique({
    where: { mailboxId_providerMessageId: { mailboxId: mailbox.id, providerMessageId: msg.providerMessageId } },
    select: { id: true },
  });
  if (exists) return null;

  const threadId = await resolveThread(mailbox, msg);
  const realAttachments = msg.attachments;
  const phishing = checkPhishing({
    fromName: msg.from.name,
    fromEmail: msg.from.email,
    replyTo: msg.replyTo,
    subject: msg.subject,
    text: msg.text,
    attachments: realAttachments,
  });

  try {
    const email = await db.email.create({
      data: {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.id,
        threadId,
        providerMessageId: msg.providerMessageId,
        messageIdHeader: msg.messageIdHeader,
        inReplyTo: msg.inReplyTo,
        references: msg.references,
        direction: msg.from.email.toLowerCase() === mailbox.emailAddress.toLowerCase() ? "OUTBOUND" : "INBOUND",
        subject: msg.subject.slice(0, 998),
        fromName: msg.from.name,
        fromEmail: msg.from.email,
        to: msg.to,
        cc: msg.cc,
        replyTo: msg.replyTo,
        receivedAt: msg.date,
        snippet: makeSnippet(msg.text),
        bodyText: msg.text,
        bodyHtml: msg.html,
        isRead: msg.isRead,
        hasAttachments: realAttachments.length > 0,
        phishingSuspected: phishing.suspected,
        phishingReason: phishing.suspected ? phishing.reasons.join(" · ") : null,
        attachments: { create: realAttachments },
      },
      select: { id: true },
    });
    return email.id;
  } catch (err) {
    // Paralleler Lauf hat dieselbe Nachricht schon gespeichert.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

async function resolveThread(mailbox: Pick<Mailbox, "id" | "organizationId">, msg: FetchedMessage): Promise<string> {
  // 1. Ohne Provider-Thread: über References/In-Reply-To an bestehende Nachricht hängen.
  if (!msg.providerThreadId) {
    const related = relatedMessageIds(msg);
    if (related.length) {
      const parent = await db.email.findFirst({
        where: { mailboxId: mailbox.id, messageIdHeader: { in: related }, threadId: { not: null } },
        select: { threadId: true },
      });
      if (parent?.threadId) {
        await touchThread(parent.threadId, msg.date);
        return parent.threadId;
      }
    }
  }

  // 2. Thread über abgeleiteten Schlüssel finden oder anlegen.
  const key = deriveThreadKey({ ...msg, fromEmail: msg.from.email });
  const existing = await db.thread.findUnique({
    where: { mailboxId_providerThreadId: { mailboxId: mailbox.id, providerThreadId: key } },
    select: { id: true },
  });
  if (existing) {
    await touchThread(existing.id, msg.date);
    return existing.id;
  }
  try {
    const t = await db.thread.create({
      data: {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.id,
        providerThreadId: key,
        subject: normalizeSubject(msg.subject) || msg.subject,
        lastMessageAt: msg.date,
      },
      select: { id: true },
    });
    return t.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const t = await db.thread.findUniqueOrThrow({
        where: { mailboxId_providerThreadId: { mailboxId: mailbox.id, providerThreadId: key } },
        select: { id: true },
      });
      await touchThread(t.id, msg.date);
      return t.id;
    }
    throw err;
  }
}

async function touchThread(threadId: string, date: Date) {
  await db.$executeRaw`
    UPDATE "Thread"
    SET "messageCount" = "messageCount" + 1,
        "lastMessageAt" = GREATEST("lastMessageAt", ${date}),
        "updatedAt" = NOW()
    WHERE id = ${threadId}`;
}

/** Postfächer, deren nächster Abruf fällig ist (für den Scheduler). */
export async function findDueMailboxes(now = new Date()): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT m.id
    FROM "Mailbox" m
    JOIN "Organization" o ON o.id = m."organizationId"
    WHERE m."syncEnabled" = true
      AND m.status <> 'DISABLED'
      AND (m."syncStartedAt" IS NULL OR m."syncStartedAt" < ${new Date(now.getTime() - LOCK_TIMEOUT_MS)})
      AND (
        m."lastSyncAt" IS NULL
        OR m."lastSyncAt" + make_interval(mins => o."syncIntervalMinutes") <= ${now}
        -- Rückstand vorhanden: zeitnah weitermachen statt auf das Intervall zu warten
        OR (m.status <> 'ERROR' AND jsonb_array_length(COALESCE(m."syncState"->'pending', '[]'::jsonb)) > 0)
      )`;
  return rows.map((r) => r.id);
}
