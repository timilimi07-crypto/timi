/** Kleiner fetch-Wrapper für Client-Komponenten: wirft mit der deutschen Fehlermeldung der API. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Fehler ${res.status}`);
  return data as T;
}

export type SyncResponse =
  | { mode: "queued"; count: number }
  | { mode: "inline"; results: { status: string; created: number; remaining: number; error?: string }[] };

/** Nutzerfreundliche Zusammenfassung eines Abrufs für Toasts. */
export function describeSync(r: SyncResponse): { ok: boolean; message: string } {
  if (r.mode === "queued") return { ok: true, message: "Abruf gestartet – neue E-Mails erscheinen in Kürze." };
  const errors = r.results.filter((x) => x.status === "error");
  const created = r.results.reduce((s, x) => s + x.created, 0);
  const remaining = r.results.reduce((s, x) => s + x.remaining, 0);
  if (errors.length) return { ok: false, message: errors[0]!.error ?? "Abruf fehlgeschlagen" };
  const base = created === 0 ? "Keine neuen E-Mails." : created === 1 ? "1 neue E-Mail abgerufen." : `${created} neue E-Mails abgerufen.`;
  return { ok: true, message: remaining > 0 ? `${base} ${remaining} weitere werden beim nächsten Abruf geladen.` : base };
}
