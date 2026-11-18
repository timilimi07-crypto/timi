"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { DeadlineTask } from "@/server/queries/dashboard";

const BUCKETS: { key: DeadlineTask["bucket"]; label: string; tone: string }[] = [
  { key: "overdue", label: "Überfällig", tone: "text-red-600 dark:text-red-400" },
  { key: "today", label: "Heute", tone: "text-foreground" },
  { key: "tomorrow", label: "Morgen", tone: "text-foreground" },
  { key: "week", label: "Nächste 7 Tage", tone: "text-muted-foreground" },
];
const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** Fristen-Karte: Aufgaben sofort abhaken (optimistisch, mit Rücknahme bei Fehler). */
export function DeadlinesCard({ tasks }: { tasks: DeadlineTask[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());

  async function toggle(id: string) {
    const isDone = done.has(id);
    setDone((s) => {
      const n = new Set(s);
      if (isDone) n.delete(id);
      else n.add(id);
      return n;
    });
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", body: { status: isDone ? "OPEN" : "DONE" } });
    } catch (err) {
      setDone((s) => {
        const n = new Set(s);
        if (isDone) n.add(id);
        else n.delete(id);
        return n;
      });
      toast.error((err as Error).message);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
        <CalendarClock className="mb-2 size-5" />
        Keine Fristen in den nächsten 7 Tagen.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {BUCKETS.map((b) => {
        const list = tasks.filter((t) => t.bucket === b.key);
        if (!list.length) return null;
        return (
          <div key={b.key}>
            <h3 className={cn("mb-1 text-xs font-medium", b.tone)}>
              {b.label} · {list.length}
            </h3>
            <ul className="space-y-0.5">
              {list.map((t) => (
                <li key={t.id} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
                  <input
                    type="checkbox"
                    aria-label={`${t.title} erledigt`}
                    className="mt-0.5 accent-[var(--primary)]"
                    checked={done.has(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm leading-snug", done.has(t.id) && "text-muted-foreground line-through")}>{t.title}</div>
                    {t.email && (
                      <Link href={`/inbox?view=all&id=${t.email.id}`} className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
                        {t.email.fromName ?? t.email.fromEmail} · {t.email.subject}
                      </Link>
                    )}
                  </div>
                  <span className={cn("shrink-0 text-[11px] tabular-nums", b.key === "overdue" ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    {dayFmt.format(new Date(t.dueDate))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <Link href="/tasks" className="block text-xs text-muted-foreground hover:text-foreground hover:underline">
        Alle Aufgaben →
      </Link>
    </div>
  );
}
