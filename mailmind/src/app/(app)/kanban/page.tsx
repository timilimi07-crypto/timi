import type { Metadata } from "next";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { STATUSES, type Columns } from "@/components/kanban/statuses";
import { KanbanFilters } from "@/components/kanban/kanban-filters";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { listEmails, parseInboxFilters } from "@/server/queries/emails";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";

export const metadata: Metadata = { title: "Kanban" };

/** Kanban: Verläufe nach Status (Neu, In Bearbeitung, Wartet, Erledigt). */
export default async function KanbanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;
  const base = parseInboxFilters(params);
  const showCosts = can(session.role, "ai.costs");

  const [categories, ...pages] = await Promise.all([
    db.category.findMany({ where: scoped(session), orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    ...STATUSES.map((status) =>
      listEmails(session.organizationId, { ...base, view: "all", status, sort: status === "DONE" ? "newest" : base.sort }, { limit: status === "DONE" ? 30 : 100, showCosts, userId: session.userId }),
    ),
  ]);
  const columns = Object.fromEntries(STATUSES.map((s, i) => [s, pages[i]!.items])) as Columns;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kanban</h1>
          <p className="text-sm text-muted-foreground">Verläufe nach Bearbeitungsstand. Karten ziehen, um den Status zu ändern.</p>
        </div>
        <KanbanFilters categories={categories} />
      </div>
      {/* Neu aufbauen, wenn sich die Filter ändern */}
      <KanbanBoard key={JSON.stringify(params)} initial={columns} />
    </div>
  );
}
