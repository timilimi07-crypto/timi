import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CalendarClock, Inbox, ListTodo, ShieldAlert, Sparkles, UserRoundCheck } from "lucide-react";
import { AiCostCard } from "@/components/dashboard/ai-cost-card";
import { EmailsPerCategoryChart, EmailsPerDayChart } from "@/components/dashboard/charts";
import { DeadlinesCard } from "@/components/dashboard/deadlines-card";
import { PhishingBadge } from "@/components/inbox/email-row";
import { shortDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { resolveModels } from "@/lib/ai/models";
import { colorClasses } from "@/lib/colors";
import { db } from "@/lib/db";
import { formatLongDay, greeting } from "@/lib/format";
import { PRIORITY_META, type PriorityKey } from "@/lib/labels";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { getAiCostStats } from "@/server/queries/ai-costs";
import { getDeadlines, getEmailsPerCategory, getEmailsPerDay, getImportantToday, getKpis } from "@/server/queries/dashboard";
import { requireSession } from "@/server/session";
import { describeAiProvider } from "@/server/ai/provider";

export const metadata: Metadata = { title: "Dashboard" };

function SectionCard({ title, icon: Icon, action, children, className }: { title: string; icon: typeof Inbox; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/**
 * Dashboard: Was ist wichtig, was muss heute erledigt werden, was kann warten?
 * Kacheln führen direkt in die passend gefilterte Ansicht.
 */
export default async function DashboardPage() {
  const session = await requireSession();
  const showCosts = can(session.role, "ai.costs");
  const orgId = session.organizationId;

  const [kpis, important, deadlines, perCategory, perDay, costStats, org] = await Promise.all([
    getKpis(orgId, new Date(), session.userId),
    getImportantToday(orgId, { showCosts }),
    getDeadlines(orgId),
    getEmailsPerCategory(orgId),
    getEmailsPerDay(orgId),
    showCosts ? getAiCostStats(orgId) : null,
    showCosts ? db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { aiModel: true, aiModelFast: true } }) : null,
  ]);

  const tiles = [
    { label: "Neue E-Mails", value: kpis.newEmails, icon: Inbox, tone: "text-primary", href: "/inbox?status=NEW" },
    { label: "Dringend", value: kpis.urgent, icon: AlertCircle, tone: "text-red-500", href: "/inbox?priority=URGENT" },
    { label: "Offene Aufgaben", value: kpis.openTasks, icon: ListTodo, tone: "text-amber-500", href: "/tasks" },
    {
      label: "Heute fällig",
      value: kpis.dueToday,
      icon: CalendarClock,
      tone: "text-emerald-500",
      href: "/tasks",
      hint: kpis.overdue ? `+ ${kpis.overdue} überfällig` : undefined,
    },
  ];
  const firstName = session.name.split(" ")[0];
  const summaryLine =
    kpis.urgent === 0 && kpis.dueToday === 0 && kpis.overdue === 0
      ? "Nichts Dringendes – ein guter Tag, um Liegengebliebenes abzuarbeiten."
      : [
          kpis.urgent ? `${kpis.urgent} dringende E-Mail${kpis.urgent === 1 ? "" : "s"}` : null,
          kpis.dueToday ? `${kpis.dueToday} Aufgabe${kpis.dueToday === 1 ? "" : "n"} heute fällig` : null,
          kpis.overdue ? `${kpis.overdue} überfällig` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader title={`${greeting()}, ${firstName}`} description={`${formatLongDay(new Date())} · ${summaryLine}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:bg-accent/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
                <t.icon className={`size-4 ${t.tone}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{t.value}</span>
                {t.hint && <span className="text-xs font-medium text-red-600 dark:text-red-400">{t.hint}</span>}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {(kpis.phishing > 0 || kpis.review > 0 || kpis.mine > 0) && (
        <div className="flex flex-wrap gap-2">
          {kpis.mine > 0 && (
            <Link href="/inbox?assignee=me" className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/15">
              <UserRoundCheck className="size-4" /> {kpis.mine} E-Mail{kpis.mine === 1 ? "" : "s"} dir zugewiesen
            </Link>
          )}
          {kpis.phishing > 0 && (
            <Link href="/inbox?phishing=1" className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 hover:bg-red-500/15 dark:text-red-300">
              <ShieldAlert className="size-4" /> {kpis.phishing} mögliche{kpis.phishing === 1 ? "r" : ""} Phishing-Versuch{kpis.phishing === 1 ? "" : "e"} – nicht öffnen, prüfen
            </Link>
          )}
          {kpis.review > 0 && (
            <Link href="/inbox?review=1" className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 hover:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangle className="size-4" /> {kpis.review} Einordnung{kpis.review === 1 ? "" : "en"} bitte prüfen
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title="Heute wichtig"
          icon={Sparkles}
          action={
            <Link href="/inbox?sort=priority" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Posteingang nach Wichtigkeit <ArrowRight className="size-3" />
            </Link>
          }
        >
          {important.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nichts Dringendes offen. 🎉</p>
          ) : (
            <ul className="-mx-2 divide-y">
              {important.map((e) => {
                const prio = e.priority ? PRIORITY_META[e.priority as PriorityKey] : null;
                return (
                  <li key={e.id}>
                    <Link href={`/inbox?sort=priority&id=${e.id}`} className="block rounded-md px-2 py-2.5 transition-colors hover:bg-accent/50">
                      <div className="flex items-center gap-2">
                        {prio && <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide", prio.badge)}>{prio.label}</span>}
                        <span className="truncate text-sm font-medium">{e.fromName ?? e.fromEmail}</span>
                        {e.thread && e.thread.messageCount > 1 && <span className="text-xs text-muted-foreground">{e.thread.messageCount}</span>}
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(e.receivedAt)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-sm text-foreground/90">{e.subject}</div>
                      {e.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.summary}</p>}
                      {(e.phishingSuspected || e.needsReview || e.category) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.phishingSuspected && <PhishingBadge />}
                          {e.needsReview && <span className="rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">Bitte prüfen</span>}
                          {e.category && <span className={cn("rounded px-1.5 py-px text-[10px] font-medium", colorClasses(e.category.color).badge)}>{e.category.name}</span>}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Fristen" icon={CalendarClock}>
          <DeadlinesCard tasks={deadlines} />
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="E-Mails pro Tag · letzte 14 Tage" icon={Inbox}>
          <EmailsPerDayChart data={perDay} />
        </SectionCard>
        <SectionCard title="E-Mails pro Kategorie · letzte 7 Tage" icon={ListTodo}>
          {perCategory.length ? <EmailsPerCategoryChart data={perCategory} /> : <p className="py-8 text-center text-sm text-muted-foreground">Keine E-Mails in den letzten 7 Tagen.</p>}
        </SectionCard>
      </div>

      {costStats && org && (
        <AiCostCard
          stats={costStats}
          models={resolveModels(org)}
          providerNote={describeAiProvider().provider === "ollama" ? `Aktiver Anbieter: Ollama (lokal, ${describeAiProvider().detail}) – keine API-Kosten` : undefined}
        />
      )}
    </div>
  );
}
