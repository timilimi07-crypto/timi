import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, ListChecks, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { getAppSession } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

const FEATURES = [
  { icon: Sparkles, title: "KI-Zusammenfassungen", text: "Jede E-Mail in 1–3 Sätzen – mit Priorität und Begründung." },
  { icon: ListChecks, title: "Aufgaben & Fristen", text: "To-dos werden automatisch erkannt und übersichtlich gesammelt." },
  { icon: ShieldCheck, title: "DSGVO-konform", text: "Verschlüsselte Zugangsdaten, Audit-Log, Maskierung sensibler Daten." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  if (await getAppSession()) redirect("/dashboard");
  const { callbackUrl } = await searchParams;
  const demo = process.env.DEMO_MODE === "true";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col p-6 sm:p-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Melde dich an, um deine E-Mail-Zentrale zu öffnen.</p>
          <LoginForm callbackUrl={callbackUrl} demo={demo} />
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} MailMind</p>
      </div>

      <div className="relative hidden overflow-hidden border-l bg-sidebar lg:flex lg:flex-col lg:justify-center lg:p-16">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_60%)]"
        />
        <div className="relative max-w-md">
          <p className="text-sm font-medium text-primary">Morgens in 2 Minuten informiert</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">
            Was ist wichtig, was muss heute erledigt werden – und was kann warten?
          </h2>
          <ul className="mt-10 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background shadow-xs">
                  <f.icon className="size-4 text-primary" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{f.title}</span>
                  <span className="block text-sm text-muted-foreground">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
