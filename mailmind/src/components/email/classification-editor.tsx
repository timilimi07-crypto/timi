"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { PRIORITY_META, PRIORITY_ORDER, type PriorityKey } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Option = { key: string; name: string };

const selectCls =
  "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30";

/**
 * Kategorie und Priorität einer E-Mail ändern. Jede Änderung wird als
 * Korrektur gespeichert und hilft der KI, künftig besser zu sortieren.
 */
export function ClassificationEditor({
  emailId,
  categoryKey,
  priority,
  categories,
  className,
}: {
  emailId: string;
  categoryKey: string | null;
  priority: PriorityKey | null;
  categories: Option[];
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(body: { categoryKey?: string; priority?: string }) {
    setBusy(true);
    try {
      const r = await api<{ correctionsSaved: number }>(`/api/emails/${emailId}`, { method: "PATCH", body });
      toast.success(r.correctionsSaved ? "Gespeichert – die KI lernt aus dieser Korrektur." : "Gespeichert");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <select aria-label="Kategorie ändern" className={selectCls} value={categoryKey ?? ""} disabled={busy} onChange={(e) => update({ categoryKey: e.target.value })}>
        {!categoryKey && <option value="">Kategorie …</option>}
        {categories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
      <select aria-label="Priorität ändern" className={selectCls} value={priority ?? ""} disabled={busy} onChange={(e) => update({ priority: e.target.value })}>
        {!priority && <option value="">Priorität …</option>}
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    </div>
  );
}
