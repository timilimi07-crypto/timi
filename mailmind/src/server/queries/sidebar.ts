import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { scoped } from "@/server/tenant";
import type { AppSession } from "@/server/session";
import type { SidebarCategory, SidebarCounts, SidebarMailbox } from "@/components/layout/types";

/** Daten für die Seitenleiste – pro Request einmal geladen (React cache). */
export const getSidebarData = cache(async (session: AppSession) => {
  const notDeleted = { deletedAt: null, isArchived: false };

  const [categories, openByCategory, mailboxes, inboxUnread, openTasks] = await Promise.all([
    db.category.findMany({
      where: scoped(session),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, key: true, name: true, color: true },
    }),
    db.email.groupBy({
      by: ["categoryId"],
      where: scoped(session, { ...notDeleted, status: { not: "DONE" as const } }),
      _count: { _all: true },
    }),
    db.mailbox.findMany({
      where: scoped(session),
      orderBy: { name: "asc" },
      select: { id: true, name: true, emailAddress: true, provider: true, status: true },
    }),
    db.email.count({ where: scoped(session, { ...notDeleted, isRead: false, direction: "INBOUND" as const }) }),
    db.task.count({ where: scoped(session, { status: "OPEN" as const }) }),
  ]);

  const countMap = new Map(openByCategory.map((g) => [g.categoryId, g._count._all]));

  return {
    categories: categories.map<SidebarCategory>((c) => ({ ...c, openCount: countMap.get(c.id) ?? 0 })),
    mailboxes: mailboxes satisfies SidebarMailbox[],
    counts: { inboxUnread, openTasks } satisfies SidebarCounts,
  };
});
