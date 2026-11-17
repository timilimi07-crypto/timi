import { NextResponse } from "next/server";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { triggerSync } from "@/server/jobs/trigger";
import { GmailConnector } from "@/server/mail/connectors/gmail";
import { OutlookConnector } from "@/server/mail/connectors/outlook";
import { exchangeCode, verifyState, type OAuthProvider } from "@/server/mail/oauth";
import { MailboxError } from "@/server/mail/types";
import { getAppSession } from "@/server/session";

type Ctx = { params: Promise<{ provider: string }> };

function back(req: Request, params: Record<string, string>) {
  const url = new URL("/settings/mailboxes", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * GET /api/mailboxes/oauth/:provider/callback – Rücksprung nach der Anmeldung
 * bei Google/Microsoft. Prüft den signierten state, tauscht den Code gegen
 * Tokens, speichert sie verschlüsselt und startet den ersten Abruf.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { provider } = await params;
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(req, { error: "Die Anmeldung wurde abgebrochen." });

  const state = verifyState(url.searchParams.get("state") ?? "");
  const session = await getAppSession();
  if (!state || !session || session.userId !== state.userId || session.organizationId !== state.orgId) {
    return back(req, { error: "Ungültige oder abgelaufene Anfrage. Bitte erneut versuchen." });
  }
  if (provider !== "google" && provider !== "microsoft") return back(req, { error: "Unbekannter Anbieter." });

  try {
    const creds = await exchangeCode(provider as OAuthProvider, url.searchParams.get("code") ?? "");
    const noop = async () => {};
    const connector = provider === "google" ? new GmailConnector(creds, noop) : new OutlookConnector(creds, noop);
    const { emailAddress } = await connector.verify();
    if (!emailAddress) throw new MailboxError("E-Mail-Adresse des Kontos konnte nicht ermittelt werden.", "provider");

    const mailboxProvider = provider === "google" ? "GMAIL" : "OUTLOOK";
    // Erneutes Verbinden desselben Kontos aktualisiert nur die Zugangsdaten.
    const mailbox = await db.mailbox.upsert({
      where: { organizationId_emailAddress: { organizationId: state.orgId, emailAddress } },
      create: {
        organizationId: state.orgId,
        name: state.name || emailAddress,
        emailAddress,
        provider: mailboxProvider,
        encryptedCredentials: encryptJson(creds),
        config: { account: emailAddress },
        initialSyncDays: state.initialSyncDays,
      },
      update: { encryptedCredentials: encryptJson(creds), status: "ACTIVE", lastError: null, syncEnabled: true },
      select: { id: true },
    });
    await audit(session, "mailbox.create", { type: "mailbox", id: mailbox.id }, { provider: mailboxProvider, emailAddress });
    await triggerSync([mailbox.id]).catch(() => {});
    return back(req, { connected: emailAddress });
  } catch (err) {
    const message = err instanceof MailboxError ? err.message : "Verbindung fehlgeschlagen.";
    console.error("[oauth]", err);
    return back(req, { error: message });
  }
}
