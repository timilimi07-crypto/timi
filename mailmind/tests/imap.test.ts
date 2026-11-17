/**
 * End-to-End-Test des IMAP-Connectors gegen einen lokalen IMAP-Testserver
 * (hoodiecrow-imap) und die echte Datenbank: Zeitfenster, Limit pro Lauf,
 * inkrementeller Abruf neuer Nachrichten, Threading, Anhänge, Login-Fehler.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ImapFlow } from "imapflow";
// @ts-expect-error – Paket ohne Typdefinitionen
import hoodiecrow from "hoodiecrow-imap";
import { randomBytes } from "node:crypto";
import { encryptJson } from "@/lib/crypto";
import { db } from "@/lib/db";
import { createImapConnector } from "@/server/mail/connectors";
import { syncMailbox } from "@/server/mail/sync";
import type { ImapCredentials } from "@/server/mail/types";

const PORT = 21143;
const DAY = 86_400_000;
const creds: ImapCredentials = { kind: "imap", host: "127.0.0.1", port: PORT, secure: false, username: "testuser", password: "testpass", folder: "INBOX" };

function raw(o: { id: string; subject: string; date: Date; refs?: string; body?: string; attachment?: boolean }) {
  const head = [
    `From: "Kunde ${o.id}" <kunde-${o.id}@beispiel.de>`,
    "To: info@test.local",
    `Subject: ${o.subject}`,
    `Message-ID: <${o.id}@beispiel.de>`,
    ...(o.refs ? [`In-Reply-To: <${o.refs}@beispiel.de>`, `References: <${o.refs}@beispiel.de>`] : []),
    `Date: ${o.date.toUTCString()}`,
    "MIME-Version: 1.0",
  ];
  if (!o.attachment) return [...head, "Content-Type: text/plain; charset=utf-8", "", o.body ?? `Text ${o.id}`].join("\r\n");
  return [
    ...head,
    'Content-Type: multipart/mixed; boundary="xx"',
    "",
    "--xx",
    "Content-Type: text/plain; charset=utf-8",
    "",
    o.body ?? "Siehe Anhang",
    "--xx",
    'Content-Type: application/pdf; name="Rechnung.pdf"',
    'Content-Disposition: attachment; filename="Rechnung.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    "JVBERi0xLjQK",
    "--xx--",
    "",
  ].join("\r\n");
}

const now = Date.now();
const msg = (o: Parameters<typeof raw>[0]) => ({ raw: raw(o), flags: [], internaldate: o.date });

let server: { listen: (p: number, cb: () => void) => void; close: (cb?: () => void) => void };
let orgId = "";
let mailboxId = "";

beforeAll(async () => {
  process.env.ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
  server = hoodiecrow({
    plugins: ["ID", "UNSELECT", "ENABLE", "LITERALPLUS"],
    storage: {
      INBOX: {
        messages: [
          msg({ id: "alt-1", subject: "Uralte Anfrage", date: new Date(now - 90 * DAY) }),
          msg({ id: "alt-2", subject: "Alter Newsletter", date: new Date(now - 45 * DAY) }),
          msg({ id: "neu-1", subject: "Angebot Wartung", date: new Date(now - 5 * DAY) }),
          msg({ id: "neu-2", subject: "Rechnung 4711", date: new Date(now - 2 * DAY), attachment: true }),
          msg({ id: "neu-3", subject: "AW: Angebot Wartung", date: new Date(now - 1 * DAY), refs: "neu-1" }),
        ],
      },
    },
  });
  await new Promise<void>((r) => server.listen(PORT, r));

  const org = await db.organization.create({ data: { name: "IMAP-Test", slug: `test-imap-${now}`, maxEmailsPerSync: 2, initialSyncDays: 30 } });
  orgId = org.id;
  const mb = await db.mailbox.create({
    data: { organizationId: orgId, name: "IMAP", emailAddress: "info@test.local", provider: "IMAP", encryptedCredentials: encryptJson(creds) },
  });
  mailboxId = mb.id;
});

afterAll(async () => {
  await db.organization.delete({ where: { id: orgId } });
  await db.$disconnect();
  await new Promise<void>((r) => server.close(() => r()));
});

describe("IMAP-Connector", () => {
  it("meldet falsche Zugangsdaten verständlich", async () => {
    const c = createImapConnector({ ...creds, password: "falsch" });
    await expect(c.verify()).rejects.toThrow(/Benutzername und Passwort prüfen/);
    await c.close();
  });

  it("erster Abruf: nur 30-Tage-Fenster, max. 2 pro Lauf, neueste zuerst", async () => {
    const r = await syncMailbox(mailboxId);
    expect(r).toMatchObject({ status: "ok", created: 2, remaining: 1 });
    const subjects = (await db.email.findMany({ where: { mailboxId }, select: { subject: true } })).map((e) => e.subject).sort();
    expect(subjects).toEqual(["AW: Angebot Wartung", "Rechnung 4711"]);
  });

  it("zweiter Abruf holt den Rückstand, alte E-Mails bleiben draußen", async () => {
    const r = await syncMailbox(mailboxId);
    expect(r).toMatchObject({ status: "ok", created: 1, remaining: 0 });
    expect(await db.email.count({ where: { mailboxId } })).toBe(3);
    expect(await db.email.count({ where: { mailboxId, subject: { in: ["Uralte Anfrage", "Alter Newsletter"] } } })).toBe(0);
  });

  it("ordnet Antwort und Original demselben Thread zu und erkennt Anhänge", async () => {
    const [orig, reply, invoice] = await Promise.all(
      ["neu-1@beispiel.de", "neu-3@beispiel.de", "neu-2@beispiel.de"].map((id) =>
        db.email.findFirstOrThrow({ where: { mailboxId, messageIdHeader: id }, include: { attachments: true } }),
      ),
    );
    expect(reply!.threadId).toBe(orig!.threadId);
    expect(invoice!.hasAttachments).toBe(true);
    expect(invoice!.attachments[0]).toMatchObject({ filename: "Rechnung.pdf", mimeType: "application/pdf" });
  });

  it("inkrementeller Abruf: nur neu eingegangene Nachrichten", async () => {
    const client = new ImapFlow({ host: "127.0.0.1", port: PORT, secure: false, auth: { user: "testuser", pass: "testpass" }, logger: false });
    await client.connect();
    await client.append("INBOX", raw({ id: "neu-4", subject: "Dringend: Rückruf", date: new Date() }));
    await client.logout();

    const r = await syncMailbox(mailboxId);
    expect(r).toMatchObject({ status: "ok", created: 1, duplicates: 0, remaining: 0 });
    const again = await syncMailbox(mailboxId);
    expect(again.created).toBe(0);
  });
});
