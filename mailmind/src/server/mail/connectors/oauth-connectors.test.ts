/**
 * Gmail- und Outlook-Connector mit simulierten API-Antworten (fetch-Mock).
 * Prüft Cursor-Logik, Reihenfolge (neueste zuerst), Fallbacks und Token-Erneuerung.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GmailConnector } from "./gmail";
import { OutlookConnector } from "./outlook";
import type { OAuthCredentials } from "../types";

const valid = (): OAuthCredentials => ({ kind: "oauth", accessToken: "tok", refreshToken: "ref", expiresAt: Date.now() + 3600_000 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mockFetch(routes: [RegExp, (url: string, init?: RequestInit) => Response][]) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) throw new Error(`Unerwarteter Aufruf: ${url}`);
    return hit[1](url, init);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("GmailConnector", () => {
  it("erster Abruf listet Posteingang ab Datum über mehrere Seiten", async () => {
    const calls = mockFetch([
      [/\/profile$/, () => json({ emailAddress: "info@firma.de", historyId: "900" })],
      [/\/messages\?q=.*pageToken=p2/, () => json({ messages: [{ id: "m3" }] })],
      [/\/messages\?q=/, () => json({ messages: [{ id: "m1" }, { id: "m2" }], nextPageToken: "p2" })],
    ]);
    const c = new GmailConnector(valid(), async () => {});
    const r = await c.listChanges(null, new Date("2026-10-18T00:00:00Z"));
    expect(r.ids).toEqual(["m1", "m2", "m3"]);
    expect(r.cursor).toEqual({ historyId: "900" });
    expect(decodeURIComponent(calls[1]!)).toContain("in:inbox after:1792281600");
  });

  it("inkrementell über history.list – neueste zuerst, ohne Dubletten", async () => {
    mockFetch([
      [/\/profile$/, () => json({ historyId: "950" })],
      [/\/history\?startHistoryId=900/, () =>
        json({ history: [{ messagesAdded: [{ message: { id: "a" } }] }, { messagesAdded: [{ message: { id: "b" } }, { message: { id: "a" } }] }] })],
    ]);
    const r = await new GmailConnector(valid(), async () => {}).listChanges({ historyId: "900" }, new Date());
    expect(r.ids).toEqual(["b", "a"]);
    expect(r.cursor).toEqual({ historyId: "950" });
  });

  it("fällt bei abgelaufener historyId (404) auf die Datumssuche zurück", async () => {
    mockFetch([
      [/\/profile$/, () => json({ historyId: "999" })],
      [/\/history/, () => json({ error: "not found" }, 404)],
      [/\/messages\?q=/, () => json({ messages: [{ id: "x" }] })],
    ]);
    const r = await new GmailConnector(valid(), async () => {}).listChanges({ historyId: "1" }, new Date());
    expect(r.ids).toEqual(["x"]);
  });

  it("lädt Rohdaten, erkennt Thread und Lesestatus", async () => {
    const rawMail = "From: a@b.de\r\nSubject: Hallo\r\nMessage-ID: <x@b.de>\r\n\r\nText";
    mockFetch([[/\/messages\/m1\?format=raw/, () => json({ id: "m1", threadId: "t1", labelIds: ["INBOX", "UNREAD"], internalDate: "1763300000000", raw: Buffer.from(rawMail).toString("base64url") })]]);
    const m = await new GmailConnector(valid(), async () => {}).fetchMessage("m1");
    expect(m).toMatchObject({ providerMessageId: "m1", providerThreadId: "t1", isRead: false, subject: "Hallo" });
  });

  it("erneuert abgelaufene Tokens und speichert sie", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    mockFetch([
      [/oauth2\.googleapis\.com\/token/, () => json({ access_token: "neu", expires_in: 3600 })],
      [/\/profile$/, (_u, init) => {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer neu");
        return json({ emailAddress: "info@firma.de" });
      }],
    ]);
    const saved: OAuthCredentials[] = [];
    const creds = { ...valid(), expiresAt: Date.now() - 1000 };
    await new GmailConnector(creds, async (c) => void saved.push(c)).verify();
    expect(saved[0]).toMatchObject({ accessToken: "neu", refreshToken: "ref" });
  });

  it("meldet einen widerrufenen Zugriff verständlich", async () => {
    mockFetch([[/\/profile$/, () => json({}, 401)]]);
    await expect(new GmailConnector(valid(), async () => {}).verify()).rejects.toThrow(/neu verbinden/);
  });
});

describe("OutlookConnector", () => {
  it("Delta-Abfrage: folgt nextLink, speichert deltaLink, sortiert neueste zuerst, ignoriert gelöschte", async () => {
    mockFetch([
      [/page2/, () => json({ value: [{ id: "c", receivedDateTime: "2026-11-16T10:00:00Z" }, { id: "gone", "@removed": { reason: "deleted" } }], "@odata.deltaLink": "https://graph/delta?token=abc" })],
      [/messages\/delta\?\$select/, () => json({ value: [{ id: "a", receivedDateTime: "2026-11-10T10:00:00Z" }, { id: "b", receivedDateTime: "2026-11-17T10:00:00Z" }], "@odata.nextLink": "https://graph/page2" })],
    ]);
    const r = await new OutlookConnector(valid(), async () => {}).listChanges(null, new Date("2026-10-18T00:00:00Z"));
    expect(r.ids).toEqual(["b", "c", "a"]);
    expect(r.cursor).toEqual({ deltaLink: "https://graph/delta?token=abc" });
  });

  it("wandelt Graph-Nachrichten inkl. Anhängen um (eingebettete Bilder ausgenommen)", async () => {
    mockFetch([
      [/\/attachments/, () => json({ value: [{ id: "att1", name: "Angebot.pdf", contentType: "application/pdf", size: 1200, isInline: false }, { id: "img", name: "logo.png", isInline: true }] })],
      [/\/me\/messages\/m1\?/, () =>
        json({
          id: "m1",
          conversationId: "conv1",
          internetMessageId: "<abc@firma.de>",
          subject: "Angebot",
          from: { emailAddress: { name: "Petra", address: "Petra@Kunde.de" } },
          toRecipients: [{ emailAddress: { address: "info@firma.de" } }],
          receivedDateTime: "2026-11-17T08:00:00Z",
          body: { contentType: "html", content: "<p>Hallo <b>Team</b></p>" },
          isRead: true,
          hasAttachments: true,
          internetMessageHeaders: [{ name: "In-Reply-To", value: "<orig@firma.de>" }],
        })],
    ]);
    const m = await new OutlookConnector(valid(), async () => {}).fetchMessage("m1");
    expect(m).toMatchObject({
      providerThreadId: "conv1",
      messageIdHeader: "abc@firma.de",
      inReplyTo: "orig@firma.de",
      from: { name: "Petra", email: "petra@kunde.de" },
      text: "Hallo Team",
      isRead: true,
    });
    expect(m!.attachments).toEqual([{ filename: "Angebot.pdf", mimeType: "application/pdf", size: 1200, providerAttachmentId: "att1" }]);
  });
});
