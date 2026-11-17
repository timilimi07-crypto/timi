import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Inbox, Paperclip, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClassificationEditor } from "@/components/email/classification-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SyncButton } from "@/components/shared/sync-button";
import { modelLabel } from "@/lib/ai/models";
import { colorClasses } from "@/lib/colors";
import { db } from "@/lib/db";
import { formatUsd, TIME_ZONE } from "@/lib/format";
import { PRIORITY_META, type PriorityKey } from "@/lib/labels";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { isAiConfigured } from "@/server/ai/client";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";

export const metadata: Metadata = { title: "Posteingang" };

const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dayFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const shortDate = (d: Date) => (dayKey.format(d) === dayKey.format(new Date()) ? timeFmt.format(d) : dayFmt.format(d));
/** „Claude Haiku 5.5“ → „Haiku 5.5“ für die kompakte Kostenzeile. */
const shortModel = (id: string) => modelLabel(id).replace(/^Claude /, "");

const select = {
  id: true,
  subject: true,
  fromName: true,
  fromEmail: true,
  snippet: true,
  summary: true,
  receivedAt: true,
  isRead: true,
  isCollapsed: true,
  hasAttachments: true,
  aiStatus: true,
  aiError: true,
  priority: true,
  priorityReason: true,
  needsReview: true,
  reviewReason: true,
  aiModels: true,
  aiCostUsd: true,
  mailbox: { select: { name: true } },
  category: { select: { key: true, name: true, color: true } },
  thread: { select: { messageCount: true, summary: true } },
} as const;

/**
 * Posteingang – Phase 3: Liste mit KI-Zusammenfassung, Priorität, „Bitte prüfen“
 * und Korrektur der Einordnung. Newsletter/Spam sind eingeklappt.
 * Das 3-Spalten-Layout mit Detailansicht folgt in Phase 4.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; mailbox?: string; review?: string }>;
}) {
  const session = await requireSession();
  const { category, mailbox, review } = await searchParams;
  const showCosts = can(session.role, "ai.costs");
  const base = { deletedAt: null, isArchived: false };
  const where = scoped(session, {
    ...base,
    ...(mailbox ? { mailboxId: mailbox } : {}),
    ...(category ? { category: { key: category } } : {}),
    ...(review ? { needsReview: true } : {}),
  });

  const [emails, total, reviewCount, pendingCount, mailboxCount, categories, filterLabel] = await Promise.all([
    db.email.findMany({ where, orderBy: { receivedAt: "desc" }, take: 150, select }),
    db.email.count({ where: scoped(session, base) }),
    db.email.count({ where: scoped(session, { ...base, needsReview: true }) }),
    db.email.count({ where: scoped(session, { ...base, aiStatus: { in: ["PENDING" as const, "PROCESSING" as const] } }) }),
    db.mailbox.count({ where: scoped(session) }),
    db.category.findMany({ where: scoped(session), orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    mailbox
      ? db.mailbox.findFirst({ where: scoped(session, { id: mailbox }), select: { name: true } }).then((m) => m?.name)
      : category
        ? db.category.findFirst({ where: scoped(session, { key: category }), select: { name: true } }).then((c) => c?.name)
        : review
          ? "Bitte prüfen"
          : null,
  ]);

  // Newsletter/Spam nur in der Gesamtansicht einklappen – gezielte Filter zeigen alles.
  const collapseBulk = !category && !review;
  const visible = collapseBulk ? emails.filter((e) => !e.isCollapsed) : emails;
  const collapsed = collapseBulk ? emails.filter((e) => e.isCollapsed) : [];

  const Row = ({ e }: { e: (typeof emails)[number] }) => {
    const prio = e.priority ? PRIORITY_META[e.priority as PriorityKey] : null;
    return (
      <div className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/40 md:flex-row md:gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.isRead ? "bg-transparent" : "bg-primary")} aria-label={e.isRead ? undefined : "ungelesen"} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className={cn("truncate text-sm", !e.isRead && "font-semibold")}>{e.fromName || e.fromEmail}</span>
              {e.thread && e.thread.messageCount > 1 && <span className="text-xs tabular-nums text-muted-foreground">{e.thread.messageCount}</span>}
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(e.receivedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("truncate text-sm", e.isRead ? "text-muted-foreground" : "text-foreground")}>{e.subject}</span>
              {e.hasAttachments && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Anhang" />}
            </div>
            {e.summary ? (
              <p className="mt-1 flex gap-1.5 text-[13px] leading-snug text-foreground/85">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="KI-Zusammenfassung" />
                <span>{e.summary}</span>
              </p>
            ) : (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.snippet}</p>
            )}
            {e.thread?.summary && e.thread.messageCount > 1 && (
              <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Verlauf: </span>
                {e.thread.summary}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {prio && (
                <Badge className={prio.badge} title={e.priorityReason ?? undefined}>
                  {prio.label}
                </Badge>
              )}
              {e.category && <Badge className={colorClasses(e.category.color).badge}>{e.category.name}</Badge>}
              {e.needsReview && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300" title={e.reviewReason ?? undefined}>
                  <AlertTriangle /> Bitte prüfen
                </Badge>
              )}
              <Badge variant="outline" className="text-muted-foreground">
                {e.mailbox.name}
              </Badge>
              {(e.aiStatus === "PENDING" || e.aiStatus === "PROCESSING") && (
                <Badge variant="secondary" className="text-muted-foreground">
                  {e.aiStatus === "PROCESSING" ? "KI wertet aus …" : "KI-Auswertung ausstehend"}
                </Badge>
              )}
              {e.aiStatus === "FAILED" && (
                <Badge variant="destructive" title={e.aiError ?? undefined}>
                  KI-Auswertung fehlgeschlagen
                </Badge>
              )}
              {e.priorityReason && <span className="hidden text-xs text-muted-foreground lg:inline">· {e.priorityReason}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 pl-5 md:items-end md:pl-0">
          <ClassificationEditor
            emailId={e.id}
            categoryKey={e.category?.key ?? null}
            priority={(e.priority as PriorityKey) ?? null}
            categories={categories}
          />
          {showCosts && e.aiModels.length > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground" title="Nur für Admins sichtbar">
              {e.aiModels.map(shortModel).join(" + ")} · {formatUsd(Number(e.aiCostUsd))}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={filterLabel ? `Posteingang · ${filterLabel}` : "Posteingang"}
        description={`${total.toLocaleString("de-DE")} E-Mails${pendingCount ? ` · ${pendingCount} warten auf KI-Auswertung` : ""}`}
        actions={mailboxCount > 0 ? <SyncButton /> : undefined}
      />

      {showCosts && !isAiConfigured() && pendingCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            KI-Auswertung pausiert: Es ist kein <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> hinterlegt. Die E-Mails werden
            automatisch ausgewertet, sobald der Schlüssel eingetragen und der Worker neu gestartet ist.
          </span>
        </div>
      )}

      {reviewCount > 0 && !review && (
        <Link
          href="/inbox?review=1"
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent/50"
        >
          <AlertTriangle className="size-4 text-amber-500" />
          <span>
            <span className="font-medium">{reviewCount === 1 ? "1 E-Mail" : `${reviewCount} E-Mails`}</span> <span className="text-muted-foreground">– die KI war sich unsicher. Bitte Einordnung prüfen.</span>
          </span>
          <ChevronRight className="ml-auto size-4 text-muted-foreground" />
        </Link>
      )}

      {mailboxCount === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Noch kein Postfach verbunden"
          description="Verbinde ein Postfach (IMAP, Gmail oder Outlook), damit MailMind deine E-Mails abrufen und auswerten kann."
          action={
            <Button asChild>
              <Link href="/settings/mailboxes">Postfach verbinden</Link>
            </Button>
          }
        />
      ) : emails.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={review ? "Nichts zu prüfen" : "Keine E-Mails"}
          description={review ? "Alle Einordnungen sind sicher oder wurden bereits geprüft." : "Hier ist (noch) nichts. Klicke auf „Abrufen“, um nach neuen E-Mails zu sehen."}
        />
      ) : (
        <>
          <Card className="divide-y overflow-hidden">
            {visible.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </Card>
          {collapsed.length > 0 && (
            <details className="group rounded-xl border bg-card shadow-xs">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                {collapsed.length} Newsletter &amp; Spam automatisch eingeklappt
              </summary>
              <div className="divide-y border-t">
                {collapsed.map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
