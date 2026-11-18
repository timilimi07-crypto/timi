"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/rbac";
import { cn, initials } from "@/lib/utils";

type Role = keyof typeof ROLE_LABELS;
export type TeamMember = { id: string; name: string; email: string; role: Role; isActive: boolean; lastLoginAt: string | null; openAssigned: number };

const selectCls = "h-8 rounded-md border border-input bg-background px-2 text-xs dark:bg-input/30";

export function TeamManager({ members, currentUserId, canManage }: { members: TeamMember[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "MEMBER" as Role });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function update(id: string, body: Partial<{ role: Role; isActive: boolean }>) {
    try {
      await api(`/api/team/${id}`, { method: "PATCH", body });
      toast.success("Gespeichert");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ user: { email: string }; initialPassword: string }>("/api/team", { body: form });
      setCreated({ email: r.user.email, password: r.initialPassword });
      setForm({ name: "", email: "", role: "MEMBER" });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="divide-y">
        {members.map((u) => (
          <div key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !u.isActive && "opacity-60")}>
            <Avatar>
              <AvatarFallback>{initials(u.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {u.name} {u.id === currentUserId && <span className="text-muted-foreground">(du)</span>}
                {!u.isActive && <span className="ml-2 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">deaktiviert</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {u.email} · {u.openAssigned} offen zugewiesen · {u.lastLoginAt ? `zuletzt aktiv ${formatDateTime(new Date(u.lastLoginAt))}` : "noch nie angemeldet"}
              </div>
            </div>
            {canManage && u.id !== currentUserId ? (
              <div className="flex items-center gap-2">
                <select aria-label={`Rolle von ${u.name}`} className={selectCls} value={u.role} onChange={(e) => update(u.id, { role: e.target.value as Role })}>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => update(u.id, { isActive: !u.isActive })}>
                  {u.isActive ? "Deaktivieren" : "Aktivieren"}
                </Button>
              </div>
            ) : (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{ROLE_LABELS[u.role]}</span>
            )}
          </div>
        ))}
      </Card>

      {canManage && (
        <form onSubmit={add} className="space-y-2 rounded-xl border border-dashed p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="size-4 text-muted-foreground" /> Person hinzufügen
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input aria-label="E-Mail" type="email" placeholder="E-Mail (Login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select aria-label="Rolle" className={cn(selectCls, "h-9")} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={busy || !form.name.trim() || !form.email.trim()}>
              {busy && <LoaderCircle className="animate-spin" />} Anlegen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Rollen: <strong>Admin</strong> – alles inkl. Postfächer, Team, Datenschutz · <strong>Manager</strong> – zuweisen, Regeln, Kategorien · <strong>Mitarbeiter</strong> – E-Mails und Aufgaben bearbeiten, selbst übernehmen.
          </p>
        </form>
      )}

      {created && (
        <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4" /> Zugang für {created.email} angelegt
          </div>
          <p className="mt-1 text-muted-foreground">Startpasswort – wird nur jetzt angezeigt. Bitte sicher weitergeben:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-background px-2 py-1 font-mono">{created.password}</code>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(created.password).then(() => toast.success("Kopiert"))}>
              <Copy /> Kopieren
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
              Fertig
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
