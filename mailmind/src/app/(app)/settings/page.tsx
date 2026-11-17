import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_FAST_MODEL, DEFAULT_MAIN_MODEL, modelsForTier, type ModelInfo } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireSession } from "@/server/session";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Einstellungen" };

const price = (m: ModelInfo) =>
  `${m.pricing.input.toLocaleString("de-DE")} $ / ${m.pricing.output.toLocaleString("de-DE")} $ pro 1 Mio. Token (Ein-/Ausgabe)`;

export default async function GeneralSettingsPage() {
  const session = await requireSession();
  const org = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } });
  const toOption = (m: ModelInfo) => ({ id: m.id, label: m.label, description: m.description, price: price(m) });
  // Standard laut .env (fällt bei ungültigem Wert auf Sonnet/Haiku zurück).
  const envMain = modelsForTier("main").some((m) => m.id === process.env.ANTHROPIC_MODEL) ? process.env.ANTHROPIC_MODEL! : DEFAULT_MAIN_MODEL;
  const envFast = modelsForTier("fast").some((m) => m.id === process.env.ANTHROPIC_MODEL_FAST) ? process.env.ANTHROPIC_MODEL_FAST! : DEFAULT_FAST_MODEL;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{org.name}</CardTitle>
        <CardDescription>Gilt für alle Nutzer und Postfächer dieser Firma.</CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationForm
          canEdit={can(session.role, "settings.manage")}
          initial={{
            syncIntervalMinutes: org.syncIntervalMinutes,
            initialSyncDays: org.initialSyncDays,
            maxEmailsPerSync: org.maxEmailsPerSync,
            aiModel: org.aiModel,
            aiModelFast: org.aiModelFast,
          }}
          mainOptions={modelsForTier("main").map(toOption)}
          fastOptions={modelsForTier("fast").map(toOption)}
          defaults={{ main: envMain, fast: envFast }}
        />
      </CardContent>
    </Card>
  );
}
