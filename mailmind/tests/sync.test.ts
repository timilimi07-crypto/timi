/**
 * Integrationstest: Postfach-Abruf gegen die echte Datenbank (DATABASE_URL)
 * mit dem Demo-Connector. Legt eine eigene Test-Firma an und löscht sie danach.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { DEMO_EMAILS } from "@/server/mail/demo/emails";
import { findDueMailboxes, syncMailbox } from "@/server/mail/sync";

const SLUG = `test-sync-${Date.now()}`;
const anchor = new Date("2026-11-17T08:00:00Z");
let orgId = "";

async function createMailbox(name: string, extra: { initialSyncDays?: number } = {}) {
  return db.mailbox.create({
    data: {
      organizationId: orgId,
      name,
      emailAddress: `${name}@test.local`,
      provider: "DEMO",
      config: { demoSet: "info" },
      createdAt: anchor,
      ...extra,
    },
  });
}

/** Demo-Connector mit fester „Jetzt“-Zeit, damit der Test deterministisch ist. */
const factoryAt = (now: Date) => () => new DemoConnector("info", anchor, () => now);

const info = DEMO_EMAILS.filter((e) => e.set === "info");
const inWindow30 = info.filter((e) => e.minutesAgo >= 0 && e.minutesAgo <= 30 * 24 * 60);

beforeAll(async () => {
  const org = await db.organization.create({ data: { name: "Test Sync GmbH", slug: SLUG, maxEmailsPerSync: 10 } });
  orgId = org.id;
});

afterAll(async () => {
  await db.organization.delete({ where: { id: orgId } });
  await db.$disconnect();
});

describe("syncMailbox", () => {
  it("lädt beim ersten Abruf nur die neuesten N E-Mails aus dem 30-Tage-Fenster", async () => {
    const mb = await createMailbox("limit");
    const r = await syncMailbox(mb.id, { now: anchor, connectorFactory: factoryAt(anchor) });

    expect(r.status).toBe("ok");
    expect(r.created).toBe(10);
    expect(r.remaining).toBe(inWindow30.length - 10);

    // Die geladenen sind die 10 neuesten.
    const newest = [...inWindow30].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 10).map((e) => e.id);
    const stored = await db.email.findMany({ where: { mailboxId: mb.id }, select: { providerMessageId: true } });
    expect(stored.map((s) => s.providerMessageId).sort()).toEqual(newest.sort());

    // Neue E-Mails warten auf die KI.
    expect(await db.email.count({ where: { mailboxId: mb.id, aiStatus: "PENDING" } })).toBe(10);
  });

  it("holt den Rückstand in weiteren Läufen nach – ohne Dubletten und ohne E-Mails > 30 Tage", async () => {
    const mb = await createMailbox("backlog");
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const r = await syncMailbox(mb.id, { now: anchor, connectorFactory: factoryAt(anchor) });
      total += r.created;
      if (r.remaining === 0) break;
    }
    expect(total).toBe(inWindow30.length);
    expect(await db.email.count({ where: { mailboxId: mb.id } })).toBe(inWindow30.length);
    expect(await db.email.count({ where: { mailboxId: mb.id, providerMessageId: { in: ["info-35", "info-36", "info-37"] } } })).toBe(0);

    // Erneuter Lauf: nichts Neues.
    const again = await syncMailbox(mb.id, { now: anchor, connectorFactory: factoryAt(anchor) });
    expect(again.created).toBe(0);
  });

  it("fasst Antworten zu einem Thread zusammen", async () => {
    const thread = await db.email.findFirstOrThrow({
      where: { organizationId: orgId, mailbox: { name: "backlog" }, providerMessageId: "info-04c" },
      include: { thread: { include: { _count: { select: { emails: true } } } } },
    });
    expect(thread.thread?._count.emails).toBe(3);
    expect(thread.thread?.messageCount).toBe(3);
    expect(thread.thread?.subject).toBe("Angebot A-2026-117 – Rückfragen");
  });

  it("übernimmt Anhänge (ohne Inhalte)", async () => {
    const e = await db.email.findFirstOrThrow({
      where: { organizationId: orgId, mailbox: { name: "backlog" }, providerMessageId: "info-05" },
      include: { attachments: true },
    });
    expect(e.hasAttachments).toBe(true);
    expect(e.attachments.map((a) => a.filename)).toContain("Lieferschein_LS-77310.pdf");
  });

  it("später eintreffende E-Mails werden beim nächsten Abruf geholt", async () => {
    const mb = await db.mailbox.findFirstOrThrow({ where: { organizationId: orgId, name: "backlog" } });
    const later = new Date(anchor.getTime() + 100 * 60_000);
    const r = await syncMailbox(mb.id, { now: later, connectorFactory: factoryAt(later) });
    expect(r.created).toBe(4); // info-38 … info-41
    const reply = await db.email.findFirstOrThrow({ where: { mailboxId: mb.id, providerMessageId: "info-38" } });
    const original = await db.email.findFirstOrThrow({ where: { mailboxId: mb.id, providerMessageId: "info-01" } });
    expect(reply.threadId).toBe(original.threadId);
  });

  it("respektiert ein kürzeres Zeitfenster pro Postfach", async () => {
    const mb = await createMailbox("week", { initialSyncDays: 2 });
    await db.organization.update({ where: { id: orgId }, data: { maxEmailsPerSync: 500 } });
    const r = await syncMailbox(mb.id, { now: anchor, connectorFactory: factoryAt(anchor) });
    const expected = info.filter((e) => e.minutesAgo >= 0 && e.minutesAgo <= 2 * 24 * 60).length;
    expect(r.created).toBe(expected);
    expect(r.remaining).toBe(0);
  });

  it("verhindert parallele Läufe für dasselbe Postfach", async () => {
    const mb = await createMailbox("lock");
    await db.mailbox.update({ where: { id: mb.id }, data: { syncStartedAt: new Date() } });
    const r = await syncMailbox(mb.id, { connectorFactory: factoryAt(anchor) });
    expect(r.status).toBe("locked");
  });

  it("speichert Fehler verständlich am Postfach", async () => {
    const mb = await createMailbox("broken");
    const r = await syncMailbox(mb.id, {
      connectorFactory: () => {
        throw new Error("Verbindung abgelehnt");
      },
    });
    expect(r.status).toBe("error");
    const after = await db.mailbox.findUniqueOrThrow({ where: { id: mb.id } });
    expect(after.status).toBe("ERROR");
    expect(after.lastError).toContain("Verbindung abgelehnt");
    expect(after.syncStartedAt).toBeNull();
  });

  it("Scheduler erkennt fällige Postfächer (neu, Rückstand) und überspringt fehlerhafte", async () => {
    const fresh = await createMailbox("due-fresh");
    const due = await findDueMailboxes();
    expect(due).toContain(fresh.id);
    const broken = await db.mailbox.findFirstOrThrow({ where: { organizationId: orgId, name: "broken" } });
    await db.mailbox.update({ where: { id: broken.id }, data: { lastSyncAt: new Date() } });
    expect(await findDueMailboxes()).not.toContain(broken.id);
  });
});
