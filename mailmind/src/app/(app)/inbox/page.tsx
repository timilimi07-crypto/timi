import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Posteingang" };

/** Posteingang – das 3-Spalten-Layout folgt in Phase 4. */
export default async function InboxPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Posteingang" description="Alle E-Mails mit KI-Zusammenfassung, Kategorie und Priorität." />
      <EmptyState
        icon={Inbox}
        title="Noch keine E-Mails"
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
