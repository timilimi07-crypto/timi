import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CalendarClock, Inbox, ListTodo, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/lib/db";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { formatLongDay, greeting } from "@/lib/format";
import { can } from "@/lib/rbac";
import { resolveModels } from "@/lib/ai/models";
import { getAiCostStats } from "@/server/queries/ai-costs";
import { AiCostCard } from "@/components/dashboard/ai-cost-card";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard – Phase 1: Begrüßung und Kennzahlen-Kacheln.
 * "Heute wichtig", Fristen und Diagramme folgen in Phase 5.
 */
export default async function DashboardPage() {
  const session = await requireSession();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const base = { deletedAt: null, isArchived: false };

  const [newCount, urgentCount, openTasks, dueToday] = await Promise.all([
    db.email.count({ where: scoped(session, { ...base, status: "NEW" as const }) }),
    db.email.count({ where: scoped(session, { ...base, priority: "URGENT" as const, status: { not: "DONE" as const } }) }),
    db.task.count({ where: scoped(session, { status: "OPEN" as const }) }),
    db.task.count({ where: scoped(session, { status: "OPEN" as const, dueDate: { lte: endOfDay } }) }),
  ]);

  // KI-Kosten nur für Admins.
  const showCosts = can(session.role, "ai.costs");
  const [costStats, org] = showCosts
    ? await Promise.all([
        getAiCostStats(session.organizationId),
        db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { aiModel: true, aiModelFast: true } }),
      ])
    : [null, null];

  const tiles = [
    { label: "Neue E-Mails", value: newCount, icon: Inbox, tone: "text-primary" },
    { label: "Dringend", value: urgentCount, icon: AlertCircle, tone: "text-red-500" },
    { label: "Offene Aufgaben", value: openTasks, icon: ListTodo, tone: "text-amber-500" },
    { label: "Heute fällig", value: dueToday, icon: CalendarClock, tone: "text-emerald-500" },
  ];

  const today = formatLongDay(new Date());
  const firstName = session.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title={`${greeting()}, ${firstName}`} description={`${today} – hier ist dein Überblick.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
              <t.icon className={`size-4 ${t.tone}`} />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{t.value}</div>
          </Card>
        ))}
      </div>

      {costStats && org && <AiCostCard stats={costStats} models={resolveModels(org)} />}

      <EmptyState
        icon={Sparkles}
        title="Heute wichtig"
        description="Sobald E-Mails abgerufen und von der KI ausgewertet wurden, erscheinen hier die wichtigsten Punkte des Tages."
        action={
          <Button asChild variant="outline">
            <Link href="/inbox">Zum Posteingang</Link>
          </Button>
        }
      />
    </div>
  );
}
