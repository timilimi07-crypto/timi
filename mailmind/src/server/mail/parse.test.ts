import { describe, expect, it } from "vitest";
import { makeSnippet, parseRawMessage } from "./parse";

const RAW = [
  "From: \"Petra Klein\" <P.Klein@Kunde-AG.de>",
  "To: info@mueller-partner.de",
  "Cc: Jonas <jonas@mueller-partner.de>",
  "Subject: =?UTF-8?Q?AW:_Angebot_f=C3=BCr_Wartung?=",
  "Message-ID: <reply-2@kunde-ag.de>",
  "In-Reply-To: <orig-1@mueller-partner.de>",
  "References: <orig-1@mueller-partner.de>",
  "Date: Tue, 17 Nov 2026 08:15:00 +0100",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b1"',
  "",
  "--b1",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Guten Morgen, bitte senden Sie uns das Angebot bis Freitag.",
  "> alter zitierter Text",
  "--b1",
  'Content-Type: application/pdf; name="Anfrage.pdf"',
  'Content-Disposition: attachment; filename="Anfrage.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQK",
  "--b1--",
  "",
].join("\r\n");

describe("parseRawMessage", () => {
  it("normalisiert Header, Adressen, Text und Anhänge", async () => {
    const m = await parseRawMessage(RAW, { isRead: false });
    expect(m.subject).toBe("AW: Angebot für Wartung");
    expect(m.from).toEqual({ name: "Petra Klein", email: "p.klein@kunde-ag.de" });
    expect(m.cc).toEqual([{ name: "Jonas", email: "jonas@mueller-partner.de" }]);
    expect(m.messageIdHeader).toBe("reply-2@kunde-ag.de");
    expect(m.providerMessageId).toBe("reply-2@kunde-ag.de");
    expect(m.inReplyTo).toBe("orig-1@mueller-partner.de");
    expect(m.references).toEqual(["orig-1@mueller-partner.de"]);
    expect(m.date.toISOString()).toBe("2026-11-17T07:15:00.000Z");
    expect(m.text).toContain("bis Freitag");
    expect(m.attachments).toHaveLength(1);
    expect(m.attachments[0]).toMatchObject({ filename: "Anfrage.pdf", mimeType: "application/pdf" });
  });

  it("erzeugt Text aus HTML, wenn kein Text-Teil vorhanden ist", async () => {
    const raw = "From: a@b.de\r\nSubject: x\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Hallo <b>Welt</b></p>";
    const m = await parseRawMessage(raw, { isRead: true });
    expect(m.text).toBe("Hallo Welt");
    expect(m.html).toContain("<b>Welt</b>");
  });
});

describe("makeSnippet", () => {
  it("entfernt Zitate und kürzt", () => {
    expect(makeSnippet("Hallo\n> zitat\nWelt")).toBe("Hallo Welt");
    expect(makeSnippet("a".repeat(300))).toHaveLength(200);
  });
});
