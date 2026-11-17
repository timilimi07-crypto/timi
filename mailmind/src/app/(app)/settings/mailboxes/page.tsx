import type { Metadata } from "next";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { isOAuthConfigured } from "@/server/mail/oauth";
import type { SyncState } from "@/server/mail/types";
import { requireSession } from "@/server/session";
import { scoped } from "@/server/tenant";
import { ConnectMailboxDialog } from "./connect-dialog";
import { MailboxList, type MailboxRow } from "./mailbox-list";

export const metadata: Metadata = { title: "Postfächer" };

export default async function MailboxesPage() {
  const session = await requireSession();
  const [mailboxes, org] = await Promise.all([
    db.mailbox.findMany({
      where: scoped(session),
      orderBy: { name: "asc" },
      include: { _count: { select: { emails: true } } },
    }),
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { initialSyncDays: true, syncIntervalMinutes: true } }),
  ]);

  const rows: MailboxRow[] = mailboxes.map((m) => {
    const state = m.syncState as SyncState | null;
    const cfg = (m.config ?? {}) as { host?: string };
    return {
      id: m.id,
      name: m.name,
      emailAddress: m.emailAddress,
      provider: m.provider,
      status: m.status,
      syncEnabled: m.syncEnabled,
      lastSyncAt: m.lastSyncAt?.toISOString() ?? null,
      lastError: m.lastError,
      emailCount: m._count.emails,
      pending: state?.pending.length ?? 0,
      windowStart: state?.windowStart ?? null,
      initialSyncDays: m.initialSyncDays ?? org.initialSyncDays,
      host: cfg.host ?? null,
    };
  });
  const canManage = can(session.role, "mailbox.manage");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Automatischer Abruf alle {org.syncIntervalMinutes} Min. · Erster Abruf: letzte {org.initialSyncDays} Tage
        </p>
        {canManage && (
          <ConnectMailboxDialog
            defaultDays={org.initialSyncDays}
            oauth={{ google: isOAuthConfigured("google"), microsoft: isOAuthConfigured("microsoft") }}
          />
        )}
      </div>
      <MailboxList rows={rows} canManage={canManage} />
    </div>
  );
}
