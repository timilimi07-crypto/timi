import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiRoute } from "@/server/api";
import { buildAuthUrl, createState, isOAuthConfigured, type OAuthProvider } from "@/server/mail/oauth";
import { assertSession, HttpError } from "@/server/session";

type Ctx = { params: Promise<{ provider: string }> };

/** GET /api/mailboxes/oauth/:provider/start?name=…&days=… – Weiterleitung zu Google/Microsoft. */
export const GET = apiRoute<Ctx>(async (req, { params }) => {
  const session = await assertSession("mailbox.manage");
  const { provider } = await params;
  if (provider !== "google" && provider !== "microsoft") throw new HttpError(404, "Unbekannter Anbieter");
  if (!isOAuthConfigured(provider)) throw new HttpError(400, "Dieser Anbieter ist nicht konfiguriert (Client-ID/Secret fehlen in .env)");

  const url = new URL(req.url);
  const org = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { initialSyncDays: true } });
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || org.initialSyncDays));
  const state = createState({
    orgId: session.organizationId,
    userId: session.userId,
    name: (url.searchParams.get("name") ?? "").slice(0, 60),
    initialSyncDays: days,
  });
  return NextResponse.redirect(buildAuthUrl(provider as OAuthProvider, state));
});
