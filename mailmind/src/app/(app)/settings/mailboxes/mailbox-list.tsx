"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, LoaderCircle, Mail, MoreHorizontal, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { api, describeSync, type SyncResponse } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export type MailboxRow = {
  id: string;
  name: string;
  emailAddress: string;
  provider: "IMAP" | "GMAIL" | "OUTLOOK" | "DEMO";
  status: "ACTIVE" | "SYNCING" | "ERROR" | "DISABLED";
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  emailCount: number;
  pending: number;
  windowStart: string | null;
  initialSyncDays: number;
  host: string | null;
};

const PROVIDER_LABEL = { IMAP: "IMAP", GMAIL: "Gmail", OUTLOOK: "Microsoft 365 / Outlook", DEMO: "Demo-Postfach" } as const;
const STATUS: Record<MailboxRow["status"], { label: string; variant: "secondary" | "destructive" | "default" | "outline" }> = {
  ACTIVE: { label: "Aktiv", variant: "secondary" },
  SYNCING: { label: "Wird abgerufen …", variant: "default" },
  ERROR: { label: "Fehler", variant: "destructive" },
  DISABLED: { label: "Pausiert", variant: "outline" },
};

function Row({ m, canManage }: { m: MailboxRow; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sync" | "toggle" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function sync() {
    setBusy("sync");
    try {
      const r = await api<SyncResponse>(`/api/mailboxes/${m.id}/sync`, { method: "POST" });
      const d = describeSync(r);
      (d.ok ? toast.success : toast.error)(d.message);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggle() {
    setBusy("toggle");
    try {
      await api(`/api/mailboxes/${m.id}`, { method: "PATCH", body: { syncEnabled: !m.syncEnabled } });
      toast.success(m.syncEnabled ? "Abruf pausiert" : "Abruf fortgesetzt");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const r = await api<{ deletedEmails: number }>(`/api/mailboxes/${m.id}`, { method: "DELETE" });
      toast.success(`Postfach entfernt (${r.deletedEmails} E-Mails gelöscht)`);
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const status = STATUS[m.status];
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <Mail className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{m.name}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {m.emailAddress} · {PROVIDER_LABEL[m.provider]}
            {m.host ? ` (${m.host})` : ""}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{m.emailCount.toLocaleString("de-DE")} E-Mails</span>
            <span>{m.lastSyncAt ? `Letzter Abruf: ${formatDateTime(new Date(m.lastSyncAt))}` : "Noch nicht abgerufen"}</span>
            <span>
              {m.windowStart
                ? `E-Mails ab ${formatDateTime(new Date(m.windowStart)).split(",")[0]}`
                : `Erster Abruf: letzte ${m.initialSyncDays} Tage`}
            </span>
            {m.pending > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {m.pending.toLocaleString("de-DE")} E-Mails werden schrittweise nachgeladen
              </span>
            )}
          </div>
          {m.status === "ERROR" && m.lastError && (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {m.lastError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={sync} disabled={!!busy || !m.syncEnabled}>
            {busy === "sync" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            <span className="hidden sm:inline">Jetzt abrufen</span>
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen" disabled={!!busy}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={toggle}>
                  {m.syncEnabled ? <Pause /> : <Play />}
                  {m.syncEnabled ? "Abruf pausieren" : "Abruf fortsetzen"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive [&_svg]:!text-destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Postfach entfernen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">Postfach „{m.name}“ entfernen?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Alle {m.emailCount.toLocaleString("de-DE")} abgerufenen E-Mails samt Zusammenfassungen, Aufgaben und Kommentaren
            werden aus MailMind gelöscht. Im ursprünglichen Postfach bleibt alles erhalten.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy === "delete"}>
              {busy === "delete" && <LoaderCircle className="animate-spin" />}
              Endgültig entfernen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MailboxList({ rows, canManage }: { rows: MailboxRow[]; canManage: boolean }) {
  const params = useSearchParams();
  const router = useRouter();

  // Rückmeldung nach dem OAuth-Rücksprung anzeigen.
  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(`Postfach ${connected} verbunden – der erste Abruf läuft.`);
    if (error) toast.error(error);
    if (connected || error) router.replace("/settings/mailboxes");
  }, [params, router]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Noch kein Postfach verbunden"
        description="Unterstützt werden IMAP (z. B. IONOS, Strato, eigener Server), Gmail / Google Workspace und Microsoft 365 / Outlook."
      />
    );
  }
  return (
    <Card className="divide-y">
      {rows.map((m) => (
        <Row key={m.id} m={m} canManage={canManage} />
      ))}
    </Card>
  );
}
