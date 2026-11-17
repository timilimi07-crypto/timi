import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Einstellungen" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function GeneralSettingsPage() {
  const session = await requireSession();
  const org = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firma</CardTitle>
        <CardDescription>Grundeinstellungen für alle Nutzer dieser Firma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Row label="Name" value={org.name} />
        <Row label="Kennung" value={<code className="font-mono text-xs">{org.slug}</code>} />
        <Row label="Abrufintervall" value={`alle ${org.syncIntervalMinutes} Minuten`} />
        <Row label="KI-Modell" value={org.aiModel ?? `Standard (${process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"})`} />
        <Row label="Tages-Digest" value={org.digestEnabled ? `aktiv, ${org.digestHour}:00 Uhr` : "deaktiviert"} />
      </CardContent>
    </Card>
  );
}
