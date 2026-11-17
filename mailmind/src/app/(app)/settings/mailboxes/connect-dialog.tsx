"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, Plus, Server } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, describeSync, type SyncResponse } from "@/lib/api-client";

type Step = "choose" | "imap";
const WINDOWS = [7, 14, 30, 60, 90, 180, 365];

/** Bekannte IMAP-Server zum schnellen Ausfüllen. */
const PRESETS: Record<string, { host: string; port: number }> = {
  "IONOS": { host: "imap.ionos.de", port: 993 },
  "Strato": { host: "imap.strato.de", port: 993 },
  "GMX": { host: "imap.gmx.net", port: 993 },
  "WEB.DE": { host: "imap.web.de", port: 993 },
  "T-Online": { host: "secureimap.t-online.de", port: 993 },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.7 2.8C6.8 7.3 9.2 5.4 12 5.4Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export function ConnectMailboxDialog({ defaultDays, oauth }: { defaultDays: number; oauth: { google: boolean; microsoft: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [days, setDays] = useState(defaultDays);
  const [name, setName] = useState("");
  const [form, setForm] = useState({ emailAddress: "", host: "", port: 993, secure: true, username: "", password: "", folder: "INBOX" });
  const [busy, setBusy] = useState<null | "test" | "save">(null);
  const [tested, setTested] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTested(null);
  };
  const body = () => ({ ...form, name: name || form.emailAddress, username: form.username || form.emailAddress, initialSyncDays: days });

  function reset() {
    setStep("choose");
    setError(null);
    setTested(null);
    setBusy(null);
  }

  async function test() {
    setBusy("test");
    setError(null);
    try {
      const r = await api<{ messagesInWindow: number }>("/api/mailboxes/test", { body: body() });
      setTested(r.messagesInWindow);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const r = await api<{ sync: SyncResponse }>("/api/mailboxes", { body: body() });
      toast.success(`Postfach verbunden. ${describeSync(r.sync).message}`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const oauthHref = (provider: "google" | "microsoft") =>
    `/api/mailboxes/oauth/${provider}/start?days=${days}&name=${encodeURIComponent(name)}`;

  const windowField = (
    <div className="space-y-2">
      <Label htmlFor="mb-days">Zeitraum beim ersten Abruf</Label>
      <NativeSelect id="mb-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
        {WINDOWS.map((d) => (
          <option key={d} value={d}>
            letzte {d} Tage
          </option>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">Ältere E-Mails werden nicht abgerufen und nicht von der KI verarbeitet.</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Postfach verbinden
        </Button>
      </DialogTrigger>
      <DialogContent className="top-[8vh] max-h-[84vh] max-w-lg overflow-y-auto p-6">
        {step === "choose" ? (
          <>
            <DialogTitle className="text-base font-semibold">Postfach verbinden</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              MailMind liest E-Mails nur – es werden keine E-Mails verschickt oder im Postfach verändert.
            </DialogDescription>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mb-name">Anzeigename (optional)</Label>
                <Input id="mb-name" placeholder="z. B. Vertrieb" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {windowField}
              <div className="grid gap-2 pt-1">
                {(
                  [
                    { key: "google", label: "Gmail / Google Workspace", icon: <GoogleIcon />, ok: oauth.google },
                    { key: "microsoft", label: "Microsoft 365 / Outlook / Exchange Online", icon: <MicrosoftIcon />, ok: oauth.microsoft },
                  ] as const
                ).map((p) =>
                  p.ok ? (
                    <Button key={p.key} variant="outline" className="h-11 justify-start" asChild>
                      <a href={oauthHref(p.key)}>
                        {p.icon} {p.label}
                      </a>
                    </Button>
                  ) : (
                    <div key={p.key} className="flex h-11 items-center gap-2 rounded-md border border-dashed px-4 text-sm text-muted-foreground">
                      {p.icon}
                      <span className="flex-1">{p.label}</span>
                      <span className="text-[11px]">nicht konfiguriert</span>
                    </div>
                  ),
                )}
                <Button variant="outline" className="h-11 justify-start" onClick={() => setStep("imap")}>
                  <Server className="text-muted-foreground" /> Anderer Anbieter (IMAP)
                </Button>
              </div>
              {(!oauth.google || !oauth.microsoft) && (
                <p className="text-xs text-muted-foreground">
                  Für Gmail/Outlook müssen Client-ID und Secret in der .env hinterlegt sein (siehe README).
                </p>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setStep("choose")} aria-label="Zurück">
                <ArrowLeft />
              </Button>
              <DialogTitle className="text-base font-semibold">IMAP-Postfach</DialogTitle>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRESETS).map(([label, p]) => (
                <Button key={label} type="button" variant="secondary" size="sm" onClick={() => { set("host", p.host); set("port", p.port); set("secure", true); }}>
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="imap-email">E-Mail-Adresse</Label>
                <Input id="imap-email" type="email" required value={form.emailAddress} onChange={(e) => set("emailAddress", e.target.value)} placeholder="info@firma.de" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-host">IMAP-Server</Label>
                <Input id="imap-host" required value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="imap.firma.de" />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-2">
                  <Label htmlFor="imap-port">Port</Label>
                  <Input id="imap-port" type="number" required value={form.port} onChange={(e) => set("port", Number(e.target.value))} />
                </div>
                <label className="flex items-end gap-1.5 pb-2 text-sm">
                  <input type="checkbox" checked={form.secure} onChange={(e) => set("secure", e.target.checked)} className="accent-[var(--primary)]" />
                  SSL/TLS
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-user">Benutzername</Label>
                <Input id="imap-user" value={form.username} onChange={(e) => set("username", e.target.value)} placeholder={form.emailAddress || "meist die E-Mail-Adresse"} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-pass">Passwort</Label>
                <Input id="imap-pass" type="password" required value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-folder">Ordner</Label>
                <Input id="imap-folder" value={form.folder} onChange={(e) => set("folder", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-name">Anzeigename</Label>
                <Input id="imap-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
              </div>
            </div>
            {windowField}
            <p className="text-xs text-muted-foreground">Das Passwort wird AES-256-verschlüsselt gespeichert. Tipp: Nutze ein App-Passwort, falls dein Anbieter das anbietet.</p>

            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {tested !== null && (
              <p className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> Verbindung erfolgreich – {tested.toLocaleString("de-DE")} E-Mails im gewählten Zeitraum.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={test} disabled={!!busy || !form.host || !form.password || !form.emailAddress}>
                {busy === "test" && <LoaderCircle className="animate-spin" />}
                Verbindung testen
              </Button>
              <Button type="submit" disabled={!!busy}>
                {busy === "save" && <LoaderCircle className="animate-spin" />}
                Verbinden
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
