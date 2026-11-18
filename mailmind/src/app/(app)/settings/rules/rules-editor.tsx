"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LoaderCircle, Pencil, Play, Plus, Trash2, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api-client";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  ACTION_LABELS,
  CONDITION_FIELDS,
  CONDITION_OPS,
  OPS_BY_FIELD,
  type Condition,
  type RuleAction,
  type RuleInput,
} from "@/server/rules/schema";

export type RuleRow = RuleInput & { id: string; matchCount: number };
export type RuleOptions = {
  users: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  categories: { key: string; name: string }[];
  mailboxes: { id: string; name: string }[];
};

const selectCls =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30";

const EMPTY: RuleInput = {
  name: "",
  enabled: true,
  stopProcessing: false,
  conditions: { match: "all", items: [{ field: "from", op: "contains", value: "" }] },
  actions: [{ type: "priority", priority: "HIGH" }],
};

function defaultValueFor(field: Condition["field"], o: RuleOptions): string {
  if (field === "category") return o.categories[0]?.key ?? "";
  if (field === "priority") return "URGENT";
  if (field === "mailbox") return o.mailboxes[0]?.id ?? "";
  if (field === "hasAttachments") return "ja";
  return "";
}

function defaultAction(type: RuleAction["type"], o: RuleOptions): RuleAction {
  switch (type) {
    case "assign":
      return { type, userId: o.users[0]?.id ?? "" };
    case "label":
      return { type, labelId: o.labels[0]?.id ?? "" };
    case "priority":
      return { type, priority: "HIGH" };
    case "category":
      return { type, categoryKey: o.categories[0]?.key ?? "" };
    case "status":
      return { type, status: "IN_PROGRESS" };
    default:
      return { type } as RuleAction;
  }
}

/** Lesbare Zusammenfassung einer Regel („Wenn Absender endet auf … dann …“). */
function describe(rule: RuleInput, o: RuleOptions): { when: string; then: string } {
  const value = (c: Condition) =>
    c.field === "category"
      ? (o.categories.find((x) => x.key === c.value)?.name ?? c.value)
      : c.field === "priority"
        ? (PRIORITY_META[c.value as keyof typeof PRIORITY_META]?.label ?? c.value)
        : c.field === "mailbox"
          ? (o.mailboxes.find((x) => x.id === c.value)?.name ?? "?")
          : `„${c.value}“`;
  const when = rule.conditions.items
    .map((c) => `${CONDITION_FIELDS[c.field]} ${CONDITION_OPS[c.op]} ${value(c)}`)
    .join(rule.conditions.match === "all" ? " und " : " oder ");
  const then = rule.actions
    .map((a) => {
      switch (a.type) {
        case "assign":
          return `an ${o.users.find((u) => u.id === a.userId)?.name ?? "?"} zuweisen`;
        case "label":
          return `Label „${o.labels.find((l) => l.id === a.labelId)?.name ?? "?"}“`;
        case "priority":
          return `Priorität ${PRIORITY_META[a.priority].label}`;
        case "category":
          return `Kategorie ${o.categories.find((c) => c.key === a.categoryKey)?.name ?? a.categoryKey}`;
        case "status":
          return `Status ${STATUS_LABEL[a.status]}`;
        case "collapse":
          return "einklappen";
        case "markRead":
          return "als gelesen markieren";
      }
    })
    .join(", ");
  return { when, then };
}

function ValueInput({ c, o, onChange }: { c: Condition; o: RuleOptions; onChange: (v: string) => void }) {
  if (c.field === "category")
    return (
      <select aria-label="Kategorie" className={cn(selectCls, "flex-1")} value={c.value} onChange={(e) => onChange(e.target.value)}>
        {o.categories.map((x) => (
          <option key={x.key} value={x.key}>
            {x.name}
          </option>
        ))}
      </select>
    );
  if (c.field === "priority")
    return (
      <select aria-label="Priorität" className={cn(selectCls, "flex-1")} value={c.value} onChange={(e) => onChange(e.target.value)}>
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    );
  if (c.field === "mailbox")
    return (
      <select aria-label="Postfach" className={cn(selectCls, "flex-1")} value={c.value} onChange={(e) => onChange(e.target.value)}>
        {o.mailboxes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    );
  if (c.field === "hasAttachments")
    return (
      <select aria-label="Anhang" className={cn(selectCls, "flex-1")} value={c.value} onChange={(e) => onChange(e.target.value)}>
        <option value="ja">ja</option>
        <option value="nein">nein</option>
      </select>
    );
  return (
    <Input
      aria-label="Wert"
      className="flex-1"
      value={c.value}
      placeholder={c.field === "from" ? "z. B. @steuerberater.de" : "Stichwort"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ActionValue({ a, o, onChange }: { a: RuleAction; o: RuleOptions; onChange: (a: RuleAction) => void }) {
  if (a.type === "assign")
    return (
      <select aria-label="Person" className={cn(selectCls, "flex-1")} value={a.userId} onChange={(e) => onChange({ ...a, userId: e.target.value })}>
        {o.users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    );
  if (a.type === "label")
    return o.labels.length ? (
      <select aria-label="Label" className={cn(selectCls, "flex-1")} value={a.labelId} onChange={(e) => onChange({ ...a, labelId: e.target.value })}>
        {o.labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    ) : (
      <span className="flex-1 text-xs text-muted-foreground">Noch keine Labels – unter „Kategorien & Labels“ anlegen.</span>
    );
  if (a.type === "priority")
    return (
      <select aria-label="Priorität" className={cn(selectCls, "flex-1")} value={a.priority} onChange={(e) => onChange({ ...a, priority: e.target.value as typeof a.priority })}>
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    );
  if (a.type === "category")
    return (
      <select aria-label="Kategorie" className={cn(selectCls, "flex-1")} value={a.categoryKey} onChange={(e) => onChange({ ...a, categoryKey: e.target.value })}>
        {o.categories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
    );
  if (a.type === "status")
    return (
      <select aria-label="Status" className={cn(selectCls, "flex-1")} value={a.status} onChange={(e) => onChange({ ...a, status: e.target.value as typeof a.status })}>
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    );
  return <span className="flex-1" />;
}

function RuleDialog({ open, onOpenChange, initial, o, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; initial: RuleRow | null; o: RuleOptions; onSaved: () => void }) {
  const [r, setR] = useState<RuleInput>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ checked: number; matches: number; examples: { id: string; subject: string; from: string }[] } | null>(null);

  useEffect(() => {
    setR(initial ?? EMPTY);
    setError(null);
    setPreview(null);
  }, [initial, open]);

  // Live-Vorschau (verzögert), sobald alle Bedingungen einen Wert haben.
  const condKey = JSON.stringify(r.conditions);
  useEffect(() => {
    if (!open || r.conditions.items.some((c) => !c.value.trim())) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api<typeof preview>("/api/rules/preview", { body: { conditions: r.conditions } })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condKey, open]);

  const setCond = (i: number, c: Condition) => setR((x) => ({ ...x, conditions: { ...x.conditions, items: x.conditions.items.map((y, j) => (j === i ? c : y)) } }));
  const setAction = (i: number, a: RuleAction) => setR((x) => ({ ...x, actions: x.actions.map((y, j) => (j === i ? a : y)) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (initial) await api(`/api/rules/${initial.id}`, { method: "PATCH", body: r });
      else await api("/api/rules", { body: r });
      toast.success(initial ? "Regel gespeichert" : "Regel angelegt – gilt ab sofort für neue E-Mails");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[6vh] max-h-[88vh] max-w-2xl overflow-y-auto p-6">
        <DialogTitle className="text-base font-semibold">{initial ? "Regel bearbeiten" : "Neue Regel"}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          Regeln laufen nach der KI-Auswertung jeder neuen E-Mail und übersteuern sie (z. B. eine feste Priorität).
        </DialogDescription>
        <form onSubmit={save} className="mt-5 space-y-5">
          <Input aria-label="Name der Regel" placeholder="Name, z. B. „Steuerberater an Anna“" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />

          <fieldset className="space-y-2">
            <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
              Wenn
              <select aria-label="Verknüpfung" className={cn(selectCls, "h-7 text-xs")} value={r.conditions.match} onChange={(e) => setR({ ...r, conditions: { ...r.conditions, match: e.target.value as "all" | "any" } })}>
                <option value="all">alle Bedingungen</option>
                <option value="any">mindestens eine Bedingung</option>
              </select>
              zutreffen
            </legend>
            {r.conditions.items.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <select
                  aria-label="Feld"
                  className={selectCls}
                  value={c.field}
                  onChange={(e) => {
                    const field = e.target.value as Condition["field"];
                    setCond(i, { field, op: OPS_BY_FIELD[field][0]!, value: defaultValueFor(field, o) });
                  }}
                >
                  {(Object.keys(CONDITION_FIELDS) as Condition["field"][]).map((f) => (
                    <option key={f} value={f}>
                      {CONDITION_FIELDS[f]}
                    </option>
                  ))}
                </select>
                <select aria-label="Vergleich" className={selectCls} value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as Condition["op"] })}>
                  {OPS_BY_FIELD[c.field].map((op) => (
                    <option key={op} value={op}>
                      {CONDITION_OPS[op]}
                    </option>
                  ))}
                </select>
                <ValueInput c={c} o={o} onChange={(value) => setCond(i, { ...c, value })} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Bedingung entfernen"
                  disabled={r.conditions.items.length === 1}
                  onClick={() => setR((x) => ({ ...x, conditions: { ...x.conditions, items: x.conditions.items.filter((_, j) => j !== i) } }))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setR((x) => ({ ...x, conditions: { ...x.conditions, items: [...x.conditions.items, { field: "subject", op: "contains", value: "" }] } }))}
              disabled={r.conditions.items.length >= 10}
            >
              <Plus /> Bedingung
            </Button>
            {preview && (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">
                <span className="font-medium">
                  Trifft auf {preview.matches} der letzten {preview.checked} E-Mails zu
                </span>
                {preview.examples.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {preview.examples.map((x) => (
                      <li key={x.id} className="truncate">
                        {x.from}: {x.subject}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Dann</legend>
            {r.actions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <select aria-label="Aktion" className={selectCls} value={a.type} onChange={(e) => setAction(i, defaultAction(e.target.value as RuleAction["type"], o))}>
                  {(Object.keys(ACTION_LABELS) as RuleAction["type"][]).map((t) => (
                    <option key={t} value={t}>
                      {ACTION_LABELS[t]}
                    </option>
                  ))}
                </select>
                <ActionValue a={a} o={o} onChange={(x) => setAction(i, x)} />
                <Button type="button" variant="ghost" size="icon" aria-label="Aktion entfernen" disabled={r.actions.length === 1} onClick={() => setR((x) => ({ ...x, actions: x.actions.filter((_, j) => j !== i) }))}>
                  <X />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setR((x) => ({ ...x, actions: [...x.actions, defaultAction("label", o)] }))} disabled={r.actions.length >= 10}>
              <Plus /> Aktion
            </Button>
          </fieldset>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--primary)]" checked={r.enabled} onChange={(e) => setR({ ...r, enabled: e.target.checked })} /> Aktiv
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--primary)]" checked={r.stopProcessing} onChange={(e) => setR({ ...r, stopProcessing: e.target.checked })} /> Danach keine weiteren Regeln
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Regel-Editor: Liste in Ausführungsreihenfolge, anlegen/bearbeiten, an/aus, verschieben, nachträglich anwenden. */
export function RulesEditor({ rules: initialRules, options, canEdit }: { rules: RuleRow[]; options: RuleOptions; canEdit: boolean }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  useEffect(() => setRules(initialRules), [initialRules]);

  const described = useMemo(() => new Map(rules.map((r) => [r.id, describe(r, options)])), [rules, options]);

  async function toggle(r: RuleRow) {
    setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await api(`/api/rules/${r.id}`, { method: "PATCH", body: { enabled: !r.enabled } });
    } catch (err) {
      setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: r.enabled } : x)));
      toast.error((err as Error).message);
    }
  }

  async function move(i: number, d: -1 | 1) {
    const next = [...rules];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    const before = rules;
    setRules(next);
    try {
      await api("/api/rules/reorder", { body: { ids: next.map((r) => r.id) } });
    } catch (err) {
      setRules(before);
      toast.error((err as Error).message);
    }
  }

  async function remove(r: RuleRow) {
    if (!confirm(`Regel „${r.name}“ löschen?`)) return;
    try {
      await api(`/api/rules/${r.id}`, { method: "DELETE" });
      setRules((rs) => rs.filter((x) => x.id !== r.id));
      toast.success("Regel gelöscht");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function applyExisting(r: RuleRow) {
    setApplying(r.id);
    try {
      const res = await api<{ checked: number; matched: number }>(`/api/rules/${r.id}/apply`, { method: "POST" });
      toast.success(`Auf ${res.matched} von ${res.checked} offenen E-Mails (30 Tage) angewendet`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Regeln werden von oben nach unten ausgeführt. Bei widersprüchlichen Aktionen gewinnt die untere Regel.</p>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Neue Regel
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Noch keine Regeln"
          description="Beispiel: Wenn der Absender auf @steuerberater.de endet, dann Kategorie „Rechnung“ und an Anna zuweisen."
        />
      ) : (
        <Card className="divide-y">
          {rules.map((r, i) => {
            const d = described.get(r.id)!;
            return (
              <div key={r.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", !r.enabled && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    {!r.enabled && <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">aus</span>}
                    {r.stopProcessing && <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">stoppt danach</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Wenn</span> {d.when} <span className="font-medium text-foreground/80">→</span> {d.then}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{r.matchCount} × angewendet</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <label className="mr-2 flex items-center gap-1.5 text-xs">
                      <input type="checkbox" className="accent-[var(--primary)]" checked={r.enabled} onChange={() => toggle(r)} aria-label={`Regel ${r.name} aktiv`} />
                      aktiv
                    </label>
                    <Button variant="ghost" size="icon-sm" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Nach unten" disabled={i === rules.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Auf offene E-Mails anwenden" title="Auf offene E-Mails der letzten 30 Tage anwenden" disabled={!!applying} onClick={() => applyExisting(r)}>
                      {applying === r.id ? <LoaderCircle className="animate-spin" /> : <Play />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Bearbeiten"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Löschen" onClick={() => remove(r)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <RuleDialog open={open} onOpenChange={setOpen} initial={editing} o={options} onSaved={() => router.refresh()} />
    </div>
  );
}
