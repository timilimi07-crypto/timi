"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, ListTodo, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type TaskItem = {
  id: string;
  title: string;
  status: "OPEN" | "DONE";
  source: "AI" | "MANUAL";
  dueDate: string | null; // YYYY-MM-DD
  dueDateText: string | null;
  completedAt: string | null;
  email: { id: string; subject: string; fromName: string | null; fromEmail: string } | null;
};

type Group = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";
const GROUPS: { key: Group; label: string; tone?: string }[] = [
  { key: "overdue", label: "Überfällig", tone: "text-red-600 dark:text-red-400" },
  { key: "today", label: "Heute" },
  { key: "tomorrow", label: "Morgen" },
  { key: "week", label: "Diese Woche" },
  { key: "later", label: "Später" },
  { key: "none", label: "Ohne Frist" },
];

const berlinDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);
const dayLabel = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

function groupOf(due: string | null, now = new Date()): Group {
  if (!due) return "none";
  const today = berlinDay(now);
  const tomorrow = berlinDay(new Date(now.getTime() + 864e5));
  const week = berlinDay(new Date(now.getTime() + 7 * 864e5));
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === tomorrow) return "tomorrow";
  if (due <= week) return "week";
  return "later";
}

/** Aufgaben-Ansicht: alle KI-erkannten und manuellen To-dos der Firma. Alle Änderungen optimistisch. */
export function TasksView({ initial }: { initial: TaskItem[] }) {
  const [tasks, setTasks] = useState(initial);
  const [tab, setTab] = useState<"OPEN" | "DONE">("OPEN");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  /** Lokal ändern, Server aktualisieren, bei Fehler zurücknehmen. */
  async function mutate(change: (t: TaskItem[]) => TaskItem[], request: () => Promise<unknown>, okMessage?: string) {
    const before = tasks;
    setTasks(change);
    try {
      await request();
      if (okMessage) toast.success(okMessage);
    } catch (err) {
      setTasks(before);
      toast.error(`Konnte nicht gespeichert werden: ${(err as Error).message}`);
    }
  }

  const update = (id: string, patch: Partial<TaskItem>, body: Record<string, unknown>) =>
    mutate((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)), () => api(`/api/tasks/${id}`, { method: "PATCH", body }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const tempId = `tmp-${Date.now()}`;
    const item: TaskItem = { id: tempId, title: t, status: "OPEN", source: "MANUAL", dueDate: due || null, dueDateText: null, completedAt: null, email: null };
    setTitle("");
    setDue("");
    setTab("OPEN");
    setTasks((ts) => [item, ...ts]);
    try {
      const r = await api<{ id: string }>("/api/tasks", { body: { title: t, dueDate: due || null } });
      setTasks((ts) => ts.map((x) => (x.id === tempId ? { ...x, id: r.id } : x)));
    } catch (err) {
      setTasks((ts) => ts.filter((x) => x.id !== tempId));
      setTitle(t);
      toast.error((err as Error).message);
    }
    titleRef.current?.focus();
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter(
      (t) => t.status === tab && (!needle || t.title.toLowerCase().includes(needle) || t.email?.subject.toLowerCase().includes(needle) || (t.email?.fromName ?? "").toLowerCase().includes(needle)),
    );
  }, [tasks, tab, q]);

  const openCount = tasks.filter((t) => t.status === "OPEN").length;
  const doneCount = tasks.length - openCount;

  const row = (t: TaskItem) => {
    const g = groupOf(t.dueDate);
    return (
      <li key={t.id} className="group flex items-start gap-3 px-4 py-2.5 hover:bg-accent/40">
        <input
          type="checkbox"
          aria-label={`${t.title} ${t.status === "DONE" ? "wieder öffnen" : "erledigt"}`}
          className="mt-1 size-4 accent-[var(--primary)]"
          checked={t.status === "DONE"}
          onChange={() => {
            const status = t.status === "DONE" ? "OPEN" : "DONE";
            void update(t.id, { status, completedAt: status === "DONE" ? new Date().toISOString() : null }, { status });
          }}
        />
        <div className="min-w-0 flex-1">
          <input
            defaultValue={t.title}
            aria-label="Titel bearbeiten"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== t.title) void update(t.id, { title: v }, { title: v });
              else e.target.value = t.title;
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={cn(
              "w-full rounded bg-transparent px-1 -mx-1 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring/40",
              t.status === "DONE" && "text-muted-foreground line-through",
            )}
          />
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {t.source === "AI" ? (
              <span className="inline-flex items-center gap-0.5" title="Von der KI aus einer E-Mail erkannt">
                <Sparkles className="size-3 text-primary" /> KI
              </span>
            ) : (
              <span>Manuell</span>
            )}
            {t.email && (
              <Link href={`/inbox?view=all&id=${t.email.id}`} className="min-w-0 truncate hover:text-foreground hover:underline">
                {t.email.fromName ?? t.email.fromEmail} · {t.email.subject}
              </Link>
            )}
            {t.dueDateText && <span className="italic">„{t.dueDateText}“</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <label className={cn("relative rounded px-1.5 py-0.5 text-xs tabular-nums", t.status === "OPEN" && g === "overdue" ? "bg-red-500/10 font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            {t.dueDate ? dayLabel.format(new Date(`${t.dueDate}T12:00:00Z`)) : "Frist …"}
            <input
              type="date"
              aria-label="Frist ändern"
              value={t.dueDate ?? ""}
              onChange={(e) => void update(t.id, { dueDate: e.target.value || null, dueDateText: null }, { dueDate: e.target.value || null })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Aufgabe löschen"
            className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={() => void mutate((ts) => ts.filter((x) => x.id !== t.id), () => api(`/api/tasks/${t.id}`, { method: "DELETE" }), "Aufgabe gelöscht")}
          >
            <Trash2 />
          </Button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border bg-card p-2 shadow-xs sm:flex-row sm:items-center">
        <Plus className="ml-2 hidden size-4 text-muted-foreground sm:block" />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neue Aufgabe … (Enter zum Anlegen)"
          aria-label="Neue Aufgabe"
          className="h-9 flex-1 rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <input type="date" aria-label="Frist" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm dark:bg-input/30" />
        <Button type="submit" disabled={!title.trim()}>
          Anlegen
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5 text-sm" role="tablist">
          {(
            [
              ["OPEN", `Offen ${openCount}`],
              ["DONE", `Erledigt ${doneCount}`],
            ] as const
          ).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("rounded px-3 py-1", tab === v ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aufgaben durchsuchen" aria-label="Aufgaben durchsuchen" className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm dark:bg-input/30" />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-14 text-center">
          <span className="mb-3 grid size-10 place-items-center rounded-full bg-muted">
            {tab === "OPEN" ? <CircleCheck className="size-5 text-muted-foreground" /> : <ListTodo className="size-5 text-muted-foreground" />}
          </span>
          <p className="text-sm font-medium">{q ? "Keine Treffer" : tab === "OPEN" ? "Keine offenen Aufgaben" : "Noch nichts erledigt"}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">Aufgaben werden automatisch aus eingehenden E-Mails erkannt – inklusive Fristen. Eigene Aufgaben oben anlegen.</p>
        </div>
      ) : tab === "OPEN" ? (
        GROUPS.map((g) => {
          const list = visible.filter((t) => groupOf(t.dueDate) === g.key).sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
          if (!list.length) return null;
          return (
            <section key={g.key} className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <h2 className={cn("border-b bg-muted/40 px-4 py-2 text-xs font-semibold", g.tone)}>
                {g.label} · {list.length}
              </h2>
              <ul className="divide-y">{list.map(row)}</ul>
            </section>
          );
        })
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <ul className="divide-y">{[...visible].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).map(row)}</ul>
        </section>
      )}
    </div>
  );
}
