import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeEmailHtml, wrapEmailDocument } from "@/server/mail/render";

type Addr = { name?: string; email: string };

/**
 * Detailansicht einer E-Mail. Seiteneffektfrei (kein „gelesen“, kein Audit),
 * damit der Client die nächsten E-Mails vorladen kann. Das eigentliche Öffnen
 * meldet der Client separat (POST /api/emails/:id/open).
 */
export async function getEmailDetail(
  organizationId: string,
  id: string,
  opts: { allowRemoteImages: boolean; showCosts: boolean },
) {
  const e = await db.email.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      mailbox: { select: { id: true, name: true, emailAddress: true } },
      category: { select: { key: true, name: true, color: true } },
      attachments: { select: { id: true, filename: true, mimeType: true, size: true } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], select: { id: true, title: true, dueDate: true, dueDateText: true, status: true } },
      entities: { select: { id: true, type: true, label: true, value: true, normalizedValue: true } },
      replyDrafts: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, tone: true, body: true, createdAt: true } },
      assignee: { select: { id: true, name: true } },
      labels: { select: { label: { select: { id: true, name: true, color: true } } } },
      thread: {
        select: {
          summary: true,
          messageCount: true,
          emails: {
            where: { deletedAt: null },
            orderBy: { receivedAt: "asc" },
            take: 50,
            select: { id: true, fromName: true, fromEmail: true, receivedAt: true, summary: true, snippet: true },
          },
        },
      },
    },
  });
  if (!e) return null;

  // Kommentare und Bearbeitungsverlauf gelten für den ganzen Verlauf.
  const threadEmailIds = e.thread?.emails.map((m) => m.id) ?? [e.id];
  if (!threadEmailIds.includes(e.id)) threadEmailIds.push(e.id);
  const [comments, activity] = await Promise.all([
    db.comment.findMany({
      where: { emailId: { in: threadEmailIds } },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    }),
    db.auditLog.findMany({
      where: {
        organizationId,
        entityType: "email",
        entityId: { in: threadEmailIds },
        action: { in: ["email.assign", "email.status", "email.update", "email.label", "rule.apply", "email.reply_suggested", "email.view", "note.create", "comment.create"] },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const body = e.bodyHtml
    ? (() => {
        const s = sanitizeEmailHtml(e.bodyHtml, { allowRemoteImages: opts.allowRemoteImages });
        return { kind: "html" as const, doc: wrapEmailDocument(s.html, opts), blockedImages: s.blockedImages };
      })()
    : { kind: "text" as const, text: e.bodyText };

  return {
    id: e.id,
    threadId: e.threadId,
    subject: e.subject,
    fromName: e.fromName,
    fromEmail: e.fromEmail,
    to: (e.to as Prisma.JsonArray as unknown as Addr[]) ?? [],
    cc: (e.cc as Prisma.JsonArray as unknown as Addr[]) ?? [],
    replyTo: e.replyTo,
    receivedAt: e.receivedAt.toISOString(),
    isRead: e.isRead,
    status: e.status,
    aiStatus: e.aiStatus,
    aiError: e.aiError,
    summary: e.summary,
    priority: e.priority,
    priorityReason: e.priorityReason,
    priorityConfidence: e.priorityConfidence,
    category: e.category,
    categoryConfidence: e.categoryConfidence,
    sentiment: e.sentiment,
    needsReview: e.needsReview,
    reviewReason: e.reviewReason,
    phishingSuspected: e.phishingSuspected,
    phishingReason: e.phishingReason,
    manualOverride: e.manualOverride,
    aiModels: opts.showCosts ? e.aiModels : [],
    aiCostUsd: opts.showCosts ? Number(e.aiCostUsd) : 0,
    mailbox: e.mailbox,
    attachments: e.attachments,
    tasks: e.tasks.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null })),
    entities: e.entities,
    replyDrafts: e.replyDrafts.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
    assignee: e.assignee,
    labels: e.labels.map((l) => l.label),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      isNote: c.isNote,
      emailId: c.emailId,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
      edited: c.updatedAt.getTime() - c.createdAt.getTime() > 1000,
    })),
    activity: summarizeActivity(activity),
    thread:
      e.thread && e.thread.messageCount > 1
        ? {
            summary: e.thread.summary,
            messageCount: e.thread.messageCount,
            messages: e.thread.emails.map((m) => ({ ...m, receivedAt: m.receivedAt.toISOString(), isCurrent: m.id === e.id })),
          }
        : null,
    body,
  };
}

export type EmailDetail = NonNullable<Awaited<ReturnType<typeof getEmailDetail>>>;

type AuditRow = { id: string; action: string; createdAt: Date; metadata: Prisma.JsonValue; user: { name: string } | null };

const STATUS_DE: Record<string, string> = { NEW: "Neu", IN_PROGRESS: "In Bearbeitung", WAITING: "Wartet", DONE: "Erledigt" };
const PRIO_DE: Record<string, string> = { URGENT: "Dringend", HIGH: "Hoch", NORMAL: "Normal", LOW: "Niedrig" };

/**
 * Bearbeitungsverlauf („wer bearbeitet was“) als lesbare Sätze. Öffnen wird
 * pro Person zusammengefasst (nur das letzte Mal), damit der Verlauf kurz bleibt.
 */
export function summarizeActivity(rows: AuditRow[]): { id: string; at: string; who: string; text: string }[] {
  const seenViews = new Set<string>();
  const out: { id: string; at: string; who: string; text: string }[] = [];
  for (const r of rows) {
    const who = r.user?.name ?? "Automatisch";
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    let text: string | null = null;
    switch (r.action) {
      case "email.view":
        if (seenViews.has(who)) continue;
        seenViews.add(who);
        text = "hat die E-Mail geöffnet";
        break;
      case "email.assign":
        text = m.assigneeName ? `hat ${m.assigneeName === who ? "übernommen" : `an ${m.assigneeName} zugewiesen`}` : "hat die Zuweisung entfernt";
        break;
      case "email.status":
        text = m.status ? `hat den Status auf „${STATUS_DE[m.status as string] ?? m.status}“ gesetzt` : m.restored ? "hat eine Statusänderung rückgängig gemacht" : "hat den Status geändert";
        break;
      case "email.update": {
        const parts: string[] = [];
        if (m.priority) parts.push(`Priorität „${PRIO_DE[m.priority as string] ?? m.priority}“`);
        if (m.categoryKey) parts.push(`Kategorie „${m.categoryKey}“`);
        if (m.confirmReview) parts.push("Einordnung bestätigt");
        if (m.isRead === false) parts.push("als ungelesen markiert");
        if (!parts.length) continue;
        text = `hat ${parts.join(", ")} gesetzt`.replace("hat Einordnung bestätigt gesetzt", "hat die Einordnung bestätigt");
        break;
      }
      case "email.label":
        text = `hat Label „${m.label}“ ${m.on ? "gesetzt" : "entfernt"}`;
        break;
      case "rule.apply":
        text = `Regel ${(m.rules as string[] | undefined)?.map((n) => `„${n}“`).join(", ") ?? ""} angewendet`;
        break;
      case "email.reply_suggested":
        text = "hat einen Antwortvorschlag erstellt";
        break;
      case "note.create":
        text = "hat eine interne Notiz angelegt";
        break;
      case "comment.create":
        text = "hat kommentiert";
        break;
    }
    if (text) out.push({ id: r.id, at: r.createdAt.toISOString(), who, text });
  }
  return out;
}
