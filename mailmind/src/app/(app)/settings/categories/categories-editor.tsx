"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { COLOR_CLASSES, colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";

export type CategoryRow = { id: string; key: string; name: string; description: string; color: string; autoCollapse: boolean; isSystem: boolean; emailCount: number };
export type LabelRow = { id: string; name: string; color: string; emailCount: number };

const COLORS = Object.keys(COLOR_CLASSES);

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Farbe">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-background", value === c && "ring-2 ring-ring")}
        >
          <span className={cn("size-4 rounded-full", colorClasses(c).dot)} />
        </button>
      ))}
    </div>
  );
}

function CategoryItem({ c, canEdit, onChanged }: { c: CategoryRow; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c);
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<CategoryRow>) {
    setBusy(true);
    try {
      await api(`/api/categories/${c.id}`, { method: "PATCH", body: patch });
      toast.success("Kategorie gespeichert");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Kategorie „${c.name}“ löschen? ${c.emailCount} E-Mails verlieren diese Kategorie.`)) return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      toast.success("Kategorie gelöscht");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="sm:w-56" />
          <Input aria-label="Beschreibung für die KI" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Wann gehört eine E-Mail in diese Kategorie?" />
        </div>
        <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setDraft(c); setEditing(false); }}>
            <X /> Abbrechen
          </Button>
          <Button size="sm" disabled={busy || !draft.name.trim()} onClick={() => save({ name: draft.name, description: draft.description, color: draft.color })}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />} Speichern
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", colorClasses(c.color).dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {c.name}
          <code className="font-mono text-[11px] font-normal text-muted-foreground">{c.key}</code>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{c.description || "Keine Beschreibung – die KI orientiert sich dann nur am Namen."}</p>
        <label className="mt-1.5 flex w-fit items-center gap-1.5 text-xs">
          <input type="checkbox" className="accent-[var(--primary)]" disabled={!canEdit || busy} checked={c.autoCollapse} onChange={(e) => save({ autoCollapse: e.target.checked })} />
          Automatisch einklappen (wie Newsletter &amp; Spam)
        </label>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{c.emailCount} E-Mails</span>
      {canEdit && (
        <div className="flex">
          <Button variant="ghost" size="icon-sm" aria-label={`${c.name} bearbeiten`} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          {!c.isSystem && (
            <Button variant="ghost" size="icon-sm" aria-label={`${c.name} löschen`} onClick={remove}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Kategorien (fließen in den KI-Prompt ein) und Labels (frei, für Regeln und manuelle Markierung). */
export function CategoriesEditor({ categories, labels, canEdit }: { categories: CategoryRow[]; labels: LabelRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [newCat, setNewCat] = useState({ name: "", description: "", color: "blue" });
  const [newLabel, setNewLabel] = useState({ name: "", color: "violet" });
  const [busy, setBusy] = useState<null | "cat" | "label">(null);
  const refresh = () => router.refresh();

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy("cat");
    try {
      await api("/api/categories", { body: newCat });
      toast.success("Kategorie angelegt – die KI berücksichtigt sie ab der nächsten E-Mail");
      setNewCat({ name: "", description: "", color: "blue" });
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function addLabel(e: React.FormEvent) {
    e.preventDefault();
    setBusy("label");
    try {
      await api("/api/labels", { body: newLabel });
      toast.success("Label angelegt");
      setNewLabel({ name: "", color: "violet" });
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function removeLabel(l: LabelRow) {
    if (!confirm(`Label „${l.name}“ löschen? Es wird von ${l.emailCount} E-Mails entfernt.`)) return;
    try {
      await api(`/api/labels/${l.id}`, { method: "DELETE" });
      toast.success("Label gelöscht");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Kategorien</h2>
          <p className="text-xs text-muted-foreground">Die KI ordnet jede E-Mail genau einer Kategorie zu. Die Beschreibung hilft ihr bei der Entscheidung.</p>
        </div>
        <Card className="divide-y">
          {categories.map((c) => (
            <CategoryItem key={c.id} c={c} canEdit={canEdit} onChanged={refresh} />
          ))}
        </Card>
        {canEdit && (
          <form onSubmit={addCategory} className="space-y-2 rounded-xl border border-dashed p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Name der neuen Kategorie" placeholder="Neue Kategorie, z. B. Behörde" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} className="sm:w-56" />
              <Input aria-label="Beschreibung der neuen Kategorie" placeholder="Beschreibung für die KI, z. B. Post von Ämtern, Finanzamt, Berufsgenossenschaft" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ColorPicker value={newCat.color} onChange={(color) => setNewCat({ ...newCat, color })} />
              <Button type="submit" size="sm" disabled={!newCat.name.trim() || busy === "cat"}>
                {busy === "cat" ? <LoaderCircle className="animate-spin" /> : <Plus />} Kategorie anlegen
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Labels</h2>
          <p className="text-xs text-muted-foreground">Freie Markierungen – mehrere pro E-Mail möglich, von Hand oder per Regel. Erscheinen in der Seitenleiste.</p>
        </div>
        <Card className="divide-y">
          {labels.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Labels.</p>}
          {labels.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <Tag className={cn("size-4", colorClasses(l.color).badge.split(" ").find((x) => x.startsWith("text-")))} />
              <span className="flex-1 text-sm">{l.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{l.emailCount} E-Mails</span>
              {canEdit && (
                <Button variant="ghost" size="icon-sm" aria-label={`Label ${l.name} löschen`} onClick={() => removeLabel(l)}>
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </Card>
        {canEdit && (
          <form onSubmit={addLabel} className="flex flex-col gap-2 rounded-xl border border-dashed p-3 sm:flex-row sm:items-center">
            <Input aria-label="Name des neuen Labels" placeholder="Neues Label, z. B. Rückruf" value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} className="sm:w-56" />
            <ColorPicker value={newLabel.color} onChange={(color) => setNewLabel({ ...newLabel, color })} />
            <Button type="submit" size="sm" className="sm:ml-auto" disabled={!newLabel.name.trim() || busy === "label"}>
              {busy === "label" ? <LoaderCircle className="animate-spin" /> : <Plus />} Label anlegen
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
