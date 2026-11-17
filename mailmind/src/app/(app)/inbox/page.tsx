import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SyncButton } from "@/components/shared/sync-button";
import { colorClasses } from "@/lib/colors";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";

export const metadata: Metadata = { title: "Posteingang" };

const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dayFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

function shortDate(d: Date) {
  return dayKey.format(d) === dayKey.format(new Date()) ? timeFmt.format(d) : dayFmt.format(d);
}

/**
 * Posteingang – Phase 2: einfache Liste der abgerufenen E-Mails mit Filtern aus
 * der Seitenleiste. Das 3-Spalten-Layout mit KI-Zusammenfassung folgt in Phase 4.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ category?: string; mailbox?: string }> }) {
  const session = await requireSession();
  const { category, mailbox } = await searchParams;

  const [emails, total, mailboxCount, filterLabel] = await Promise.all([
    db.email.findMany({
      where: scoped(session, {
        deletedAt: null,
        isArchived: false,
        ...(mailbox ? { mailboxId: mailbox } : {}),
        ...(category ? { category: { key: category } } : {}),
      }),
      orderBy: { receivedAt: "desc" },
      take: 100,
      select: {
        id: true,
        subject: true,
        fromName: true,
        fromEmail: true,
        snippet: true,
        receivedAt: true,
        isRead: true,
        hasAttachments: true,
        aiStatus: true,
        mailbox: { select: { name: true } },
        category: { select: { name: true, color: true } },
        thread: { select: { messageCount: true } },
      },
    }),
    db.email.count({ where: scoped(session, { deletedAt: null, isArchived: false }) }),
    db.mailbox.count({ where: scoped(session) }),
    mailbox
      ? db.mailbox.findFirst({ where: scoped(session, { id: mailbox }), select: { name: true } }).then((m) => m?.name)
      : category
        ? db.category.findFirst({ where: scoped(session, { key: category }), select: { name: true } }).then((c) => c?.name)
        : null,
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={filterLabel ? `Posteingang · ${filterLabel}` : "Posteingang"}
        description={`${total.toLocaleString("de-DE")} E-Mails insgesamt`}
        actions={mailboxCount > 0 ? <SyncButton /> : undefined}
      />

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
        <EmptyState icon={Inbox} title="Keine E-Mails" description="Hier ist (noch) nichts. Klicke auf „Abrufen“, um nach neuen E-Mails zu sehen." />
      ) : (
        <Card className="divide-y overflow-hidden">
          {emails.map((e) => (
            <div key={e.id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.isRead ? "bg-transparent" : "bg-primary")} aria-label={e.isRead ? undefined : "ungelesen"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={cn("truncate text-sm", !e.isRead && "font-semibold")}>{e.fromName || e.fromEmail}</span>
                  {e.thread && e.thread.messageCount > 1 && (
                    <span className="text-xs tabular-nums text-muted-foreground">{e.thread.messageCount}</span>
                  )}
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(e.receivedAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("truncate text-sm", e.isRead ? "text-muted-foreground" : "text-foreground")}>{e.subject}</span>
                  {e.hasAttachments && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Anhang" />}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.snippet}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.category && (
                    <Badge className={colorClasses(e.category.color).badge}>{e.category.name}</Badge>
                  )}
                  <Badge variant="outline" className="text-muted-foreground">{e.mailbox.name}</Badge>
                  {e.aiStatus === "PENDING" && (
                    <Badge variant="secondary" className="text-muted-foreground">KI-Auswertung ausstehend</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
