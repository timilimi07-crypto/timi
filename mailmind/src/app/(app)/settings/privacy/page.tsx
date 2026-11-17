import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Datenschutz" };

/** Datenschutz-Einstellungen – Bearbeitung und Löschfunktion folgen in Phase 7. */
export default async function PrivacyPage() {
  const session = await requirePermission("settings.manage");
  const org = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datenschutz (DSGVO)</CardTitle>
        <CardDescription>Aufbewahrung, Maskierung und Verschlüsselung.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="text-muted-foreground">Aufbewahrungsdauer: </span>
          <span className="font-medium">{org.retentionDays ? `${org.retentionDays} Tage` : "unbegrenzt"}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Sensible Daten vor KI-Aufruf maskieren: </span>
          <span className="font-medium">{org.maskSensitiveData ? "aktiv" : "inaktiv"}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Postfach-Zugangsdaten: </span>
          <span className="font-medium">AES-256-GCM verschlüsselt</span>
        </p>
      </CardContent>
    </Card>
  );
}
