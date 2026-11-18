"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

/** Digest-Einstellung der Person + Testversand. */
export function DigestControls({ optIn, smtpConfigured, orgEnabled }: { optIn: boolean; smtpConfigured: boolean; orgEnabled: boolean }) {
  const [on, setOn] = useState(optIn);
  const [sending, setSending] = useState(false);

  async function toggle(v: boolean) {
    setOn(v);
    try {
      await api("/api/me", { method: "PATCH", body: { digestOptIn: v } });
      toast.success(v ? "Tages-Digest aktiviert" : "Tages-Digest abbestellt");
    } catch (err) {
      setOn(!v);
      toast.error((err as Error).message);
    }
  }

  async function test() {
    setSending(true);
    try {
      const r = await api<{ subject: string }>("/api/digest/test", { method: "POST" });
      toast.success(`Test-Digest verschickt: „${r.subject}“`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[var(--primary)]" checked={on} onChange={(e) => toggle(e.target.checked)} />
        Tages-Digest per E-Mail erhalten
      </label>
      {!orgEnabled && <p className="text-xs text-amber-700 dark:text-amber-300">Der Digest ist für die Firma derzeit ausgeschaltet (Einstellungen → Allgemein).</p>}
      {!smtpConfigured && (
        <p className="text-xs text-muted-foreground">
          Kein Mailserver eingerichtet (<code className="font-mono">SMTP_URL</code>) – der Digest wird nicht verschickt. Die Vorschau unten zeigt den Inhalt.
        </p>
      )}
      <Button variant="outline" size="sm" onClick={test} disabled={sending || !smtpConfigured}>
        {sending ? <LoaderCircle className="animate-spin" /> : <Send />} Test-Digest an mich senden
      </Button>
    </div>
  );
}
