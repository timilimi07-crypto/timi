"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ACCOUNTS = [
  { email: "admin@mueller-partner.de", label: "Admin" },
  { email: "manager@mueller-partner.de", label: "Manager" },
  { email: "mitarbeiter@mueller-partner.de", label: "Mitarbeiter" },
];

export function LoginForm({ callbackUrl, demo }: { callbackUrl?: string; demo: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("E-Mail oder Passwort ist falsch.");
      return;
    }
    toast.success("Erfolgreich angemeldet");
    // Nur relative Pfade zulassen (kein Open Redirect).
    const target = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard";
    router.replace(target);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@firma.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading || !email || !password}>
          {loading && <LoaderCircle className="animate-spin" />}
          Anmelden
        </Button>
      </form>

      {demo && (
        <div className="mt-8 rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-medium">Demo-Modus</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Passwort für alle Demo-Konten: <code className="font-mono text-foreground">mailmind</code>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <Button
                key={a.email}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(a.email);
                  setPassword("mailmind");
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
