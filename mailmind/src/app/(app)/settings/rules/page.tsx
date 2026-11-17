import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Regeln" };

/** Regel-Editor – folgt in Phase 6. */
export default async function RulesPage() {
  await requireSession();
  return (
    <EmptyState
      icon={Workflow}
      title="Noch keine Regeln"
      description="Beispiel: Wenn der Absender @steuerberater.de enthält, dann Kategorie „Rechnung“ und an Anna zuweisen."
    />
  );
}
