/**
 * Aufgaben-API und Dashboard-Abfragen gegen die echte Datenbank.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/server/defaults";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { storeMessage } from "@/server/mail/sync";

type Sess = { userId: string; name: string; email: string; role: "ADMIN" | "MEMBER"; organizationId: string; organizationName: string };
let session: Sess | null = null;

vi.mock("@/server/session", async () => {
  const actual = await vi.importActual<typeof import("@/server/session")>("@/server/session");
  return {
    ...actual,
    assertSession: async () => {
      if (!session) throw new actual.HttpError(401, "Nicht angemeldet");
      return session;
    },
  };
});
vi.mock("@/server/audit", () => ({ audit: async () => {} }));

const { POST: createTask } = await import("@/app/api/tasks/route");
const { PATCH: patchTask, DELETE: deleteTask } = await import("@/app/api/tasks/[id]/route");
const { getDeadlines, getEmailsPerDay, getEmailsPerCategory, getImportantToday, getKpis } = await import("@/server/queries/dashboard");

const now = new Date("2026-11-18T09:00:00Z"); // Mittwoch, 10:00 Berlin
let orgId = "";
let otherOrgId = "";
let userId = "";
const ids = new Map<string, string>();
const req = (body?: unknown, method = "POST") =>
  new Request("http://localhost/api/tasks", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const due = (day: string) => new Date(`${day}T12:00:00Z`);

beforeAll(async () => {
  const org = await db.organization.create({
    data: {
      name: "Dashboard-Test",
      slug: `test-dash-${Date.now()}`,
      categories: { create: DEFAULT_CATEGORIES.map((c, i) => ({ key: c.key, name: c.name, description: c.description, autoCollapse: "autoCollapse" in c, sortOrder: i })) },
    },
    include: { categories: true },
  });
  orgId = org.id;
  userId = (await db.user.create({ data: { organizationId: orgId, name: "T", email: `t-${Date.now()}@t.local`, passwordHash: "x" } })).id;
  session = { userId, name: "T", email: "t@t", role: "ADMIN", organizationId: orgId, organizationName: org.name };
  const mb = await db.mailbox.create({ data: { organizationId: orgId, name: "Info", emailAddress: "info@t.local", provider: "DEMO" } });
  const demo = new DemoConnector("info", now);
  for (const d of ["info-01", "info-05", "info-06", "info-18", "info-23"]) ids.set(d, (await storeMessage(mb, org, (await demo.fetchMessage(d))!))!);
  const cat = (k: string) => org.categories.find((c) => c.key === k)!.id;
  await db.email.update({ where: { id: ids.get("info-01")! }, data: { priority: "URGENT", categoryId: cat("kunde") } });
  await db.email.update({ where: { id: ids.get("info-05")! }, data: { priority: "HIGH", categoryId: cat("support") } });
  await db.email.update({ where: { id: ids.get("info-06")! }, data: { priority: "NORMAL", categoryId: cat("support") } });
  await db.email.update({ where: { id: ids.get("info-18")! }, data: { priority: "LOW", categoryId: cat("newsletter"), isCollapsed: true } });

  const t = (title: string, day: string | null, extra: object = {}) =>
    db.task.create({ data: { organizationId: orgId, title, dueDate: day ? due(day) : null, emailId: ids.get("info-01"), ...extra } });
  await t("Überfällig", "2026-11-16");
  await t("Heute", "2026-11-18");
  await t("Morgen", "2026-11-19");
  await t("Diese Woche", "2026-11-24");
  await t("Zu spät für die Liste", "2026-12-10");
  await t("Ohne Frist", null);
  await t("Erledigt heute", "2026-11-18", { status: "DONE" });

  otherOrgId = (await db.organization.create({ data: { name: "Fremd", slug: `test-dash-other-${Date.now()}` } })).id;
});

afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await db.$disconnect();
});

beforeEach(() => {
  session = { userId, name: "T", email: "t@t", role: "ADMIN", organizationId: orgId, organizationName: "Dashboard-Test" };
});

describe("Dashboard-Abfragen", () => {
  it("gruppiert Fristen: überfällig, heute, morgen, nächste 7 Tage (nur offene)", async () => {
    const d = await getDeadlines(orgId, now);
    expect(d.map((x) => [x.title, x.bucket])).toEqual([
      ["Überfällig", "overdue"],
      ["Heute", "today"],
      ["Morgen", "tomorrow"],
      ["Diese Woche", "week"],
    ]);
    expect(d[0]!.email?.subject).toContain("Anlage 3");
  });

  it("zählt Kennzahlen korrekt", async () => {
    expect(await getKpis(orgId, now)).toMatchObject({ urgent: 1, openTasks: 6, dueToday: 1, overdue: 1, phishing: 1 });
  });

  it("„Heute wichtig“: Dringend/Hoch/Phishing, Dringend zuerst, ohne Normal/Newsletter", async () => {
    const items = await getImportantToday(orgId, { showCosts: false });
    const rev = new Map([...ids].map(([d, e]) => [e, d]));
    const d = items.map((i) => rev.get(i.id));
    expect(d[0]).toBe("info-01");
    expect(d).toEqual(expect.arrayContaining(["info-01", "info-05", "info-23"]));
    expect(d).not.toContain("info-06");
    expect(d).not.toContain("info-18");
  });

  it("E-Mails pro Tag: lückenlos, Berliner Kalendertage, Summe stimmt", async () => {
    const days = await getEmailsPerDay(orgId, 14, now);
    expect(days).toHaveLength(14);
    expect(days.at(-1)!.day).toBe("2026-11-18");
    const inWindow = await db.email.count({ where: { organizationId: orgId, receivedAt: { gte: new Date("2026-11-04T23:00:00Z") } } });
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(inWindow);
    expect(days.reduce((s, d) => s + d.urgent, 0)).toBe(1);
  });

  it("E-Mails pro Kategorie inkl. „Noch nicht ausgewertet“", async () => {
    const cats = await getEmailsPerCategory(orgId, 30, now);
    expect(cats.find((c) => c.key === "support")?.count).toBe(2);
    expect(cats.find((c) => c.key === null)?.name).toBe("Noch nicht ausgewertet");
  });
});

describe("Aufgaben-API", () => {
  it("legt manuelle Aufgaben an, ändert Titel/Frist/Status und löscht", async () => {
    const r = await (await createTask(req({ title: "  Angebot schicken ", dueDate: "2026-11-20" }), undefined)).json();
    const t = await db.task.findUniqueOrThrow({ where: { id: r.id } });
    expect(t).toMatchObject({ title: "Angebot schicken", source: "MANUAL", status: "OPEN" });
    expect(t.dueDate?.toISOString()).toBe("2026-11-20T12:00:00.000Z");

    await patchTask(req({ title: "Angebot verschicken", dueDate: null, status: "DONE" }, "PATCH"), ctx(r.id));
    const u = await db.task.findUniqueOrThrow({ where: { id: r.id } });
    expect(u).toMatchObject({ title: "Angebot verschicken", dueDate: null, status: "DONE" });
    expect(u.completedAt).not.toBeNull();

    expect((await deleteTask(req(undefined, "DELETE"), ctx(r.id))).status).toBe(200);
    expect(await db.task.findUnique({ where: { id: r.id } })).toBeNull();
  });

  it("validiert Eingaben", async () => {
    expect((await createTask(req({ title: "   " }), undefined)).status).toBe(400);
    expect((await createTask(req({ title: "x", dueDate: "18.11.2026" }), undefined)).status).toBe(400);
    const id = (await db.task.findFirstOrThrow({ where: { organizationId: orgId } })).id;
    expect((await patchTask(req({}, "PATCH"), ctx(id))).status).toBe(400);
  });

  it("ändert oder löscht keine Aufgaben anderer Firmen", async () => {
    const id = (await db.task.findFirstOrThrow({ where: { organizationId: orgId, title: "Heute" } })).id;
    session = { ...session!, organizationId: otherOrgId };
    expect((await patchTask(req({ status: "DONE" }, "PATCH"), ctx(id))).status).toBe(404);
    expect((await deleteTask(req(undefined, "DELETE"), ctx(id))).status).toBe(404);
    expect((await createTask(req({ title: "x", emailId: ids.get("info-01") }), undefined)).status).toBe(404);
    expect((await db.task.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
  });
});
