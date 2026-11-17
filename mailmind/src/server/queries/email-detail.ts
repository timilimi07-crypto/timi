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
