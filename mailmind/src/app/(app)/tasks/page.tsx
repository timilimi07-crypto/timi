import type { Metadata } from "next";
import { ListTodo } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Aufgaben" };

/** Aufgaben-Ansicht – folgt in Phase 5. */
export default async function TasksPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Aufgaben" description="Alle von der KI erkannten und manuell angelegten To-dos." />
      <EmptyState
        icon={ListTodo}
        title="Keine offenen Aufgaben"
        description="Aufgaben werden automatisch aus eingehenden E-Mails extrahiert – inklusive erkannter Fristen."
      />
    </div>
  );
}
