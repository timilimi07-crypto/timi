import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView, type TaskItem } from "@/components/tasks/tasks-view";
import { db } from "@/lib/db";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";

export const metadata: Metadata = { title: "Aufgaben" };

/** Aufgaben: alle offenen + die in den letzten 30 Tagen erledigten To-dos der Firma. */
export default async function TasksPage() {
  const session = await requireSession();
  const tasks = await db.task.findMany({
    where: scoped(session, {
      OR: [{ status: "OPEN" as const }, { status: "DONE" as const, completedAt: { gte: new Date(Date.now() - 30 * 864e5) } }],
      // Aufgaben gelöschter E-Mails ausblenden.
      AND: [{ OR: [{ emailId: null }, { email: { deletedAt: null } }] }],
    }),
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    include: { email: { select: { id: true, subject: true, fromName: true, fromEmail: true } }, assignee: { select: { id: true, name: true } } },
  });
  const items: TaskItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    source: t.source,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    dueDateText: t.dueDateText,
    completedAt: t.completedAt?.toISOString() ?? null,
    email: t.email,
    assignee: t.assignee,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Aufgaben" description="Von der KI aus E-Mails erkannte und eigene To-dos – nach Fälligkeit sortiert." />
      <TasksView initial={items} currentUserId={session.userId} />
    </div>
  );
}
