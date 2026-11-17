import type { Metadata } from "next";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/lib/db";
import { requirePermission } from "@/server/session";
import { scoped } from "@/server/tenant";
import { formatDateTimeShort } from "@/lib/format";

export const metadata: Metadata = { title: "Audit-Log" };

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "hat sich angemeldet",
  "email.view": "hat eine E-Mail geöffnet",
  "email.update": "hat eine E-Mail bearbeitet",
  "email.assign": "hat eine E-Mail zugewiesen",
  "email.status": "hat den Status geändert",
  "email.delete": "hat eine E-Mail gelöscht",
};

/** Die letzten 100 Einträge. Filter und Export folgen in Phase 7. */
export default async function AuditPage() {
  const session = await requirePermission("audit.read");
  const entries = await db.auditLog.findMany({
    where: scoped(session),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  if (entries.length === 0) {
    return <EmptyState icon={History} title="Noch keine Einträge" />;
  }

  return (
    <Card className="divide-y">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-36 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatDateTimeShort(e.createdAt)}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{e.user?.name ?? "System"}</span>{" "}
            <span className="text-muted-foreground">{ACTION_LABELS[e.action] ?? e.action}</span>
          </span>
          <span className="hidden font-mono text-xs text-muted-foreground md:block">{e.ipAddress ?? ""}</span>
        </div>
      ))}
    </Card>
  );
}
