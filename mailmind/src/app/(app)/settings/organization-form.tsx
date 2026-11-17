"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type OrgSettings = {
  syncIntervalMinutes: number;
  initialSyncDays: number;
  maxEmailsPerSync: number;
  aiModel: string | null;
  aiModelFast: string | null;
};

type ModelOption = { id: string; label: string; description: string; price: string };

const INTERVALS = [1, 5, 10, 15, 30, 60];
const WINDOWS = [7, 14, 30, 60, 90, 180, 365];

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-6">
      <div>
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

function ModelPicker({
  name,
  value,
  options,
  defaultId,
  disabled,
  onChange,
}: {
  name: string;
  value: string | null;
  options: ModelOption[];
  defaultId: string;
  disabled: boolean;
  onChange: (v: string | null) => void;
}) {
  const current = value ?? defaultId;
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2">
      {options.map((o) => (
        <label
          key={o.id}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
            current === o.id && "border-primary/60 bg-primary/5",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          <input
            type="radio"
            name={name}
            className="mt-0.5 accent-[var(--primary)]"
            checked={current === o.id}
            disabled={disabled}
            onChange={() => onChange(o.id === defaultId ? null : o.id)}
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {o.label}
              {o.id === defaultId && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Standard</span>}
            </span>
            <span className="block text-xs text-muted-foreground">{o.description}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{o.price}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Firmeneinstellungen: Abruf-Limits und KI-Modelle. Nur Admins dürfen speichern. */
export function OrganizationForm({
  initial,
  canEdit,
  mainOptions,
  fastOptions,
  defaults,
}: {
  initial: OrgSettings;
  canEdit: boolean;
  mainOptions: ModelOption[];
  fastOptions: ModelOption[];
  defaults: { main: string; fast: string };
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const set = <K extends keyof OrgSettings>(k: K, v: OrgSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/organization", { method: "PATCH", body: s });
      toast.success("Einstellungen gespeichert");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <section className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold">E-Mail-Abruf</h3>
          <p className="text-xs text-muted-foreground">
            Begrenzt, wie viele E-Mails abgerufen und damit von der KI verarbeitet werden.
          </p>
        </div>
        <Field htmlFor="interval" label="Abrufintervall" hint="Wie oft alle Postfächer automatisch abgerufen werden.">
          <NativeSelect id="interval" value={s.syncIntervalMinutes} disabled={!canEdit} onChange={(e) => set("syncIntervalMinutes", Number(e.target.value))}>
            {INTERVALS.map((m) => (
              <option key={m} value={m}>
                alle {m} {m === 1 ? "Minute" : "Minuten"}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          htmlFor="window"
          label="Zeitraum beim ersten Abruf"
          hint="Ältere E-Mails werden beim Verbinden eines neuen Postfachs nicht abgerufen. Gilt für neu verbundene Postfächer."
        >
          <NativeSelect id="window" value={s.initialSyncDays} disabled={!canEdit} onChange={(e) => set("initialSyncDays", Number(e.target.value))}>
            {WINDOWS.map((d) => (
              <option key={d} value={d}>
                letzte {d} Tage
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          htmlFor="limit"
          label="Max. E-Mails pro Abruf"
          hint="Pro Postfach und Durchlauf. Der Rest wird in den nächsten Durchläufen nachgeladen (neueste zuerst)."
        >
          <Input
            id="limit"
            type="number"
            min={10}
            max={1000}
            step={10}
            value={s.maxEmailsPerSync}
            disabled={!canEdit}
            onChange={(e) => set("maxEmailsPerSync", Number(e.target.value))}
          />
        </Field>
      </section>

      <section className="space-y-5 border-t pt-6">
        <div>
          <h3 className="text-sm font-semibold">KI-Modelle</h3>
          <p className="text-xs text-muted-foreground">
            Einfache Aufgaben (Spam/Newsletter erkennen, Kategorie) laufen auf dem schnellen Modell, alles andere auf dem Hauptmodell.
          </p>
        </div>
        <Field htmlFor="main" label="Hauptmodell" hint="Zusammenfassung, Priorität, Aufgaben, erkannte Daten, Antwortvorschläge.">
          <ModelPicker name="main" value={s.aiModel} options={mainOptions} defaultId={defaults.main} disabled={!canEdit} onChange={(v) => set("aiModel", v)} />
        </Field>
        <Field htmlFor="fast" label="Schnelles Modell" hint="Spam- und Newsletter-Erkennung, Kategorisierung.">
          <ModelPicker name="fast" value={s.aiModelFast} options={fastOptions} defaultId={defaults.fast} disabled={!canEdit} onChange={(v) => set("aiModelFast", v)} />
        </Field>
      </section>

      {canEdit ? (
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => setS(initial)}>
            Zurücksetzen
          </Button>
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            Speichern
          </Button>
        </div>
      ) : (
        <p className="border-t pt-4 text-xs text-muted-foreground">Nur Admins können diese Einstellungen ändern.</p>
      )}
    </form>
  );
}
