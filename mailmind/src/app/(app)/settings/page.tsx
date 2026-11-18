import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_FAST_MODEL, DEFAULT_MAIN_MODEL, modelsForTier, type ModelInfo } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireSession } from "@/server/session";
import { describeAiProvider } from "@/server/ai/provider";
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
        {(() => {
          const ai = describeAiProvider();
          return (
            <div className="mb-6 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <span className="font-medium">Aktiver KI-Anbieter: {ai.label}</span>
              <span className="text-muted-foreground"> · {ai.detail}</span>
              {ai.provider === "ollama" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Lokaler Testbetrieb über <code className="font-mono">AI_PROVIDER=ollama</code>. Die Modellwahl unten gilt für Claude (Standard im
                  echten Betrieb); lokale Modelle werden über <code className="font-mono">OLLAMA_MODEL</code> in der .env gewählt.
                </p>
              )}
              {ai.provider === "anthropic" && !ai.configured && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Kein <code className="font-mono">ANTHROPIC_API_KEY</code> hinterlegt – die KI-Auswertung ist pausiert. Zum lokalen Testen ohne
                  Schlüssel: <code className="font-mono">AI_PROVIDER=ollama</code>.
                </p>
              )}
            </div>
          );
        })()}
        <OrganizationForm
          canEdit={can(session.role, "settings.manage")}
          initial={{
            syncIntervalMinutes: org.syncIntervalMinutes,
            initialSyncDays: org.initialSyncDays,
            maxEmailsPerSync: org.maxEmailsPerSync,
            aiDailyEmailLimit: org.aiDailyEmailLimit,
            digestEnabled: org.digestEnabled,
            digestHour: org.digestHour,
            digestWeekdaysOnly: org.digestWeekdaysOnly,
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
