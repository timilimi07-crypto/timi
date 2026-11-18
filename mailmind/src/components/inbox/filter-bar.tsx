"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Mail, Newspaper, Search, ShieldAlert, SlidersHorizontal, UserRound, X } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { InboxFilters } from "./data";

export type FilterOptions = {
  categories: { key: string; name: string }[];
  mailboxes: { id: string; name: string }[];
  users: { id: string; name: string }[];
  labels: { id: string; name: string; color: string }[];
  counts: { review: number; phishing: number; bulk: number; unread: number; mine: number };
};

const selectCls =
  "h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30";

function Chip({ active, onClick, children, tone = "default" }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: "default" | "red" | "amber" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors [&_svg]:size-3.5",
        active
          ? tone === "red"
            ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
            : tone === "amber"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              : "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Suche + Filter des Posteingangs. Suche mit 200 ms Verzögerung, damit beim
 * Tippen nicht jeder Buchstabe eine Abfrage auslöst. „/“ fokussiert die Suche.
 */
export function FilterBar({
  filters,
  options,
  onChange,
  searchRef,
}: {
  filters: InboxFilters;
  options: FilterOptions;
  onChange: (patch: Partial<InboxFilters>) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [q, setQ] = useState(filters.q ?? "");
  const [advanced, setAdvanced] = useState(!!(filters.from || filters.after || filters.before || filters.status || filters.mailbox || filters.label || (filters.assignee && filters.assignee !== "me")));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setQ(filters.q ?? ""), [filters.q]);

  function onSearch(v: string) {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ q: v.trim() || undefined }), 200);
  }

  const advancedCount = [filters.from, filters.after, filters.before, filters.status, filters.mailbox, filters.label, filters.assignee && filters.assignee !== "me"].filter(Boolean).length;
  const anyFilter =
    filters.q || filters.category || filters.priority || filters.mailbox || filters.status || filters.review || filters.phishing || filters.unread || filters.bulk || filters.assignee || filters.label || advancedCount;

  return (
    <div className="space-y-2 border-b px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onSearch("");
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Suchen in Betreff, Absender, Text …"
            aria-label="E-Mails durchsuchen"
            className="h-8 w-full rounded-md border bg-background pl-8 pr-8 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
          />
          {q ? (
            <button type="button" onClick={() => onSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Suche leeren">
              <X className="size-3.5" />
            </button>
          ) : (
            <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
          )}
        </div>
        <div className="flex rounded-md border p-0.5 text-xs" role="tablist" aria-label="Ansicht">
          {(
            [
              ["open", "Offen"],
              ["done", "Erledigt"],
              ["all", "Alle"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={filters.view === v && !filters.status}
              onClick={() => onChange({ view: v, status: undefined })}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                filters.view === v && !filters.status ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select aria-label="Kategorie" className={selectCls} value={filters.category ?? ""} onChange={(e) => onChange({ category: e.target.value || undefined })}>
          <option value="">Alle Kategorien</option>
          {options.categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Priorität" className={selectCls} value={filters.priority ?? ""} onChange={(e) => onChange({ priority: (e.target.value || undefined) as InboxFilters["priority"] })}>
          <option value="">Jede Priorität</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
        <select aria-label="Sortierung" className={selectCls} value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as InboxFilters["sort"] })}>
          <option value="newest">Neueste zuerst</option>
          <option value="priority">Wichtigste zuerst</option>
        </select>
        <Chip active={advanced || advancedCount > 0} onClick={() => setAdvanced((a) => !a)}>
          <SlidersHorizontal /> Mehr{advancedCount ? ` (${advancedCount})` : ""}
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={filters.assignee === "me"} onClick={() => onChange({ assignee: filters.assignee === "me" ? undefined : "me" })}>
          <UserRound /> Mir zugewiesen{options.counts.mine ? ` ${options.counts.mine}` : ""}
        </Chip>
        <Chip active={filters.unread} onClick={() => onChange({ unread: !filters.unread })}>
          <Mail /> Ungelesen{options.counts.unread ? ` ${options.counts.unread}` : ""}
        </Chip>
        {(options.counts.review > 0 || filters.review) && (
          <Chip tone="amber" active={filters.review} onClick={() => onChange({ review: !filters.review })}>
            <AlertTriangle /> Bitte prüfen {options.counts.review}
          </Chip>
        )}
        {(options.counts.phishing > 0 || filters.phishing) && (
          <Chip tone="red" active={filters.phishing} onClick={() => onChange({ phishing: !filters.phishing })}>
            <ShieldAlert /> Phishing-Verdacht {options.counts.phishing}
          </Chip>
        )}
        {(options.counts.bulk > 0 || filters.bulk) && (
          <Chip active={filters.bulk === "only"} onClick={() => onChange({ bulk: filters.bulk === "only" ? undefined : "only" })}>
            <Newspaper /> Newsletter &amp; Spam {options.counts.bulk}
          </Chip>
        )}
        {anyFilter ? (
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setQ("");
              onChange({ q: undefined, category: undefined, priority: undefined, mailbox: undefined, status: undefined, review: false, phishing: false, unread: false, bulk: undefined, from: undefined, after: undefined, before: undefined, assignee: undefined, label: undefined });
            }}
          >
            Filter zurücksetzen
          </button>
        ) : null}
      </div>

      {advanced && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <select aria-label="Status" className={selectCls} value={filters.status ?? ""} onChange={(e) => onChange({ status: (e.target.value || undefined) as InboxFilters["status"] })}>
            <option value="">Jeder Status</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {options.mailboxes.length > 1 && (
            <select aria-label="Postfach" className={selectCls} value={filters.mailbox ?? ""} onChange={(e) => onChange({ mailbox: e.target.value || undefined })}>
              <option value="">Alle Postfächer</option>
              {options.mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Bearbeiter" className={selectCls} value={filters.assignee ?? ""} onChange={(e) => onChange({ assignee: e.target.value || undefined })}>
            <option value="">Alle Bearbeiter</option>
            <option value="me">Mir zugewiesen</option>
            <option value="none">Nicht zugewiesen</option>
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {options.labels.length > 0 && (
            <select aria-label="Label" className={selectCls} value={filters.label ?? ""} onChange={(e) => onChange({ label: e.target.value || undefined })}>
              <option value="">Alle Labels</option>
              {options.labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label="Absender"
            placeholder="Absender enthält …"
            defaultValue={filters.from ?? ""}
            onBlur={(e) => onChange({ from: e.target.value.trim() || undefined })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={cn(selectCls, "w-44 px-2")}
          />
          <label className="flex items-center gap-1">
            von
            <input type="date" aria-label="Datum von" className={selectCls} value={filters.after ?? ""} onChange={(e) => onChange({ after: e.target.value || undefined })} />
          </label>
          <label className="flex items-center gap-1">
            bis
            <input type="date" aria-label="Datum bis" className={selectCls} value={filters.before ?? ""} onChange={(e) => onChange({ before: e.target.value || undefined })} />
          </label>
        </div>
      )}
    </div>
  );
}
