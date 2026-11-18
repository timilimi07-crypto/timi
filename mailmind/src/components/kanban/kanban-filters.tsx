"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/labels";

const selectCls =
  "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30";

/** Filter für das Kanban-Board (Kategorie, Priorität, Newsletter). Ändern lädt das Board neu. */
export function KanbanFilters({ categories }: { categories: { key: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string | null) {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select aria-label="Kategorie" className={selectCls} value={params.get("category") ?? ""} onChange={(e) => set("category", e.target.value || null)}>
        <option value="">Alle Kategorien</option>
        {categories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
      <select aria-label="Priorität" className={selectCls} value={params.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value || null)}>
        <option value="">Jede Priorität</option>
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
      <select aria-label="Sortierung" className={selectCls} value={params.get("sort") ?? "newest"} onChange={(e) => set("sort", e.target.value === "newest" ? null : e.target.value)}>
        <option value="newest">Neueste zuerst</option>
        <option value="priority">Wichtigste zuerst</option>
      </select>
      <select aria-label="Bearbeiter" className={selectCls} value={params.get("assignee") ?? ""} onChange={(e) => set("assignee", e.target.value || null)}>
        <option value="">Alle Bearbeiter</option>
        <option value="me">Mir zugewiesen</option>
        <option value="none">Nicht zugewiesen</option>
      </select>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" className="accent-[var(--primary)]" checked={params.get("bulk") === "show"} onChange={(e) => set("bulk", e.target.checked ? "show" : null)} />
        Newsletter &amp; Spam zeigen
      </label>
    </div>
  );
}
