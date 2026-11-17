import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MailboxError, type OAuthCredentials } from "./types";

/**
 * OAuth 2.0 für Gmail (Google) und Outlook (Microsoft Graph):
 * Autorisierungs-URL, Code-Tausch, Token-Erneuerung und signierter state.
 */
export type OAuthProvider = "google" | "microsoft";

type ProviderConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  clientId?: string;
  clientSecret?: string;
  extraAuthParams: Record<string, string>;
};

function config(provider: OAuthProvider): ProviderConfig {
  if (provider === "google") {
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      // Nur Lesezugriff – MailMind verschickt keine E-Mails im Namen des Nutzers.
      scopes: "openid email https://www.googleapis.com/auth/gmail.readonly",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // prompt=consent erzwingt, dass Google ein Refresh-Token ausstellt.
      extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    };
  }
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  return {
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes: "offline_access User.Read Mail.Read",
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    extraAuthParams: { prompt: "select_account" },
  };
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  const c = config(provider);
  return !!(c.clientId && c.clientSecret);
}

export function redirectUri(provider: OAuthProvider): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/mailboxes/oauth/${provider}/callback`;
}

export function buildAuthUrl(provider: OAuthProvider, state: string): string {
  const c = config(provider);
  if (!c.clientId) throw new MailboxError("OAuth ist für diesen Anbieter nicht konfiguriert.", "config");
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: c.scopes,
    state,
    ...c.extraAuthParams,
  });
  return `${c.authUrl}?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; error?: string };

async function tokenRequest(provider: OAuthProvider, body: Record<string, string>): Promise<TokenResponse> {
  const c = config(provider);
  if (!c.clientId || !c.clientSecret) throw new MailboxError("OAuth ist nicht konfiguriert.", "config");
  let res: Response;
  try {
    res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new MailboxError("Anmeldedienst nicht erreichbar.", "network", { cause: err });
  }
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new MailboxError(
      "Die Anmeldung beim E-Mail-Anbieter ist abgelaufen oder wurde widerrufen. Bitte das Postfach neu verbinden.",
      "auth",
      { cause: json.error_description ?? json.error },
    );
  }
  return json;
}

export async function exchangeCode(provider: OAuthProvider, code: string): Promise<OAuthCredentials> {
  const t = await tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri(provider) });
  if (!t.refresh_token) throw new MailboxError("Der Anbieter hat kein Refresh-Token ausgestellt.", "auth");
  return { kind: "oauth", accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
}

/**
 * Liefert ein gültiges Access-Token und erneuert es bei Bedarf (60 s Puffer).
 * Neue Tokens werden über `onRefresh` verschlüsselt zurückgeschrieben.
 */
export async function ensureAccessToken(
  provider: OAuthProvider,
  creds: OAuthCredentials,
  onRefresh: (c: OAuthCredentials) => Promise<void>,
): Promise<string> {
  if (creds.expiresAt - 60_000 > Date.now()) return creds.accessToken;
  const t = await tokenRequest(provider, { grant_type: "refresh_token", refresh_token: creds.refreshToken });
  const updated: OAuthCredentials = {
    kind: "oauth",
    accessToken: t.access_token,
    // Microsoft rotiert Refresh-Tokens, Google meist nicht.
    refreshToken: t.refresh_token ?? creds.refreshToken,
    expiresAt: Date.now() + t.expires_in * 1000,
  };
  Object.assign(creds, updated);
  await onRefresh(updated);
  return updated.accessToken;
}

// --- Signierter state-Parameter (Schutz vor CSRF beim OAuth-Rücksprung) ---

export type OAuthState = { orgId: string; userId: string; name: string; initialSyncDays: number; nonce: string; exp: number };

function sign(data: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET fehlt");
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createState(s: Omit<OAuthState, "nonce" | "exp">): string {
  const payload: OAuthState = { ...s, nonce: randomBytes(12).toString("base64url"), exp: Date.now() + 10 * 60_000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyState(state: string): OAuthState | null {
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as OAuthState;
  return payload.exp > Date.now() ? payload : null;
}
