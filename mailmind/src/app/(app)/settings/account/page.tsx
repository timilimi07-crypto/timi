import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { collectDigest, isDigestEmpty, renderDigest } from "@/server/digest/build";
import { getTransport } from "@/server/digest/send";
import { requireSession } from "@/server/session";
import { DigestControls } from "./account-client";

export const metadata: Metadata = { title: "Mein Konto" };

/** Eigene Einstellungen: Tages-Digest (an/aus, Vorschau, Testversand). */
export default async function AccountPage() {
  const session = await requireSession();
  const [user, org, data] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { digestOptIn: true } }),
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { digestEnabled: true, digestHour: true, digestWeekdaysOnly: true } }),
    collectDigest(session.userId),
  ]);
  const digest = renderDigest(data);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{session.name}</CardTitle>
          <CardDescription>
            {session.email} · {ROLE_LABELS[session.role]}
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tages-Digest</CardTitle>
          <CardDescription>
            {org.digestEnabled
              ? `Kommt ${org.digestWeekdaysOnly ? "werktags" : "täglich"} ab ${String(org.digestHour).padStart(2, "0")}:00 Uhr – sofern es etwas zu berichten gibt.`
              : "Für die Firma derzeit ausgeschaltet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DigestControls optIn={user.digestOptIn} smtpConfigured={!!getTransport()} orgEnabled={org.digestEnabled} />
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Vorschau (Stand jetzt) · Betreff: <span className="text-foreground">{digest.subject}</span>
              </span>
              {isDigestEmpty(data) && <span>Heute gäbe es nichts zu berichten – es würde kein Digest verschickt.</span>}
            </div>
            <iframe title="Digest-Vorschau" srcDoc={digest.html} sandbox="" className="h-[640px] w-full rounded-lg border bg-white" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
