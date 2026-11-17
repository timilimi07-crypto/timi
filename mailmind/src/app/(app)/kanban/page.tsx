import type { Metadata } from "next";
import { SquareKanban } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Kanban" };

const COLUMNS = ["Neu", "In Bearbeitung", "Wartet", "Erledigt"];

/** Kanban-Ansicht – Drag & Drop folgt in Phase 5. */
export default async function KanbanPage() {
  await requireSession();
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Kanban" description="E-Mails nach Bearbeitungsstatus." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((c) => (
          <div key={c} className="rounded-xl border bg-muted/30 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-medium">{c}</span>
              <span className="text-xs tabular-nums text-muted-foreground">0</span>
            </div>
            <EmptyState icon={SquareKanban} title="Leer" className="border-none py-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
