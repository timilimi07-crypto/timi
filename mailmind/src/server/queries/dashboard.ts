import "server-only";

import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/format";
import { startOfBerlinDay } from "@/server/ai/time";
import { listEmails } from "./emails";

/**
 * Daten für das Dashboard: „Morgens in 2 Minuten wissen, was wichtig ist“.
 * Alle Tagesgrenzen in Europe/Berlin.
 */

const DAY = 24 * 3600_000;
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** Wichtig heute: offene Verläufe mit Dringend/Hoch, „Bitte prüfen“ oder Phishing-Verdacht. */
export async function getImportantToday(organizationId: string, opts: { showCosts: boolean; limit?: number }) {
  const page = await listEmails(organizationId, { view: "open", sort: "priority", review: false, phishing: false, unread: false }, { limit: 40, showCosts: opts.showCosts });
  return page.items
    .filter((i) => i.priority === "URGENT" || i.priority === "HIGH" || i.needsReview || i.phishingSuspected)
    .slice(0, opts.limit ?? 8);
}

export type DeadlineTask = {
  id: string;
  title: string;
  dueDate: string;
  dueDateText: string | null;
  bucket: "overdue" | "today" | "tomorrow" | "week";
  email: { id: string; subject: string; fromName: string | null; fromEmail: string } | null;
};

/** Offene Aufgaben mit Frist bis in 7 Tagen (inkl. Überfälligem). */
export async function getDeadlines(organizationId: string, now = new Date()): Promise<DeadlineTask[]> {
  const today = isoDay.format(now);
  const tomorrow = isoDay.format(new Date(now.getTime() + DAY));
  const tasks = await db.task.findMany({
    where: { organizationId, status: "OPEN", dueDate: { not: null, lt: new Date(startOfBerlinDay(now).getTime() + 8 * DAY) } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 30,
    include: { email: { select: { id: true, subject: true, fromName: true, fromEmail: true } } },
  });
  return tasks.map((t) => {
    // Fristen werden als 12:00 UTC des Kalendertags gespeichert → Tag direkt ablesbar.
    const day = t.dueDate!.toISOString().slice(0, 10);
    const bucket = day < today ? "overdue" : day === today ? "today" : day === tomorrow ? "tomorrow" : "week";
    return { id: t.id, title: t.title, dueDate: t.dueDate!.toISOString(), dueDateText: t.dueDateText, bucket, email: t.email };
  });
}

export type KpiCounts = {
  newEmails: number;
  urgent: number;
  openTasks: number;
  dueToday: number;
  overdue: number;
  review: number;
  phishing: number;
};

export async function getKpis(organizationId: string, now = new Date()): Promise<KpiCounts> {
  const open = { organizationId, deletedAt: null, isArchived: false, status: { not: "DONE" as const } };
  const endOfToday = new Date(startOfBerlinDay(now).getTime() + DAY);
  const [newEmails, urgent, openTasks, dueToday, overdue, review, phishing] = await Promise.all([
    db.email.count({ where: { ...open, status: "NEW", isCollapsed: false } }),
    db.email.count({ where: { ...open, priority: "URGENT" } }),
    db.task.count({ where: { organizationId, status: "OPEN" } }),
    db.task.count({ where: { organizationId, status: "OPEN", dueDate: { gte: startOfBerlinDay(now), lt: endOfToday } } }),
    db.task.count({ where: { organizationId, status: "OPEN", dueDate: { lt: startOfBerlinDay(now) } } }),
    db.email.count({ where: { ...open, needsReview: true } }),
    db.email.count({ where: { ...open, phishingSuspected: true } }),
  ]);
  return { newEmails, urgent, openTasks, dueToday, overdue, review, phishing };
}

export type CategoryCount = { key: string | null; name: string; count: number };

/** E-Mails pro Kategorie in den letzten `days` Tagen (inkl. „noch nicht ausgewertet“). */
export async function getEmailsPerCategory(organizationId: string, days = 7, now = new Date()): Promise<CategoryCount[]> {
  const since = new Date(startOfBerlinDay(now).getTime() - (days - 1) * DAY);
  const rows = await db.$queryRaw<{ key: string | null; name: string | null; sort: number | null; count: bigint }[]>`
    SELECT c.key, c.name, c."sortOrder" AS sort, COUNT(*) AS count
    FROM "Email" e
    LEFT JOIN "Category" c ON c.id = e."categoryId"
    WHERE e."organizationId" = ${organizationId} AND e."deletedAt" IS NULL AND e."receivedAt" >= ${since}
    GROUP BY c.key, c.name, c."sortOrder"
    ORDER BY count DESC, sort ASC NULLS LAST`;
  return rows.map((r) => ({ key: r.key, name: r.name ?? "Noch nicht ausgewertet", count: Number(r.count) }));
}

export type DayCount = { day: string; total: number; urgent: number };

/** E-Mails pro Tag (lückenlos), davon dringend. */
export async function getEmailsPerDay(organizationId: string, days = 14, now = new Date()): Promise<DayCount[]> {
  const since = new Date(startOfBerlinDay(now).getTime() - (days - 1) * DAY);
  const rows = await db.$queryRaw<{ day: string; total: bigint; urgent: bigint }[]>`
    SELECT to_char((e."receivedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE})::date, 'YYYY-MM-DD') AS day,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE e.priority = 'URGENT') AS urgent
    FROM "Email" e
    WHERE e."organizationId" = ${organizationId} AND e."deletedAt" IS NULL AND e."receivedAt" >= ${since}
    GROUP BY 1`;
  const map = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay.format(new Date(since.getTime() + i * DAY + 12 * 3600_000));
    const r = map.get(day);
    return { day, total: Number(r?.total ?? 0), urgent: Number(r?.urgent ?? 0) };
  });
}

