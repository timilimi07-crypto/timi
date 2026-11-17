"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, describeSync, type SyncResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Manueller Abruf aller Postfächer der Firma. */
export function SyncButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const r = await api<SyncResponse>("/api/sync", { method: "POST" });
      const d = describeSync(r);
      (d.ok ? toast.success : toast.error)(d.message);
      router.refresh();
      // Im Worker-Modus nach kurzer Zeit erneut laden, damit neue E-Mails erscheinen.
      if (r.mode === "queued") setTimeout(() => router.refresh(), 4000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={sync} disabled={busy} className={className}>
      <RefreshCw className={cn(busy && "animate-spin")} />
      {busy ? "Wird abgerufen …" : "Abrufen"}
    </Button>
  );
}
