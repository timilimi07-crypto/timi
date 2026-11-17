import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { InboxView } from "@/components/inbox/inbox-view";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { isAiConfigured } from "@/server/ai/client";
import { inboxCounts, listEmails, parseInboxFilters } from "@/server/queries/emails";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";

export const metadata: Metadata = { title: "Posteingang" };

/**
 * Posteingang (3 Spalten: App-Seitenleiste | Liste | Detail).
 * Die erste Seite wird serverseitig geladen (kein Lade-Flackern), danach
 * übernimmt der Client: Filter, Auswahl und Aktionen ohne Seitenwechsel.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;
  const filters = parseInboxFilters(params);
  const showCosts = can(session.role, "ai.costs");

  const [mailboxes, categories, counts, firstPage] = await Promise.all([
    db.mailbox.findMany({ where: scoped(session), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ where: scoped(session), orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    inboxCounts(session.organizationId),
    listEmails(session.organizationId, filters, { limit: 50, showCosts }),
  ]);

  if (mailboxes.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-6 pt-20">
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
      </div>
    );
  }

  const title = filters.category
    ? (categories.find((c) => c.key === filters.category)?.name ?? "Posteingang")
    : filters.mailbox
      ? (mailboxes.find((m) => m.id === filters.mailbox)?.name ?? "Posteingang")
      : "Posteingang";
  const selected = typeof params.id === "string" ? params.id : null;

  return (
    <InboxView
      // Neu aufbauen, wenn über die Seitenleiste ein anderer Filter gewählt wird.
      key={`${filters.category ?? ""}|${filters.mailbox ?? ""}`}
      initialFilters={filters}
      initialPage={firstPage}
      initialSelectedId={selected}
      options={{ categories, mailboxes, counts }}
      showCosts={showCosts}
      aiEnabled={isAiConfigured()}
      title={title}
    />
  );
}
