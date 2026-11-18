/**
 * Posteingang-Abfrage gegen die echte Datenbank: Thread-Gruppierung,
 * Volltextsuche (deutsch, Präfix), Filter, Sortierung, Cursor-Paginierung,
 * Mandantentrennung.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/server/defaults";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { DEMO_EMAILS } from "@/server/mail/demo/emails";
import { storeMessage } from "@/server/mail/sync";
import { listEmails, parseInboxFilters, toPrefixTsQuery } from "@/server/queries/emails";

const anchor = new Date("2026-11-17T08:00:00Z");
let orgId = "";
let otherOrgId = "";
const ids = new Map<string, string>(); // Demo-ID → E-Mail-ID

const list = (params: Record<string, string> = {}, cursor?: string | null, limit = 100) =>
  listEmails(orgId, parseInboxFilters(params), { cursor, limit, showCosts: true });
const demoIds = (items: { id: string }[]) => {
  const rev = new Map([...ids].map(([d, e]) => [e, d]));
  return items.map((i) => rev.get(i.id));
};

beforeAll(async () => {
  const org = await db.organization.create({
    data: {
      name: "Inbox-Test",
      slug: `test-inbox-${Date.now()}`,
      categories: { create: DEFAULT_CATEGORIES.map((c, i) => ({ key: c.key, name: c.name, description: c.description, autoCollapse: "autoCollapse" in c, sortOrder: i })) },
    },
    include: { categories: true },
  });
  orgId = org.id;
  const mb = await db.mailbox.create({ data: { organizationId: orgId, name: "Info", emailAddress: "info@test.local", provider: "DEMO" } });
  const demo = new DemoConnector("info", anchor, () => new Date(anchor.getTime() + 200 * 60_000));
  for (const e of DEMO_EMAILS.filter((x) => x.set === "info" && x.minutesAgo < 30 * 24 * 60).sort((a, b) => b.minutesAgo - a.minutesAgo)) {
    const id = await storeMessage(mb, org, (await demo.fetchMessage(e.id))!);
    ids.set(e.id, id!);
  }
  // Einordnung wie nach der KI-Auswertung simulieren.
  const cat = (key: string) => org.categories.find((c) => c.key === key)!.id;
  const set = (demoId: string, data: Parameters<typeof db.email.update>[0]["data"]) => db.email.update({ where: { id: ids.get(demoId)! }, data });
  await set("info-01", { priority: "URGENT", categoryId: cat("kunde"), summary: "Anlage 3 der Stadtwerke Kassel ist ausgefallen." });
  await set("info-38", { priority: "URGENT", categoryId: cat("kunde") });
  await set("info-26", { priority: "URGENT", categoryId: cat("kunde"), needsReview: true });
  await set("info-05", { priority: "HIGH", categoryId: cat("support") });
  await set("info-18", { priority: "LOW", categoryId: cat("newsletter"), isCollapsed: true });
  await set("info-14", { status: "DONE" });

  // Zweite Firma mit gleichem Inhalt – darf nie auftauchen.
  const other = await db.organization.create({ data: { name: "Fremd", slug: `test-inbox-other-${Date.now()}` } });
  otherOrgId = other.id;
  const omb = await db.mailbox.create({ data: { organizationId: otherOrgId, name: "X", emailAddress: "x@test.local", provider: "DEMO" } });
  await storeMessage(omb, other, (await demo.fetchMessage("info-01"))!);
});

afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await db.$disconnect();
});

describe("listEmails", () => {
  it("zeigt eine Zeile pro Thread (neueste E-Mail) und blendet Erledigtes und Newsletter aus", async () => {
    const { items } = await list();
    const d = demoIds(items);
    expect(d).toContain("info-04c");
    expect(d).not.toContain("info-04a");
    expect(d).not.toContain("info-04b");
    expect(d).toContain("info-38"); // Antwort im Thread von info-01
    expect(d).not.toContain("info-01");
    expect(d).not.toContain("info-14"); // erledigt
    expect(d).not.toContain("info-18"); // eingeklappter Newsletter
    expect(items.find((i) => i.id === ids.get("info-04c"))!.thread?.messageCount).toBe(3);
  });

  it("sortiert nach Priorität (Dringend zuerst), sonst nach Datum", async () => {
    const { items } = await list({ sort: "priority" });
    expect(items.slice(0, 2).map((i) => i.priority)).toEqual(["URGENT", "URGENT"]);
    const newest = await list();
    const times = newest.items.map((i) => Date.parse(i.receivedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("paginiert lückenlos und ohne Dubletten per Cursor", async () => {
    const all = (await list({}, null, 100)).items.map((i) => i.id);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await list({ sort: "priority" }, cursor, 7);
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual([...all].sort());
  });

  it("Volltextsuche mit deutschen Stammformen und Präfix", async () => {
    // „Wartungsverträge“ findet „Wartungsvertrag“ (Stamm), „Reklam“ als Präfix.
    expect(demoIds((await list({ q: "Wartungsverträge" })).items)).toEqual(expect.arrayContaining(["info-41"]));
    expect(demoIds((await list({ q: "Reklam" })).items)).toContain("info-05");
    // Nummern und Adressen über ILIKE.
    expect(demoIds((await list({ q: "PO-2026-8841" })).items)).toEqual(expect.arrayContaining(["info-02", "info-31"]));
    // Suche durchsucht auch Erledigtes nicht – außer view=all.
    expect(demoIds((await list({ q: "Teammeeting" })).items)).toEqual([]);
    expect(demoIds((await list({ q: "Teammeeting", view: "all" })).items)).toEqual(["info-14"]);
    // KI-Zusammenfassung ist durchsuchbar.
    expect(demoIds((await list({ q: "ausgefallen", view: "all" })).items)).toContain("info-38");
  });

  it("filtert nach Kategorie, Priorität, Absender, Datum, „Bitte prüfen“ und Newsletter", async () => {
    expect(demoIds((await list({ category: "support" })).items)).toEqual(["info-05"]);
    expect(demoIds((await list({ priority: "URGENT" })).items).sort()).toEqual(["info-26", "info-38"]);
    expect(demoIds((await list({ from: "weber" })).items)).toEqual(["info-04c"]);
    expect(demoIds((await list({ review: "1" })).items)).toEqual(["info-26"]);
    expect(demoIds((await list({ bulk: "only" })).items)).toEqual(["info-18"]);
    const today = (await list({ after: "2026-11-17", before: "2026-11-17", view: "all" })).items;
    expect(today.every((i) => i.receivedAt >= "2026-11-16T23:00:00.000Z" && i.receivedAt < "2026-11-17T23:00:00.000Z")).toBe(true);
    expect(today.length).toBeGreaterThan(3);
  });

  it("liefert nie E-Mails anderer Firmen", async () => {
    const { items } = await list({ q: "Anlage", view: "all" });
    const foreign = await db.email.findMany({ where: { organizationId: otherOrgId }, select: { id: true } });
    expect(items.map((i) => i.id)).not.toContain(foreign[0]!.id);
  });

  it("Status eines Verlaufs = Status der neuesten E-Mail (kein Verlauf in zwei Spalten)", async () => {
    // Weber-Verlauf: ältere Mails erledigt, neueste Antwort neu → nur in „Offen“/„Neu“.
    await db.email.updateMany({ where: { id: { in: [ids.get("info-04a")!, ids.get("info-04b")!] } }, data: { status: "DONE" } });
    expect(demoIds((await list({ view: "open" })).items)).toContain("info-04c");
    expect(demoIds((await list({ view: "done" })).items)).not.toContain("info-04b");
    expect(demoIds((await list({ status: "NEW", view: "all" })).items)).toContain("info-04c");
    expect(demoIds((await list({ status: "DONE", view: "all" })).items)).not.toContain("info-04b");
    await db.email.updateMany({ where: { id: { in: [ids.get("info-04a")!, ids.get("info-04b")!] } }, data: { status: "NEW" } });
  });

  it("ignoriert ungültige Filterwerte statt zu scheitern", () => {
    expect(parseInboxFilters({ view: "quatsch", priority: "MEGA", after: "gestern", sort: "x" })).toMatchObject({ view: "open", sort: "newest", priority: undefined, after: undefined });
  });

  it("baut sichere Präfix-Suchanfragen", () => {
    expect(toPrefixTsQuery("Angebot  Weber!")).toBe("angebot:* & weber:*");
    expect(toPrefixTsQuery("' & | ! :*")).toBeNull();
  });
});
