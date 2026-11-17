import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/lib/db";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Postfächer" };

const PROVIDER_LABEL = { IMAP: "IMAP", GMAIL: "Gmail", OUTLOOK: "Outlook / Exchange", DEMO: "Demo" } as const;
const STATUS_LABEL = { ACTIVE: "Aktiv", SYNCING: "Synchronisiert …", ERROR: "Fehler", DISABLED: "Deaktiviert" } as const;

/** Postfach-Übersicht. Verbinden/Sync folgen in Phase 2. */
export default async function MailboxesPage() {
  const session = await requireSession();
  const mailboxes = await db.mailbox.findMany({
    where: scoped(session),
    orderBy: { name: "asc" },
    include: { _count: { select: { emails: true } } },
  });

  if (mailboxes.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Noch kein Postfach verbunden"
        description="Unterstützt werden IMAP, Gmail und Microsoft 365 / Outlook."
      />
    );
  }

  return (
    <Card className="divide-y">
      {mailboxes.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-8 place-items-center rounded-md bg-muted">
            <Mail className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{m.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {m.emailAddress} · {PROVIDER_LABEL[m.provider]} · {m._count.emails} E-Mails
            </div>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">
            {m.lastSyncAt ? `Letzter Abruf: ${formatDateTime(m.lastSyncAt)}` : "Noch nicht abgerufen"}
          </span>
          <Badge variant={m.status === "ERROR" ? "destructive" : "secondary"}>{STATUS_LABEL[m.status]}</Badge>
        </div>
      ))}
    </Card>
  );
}
