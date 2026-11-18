/**
 * Phase 6 gegen die echte Datenbank: Regeln, Zuweisen, Kommentare, Labels,
 * Kategorien, Team-Verwaltung, Bearbeitungsverlauf und Tages-Digest
 * (Versand an einen lokalen SMTP-Testserver).
 */
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/server/defaults";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { storeMessage } from "@/server/mail/sync";

type Role = "ADMIN" | "MANAGER" | "MEMBER";
type Sess = { userId: string; name: string; email: string; role: Role; organizationId: string; organizationName: string };
let session: Sess | null = null;

vi.mock("@/server/session", async () => {
  const actual = await vi.importActual<typeof import("@/server/session")>("@/server/session");
  return {
    ...actual,
    assertSession: async (permission?: string) => {
      const { can } = await import("@/lib/rbac");
      if (!session) throw new actual.HttpError(401, "Nicht angemeldet");
      if (permission && !can(session.role, permission as never)) throw new actual.HttpError(403, "Keine Berechtigung");
      return session;
    },
  };
});
vi.mock("@/server/audit", () => ({
  audit: async (s: { organizationId: string; userId: string }, action: string, entity: { type: string; id?: string }, metadata?: object) => {
    const { db } = await import("@/lib/db");
    await db.auditLog.create({ data: { organizationId: s.organizationId, userId: s.userId, action, entityType: entity.type, entityId: entity.id, metadata } });
  },
}));

const rulesRoute = await import("@/app/api/rules/route");
const ruleRoute = await import("@/app/api/rules/[id]/route");
const previewRoute = await import("@/app/api/rules/preview/route");
const applyRoute = await import("@/app/api/rules/[id]/apply/route");
const emailRoute = await import("@/app/api/emails/[id]/route");
const commentsRoute = await import("@/app/api/emails/[id]/comments/route");
const commentRoute = await import("@/app/api/comments/[id]/route");
const emailLabelsRoute = await import("@/app/api/emails/[id]/labels/route");
const labelsRoute = await import("@/app/api/labels/route");
const labelRoute = await import("@/app/api/labels/[id]/route");
const categoriesRoute = await import("@/app/api/categories/route");
const categoryRoute = await import("@/app/api/categories/[id]/route");
const teamRoute = await import("@/app/api/team/route");
const teamMemberRoute = await import("@/app/api/team/[id]/route");
const { applyRules } = await import("@/server/rules/engine");
const { getEmailDetail } = await import("@/server/queries/email-detail");
const { listEmails } = await import("@/server/queries/emails");
const { collectDigest, renderDigest, isDigestEmpty } = await import("@/server/digest/build");
const { sendDigest, findDueDigests, setTransportForTests } = await import("@/server/digest/send");

const now = new Date("2026-11-18T07:30:00Z"); // Mittwoch, 08:30 Berlin
let orgId = "";
let otherOrgId = "";
const users: Record<"admin" | "manager" | "lea" | "tobias", Sess> = {} as never;
const ids = new Map<string, string>();
let mailboxId = "";

const req = (body?: unknown, method = body === undefined ? "GET" : "POST") =>
  new Request("http://localhost/x", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (u: keyof typeof users) => (session = users[u]);
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

beforeAll(async () => {
  const org = await db.organization.create({
    data: {
      name: "Phase6 GmbH",
      slug: `test-p6-${Date.now()}`,
      categories: { create: DEFAULT_CATEGORIES.map((c, i) => ({ key: c.key, name: c.name, description: c.description, autoCollapse: "autoCollapse" in c, isSystem: true, sortOrder: i })) },
    },
  });
  orgId = org.id;
  for (const [k, role, name] of [["admin", "ADMIN", "Anna Admin"], ["manager", "MANAGER", "Jonas Manager"], ["lea", "MEMBER", "Lea Mitarbeiterin"], ["tobias", "MEMBER", "Tobias Techniker"]] as const) {
    const u = await db.user.create({ data: { organizationId: orgId, name, email: `${k}-${Date.now()}@p6.local`, role, passwordHash: "x" } });
    users[k] = { userId: u.id, name, email: u.email, role, organizationId: orgId, organizationName: org.name };
  }
  const mb = await db.mailbox.create({ data: { organizationId: orgId, name: "Info", emailAddress: "info@p6.local", provider: "DEMO" } });
  mailboxId = mb.id;
  const demo = new DemoConnector("info", now, () => new Date(now.getTime() + 200 * 60_000));
  for (const d of ["info-04a", "info-04b", "info-04c", "info-01", "info-05", "info-06", "info-11", "info-23"]) {
    ids.set(d, (await storeMessage(mb, org, (await demo.fetchMessage(d))!))!);
  }
  await db.task.create({ data: { organizationId: orgId, emailId: ids.get("info-04c"), title: "Rückfragen beantworten", dueDate: new Date("2026-11-18T12:00:00Z") } });
  otherOrgId = (await db.organization.create({ data: { name: "Fremd", slug: `test-p6-other-${Date.now()}` } })).id;
});

afterAll(async () => {
  setTransportForTests(null);
  await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await db.$disconnect();
});

beforeEach(() => as("admin"));

describe("Regeln", () => {
  let labelId = "";
  let ruleId = "";

  it("legt eine Regel an (nur Admin/Manager) und prüft Verweise", async () => {
    labelId = (await json(await labelsRoute.POST(req({ name: "Reklamation", color: "red" }), undefined))).body.id;
    const input = {
      name: "Reklamationen an Tobias",
      conditions: { match: "any", items: [{ field: "any", op: "contains", value: "Reklamation" }, { field: "subject", op: "contains", value: "beschädigt" }] },
      actions: [
        { type: "assign", userId: users.tobias.userId },
        { type: "label", labelId },
        { type: "priority", priority: "HIGH" },
      ],
    };
    as("lea");
    expect((await rulesRoute.POST(req(input), undefined)).status).toBe(403);
    as("manager");
    const r = await json(await rulesRoute.POST(req(input), undefined));
    expect(r.status).toBe(200);
    ruleId = r.body.id;
    // Person einer anderen Firma → abgelehnt
    const bad = await json(await rulesRoute.POST(req({ ...input, actions: [{ type: "assign", userId: "fremd" }] }), undefined));
    expect(bad).toMatchObject({ status: 400, body: { error: "Unbekannte oder deaktivierte Person in der Regel" } });
  });

  it("Vorschau zeigt Treffer unter den letzten E-Mails", async () => {
    const r = await json(await previewRoute.POST(req({ conditions: { match: "all", items: [{ field: "subject", op: "contains", value: "Reklamation" }] } }), undefined));
    expect(r.body).toMatchObject({ matches: 1 });
    expect(r.body.examples[0].subject).toContain("Lieferung beschädigt");
    const all = await json(await previewRoute.POST(req({ conditions: { match: "all", items: [{ field: "mailbox", op: "equals", value: mailboxId }] } }), undefined));
    expect(all.body.matches).toBe(8);
  });

  it("wendet Regeln einmal an: zuweisen, Label, Priorität (geschützt vor KI), Zähler, Verlauf", async () => {
    const id = ids.get("info-05")!;
    expect(await applyRules(id)).toEqual({ matched: ["Reklamationen an Tobias"] });
    const e = await db.email.findUniqueOrThrow({ where: { id }, include: { labels: true } });
    expect(e).toMatchObject({ assigneeId: users.tobias.userId, priority: "HIGH", manualOverride: true, needsReview: false });
    expect(e.labels.map((l) => l.labelId)).toEqual([labelId]);
    expect(e.rulesAppliedAt).not.toBeNull();
    // Zweiter Aufruf: nichts mehr (einmal pro E-Mail)
    expect(await applyRules(id)).toEqual({ matched: [] });
    expect((await db.rule.findUniqueOrThrow({ where: { id: ruleId } })).matchCount).toBe(1);
    const detail = await getEmailDetail(orgId, id, { allowRemoteImages: false, showCosts: false });
    expect(detail!.activity.map((a) => `${a.who}: ${a.text}`)).toContain("Automatisch: Regel „Reklamationen an Tobias“ angewendet");
  });

  it("deaktivierte Regeln greifen nicht; nachträgliches Anwenden auf vorhandene E-Mails", async () => {
    await ruleRoute.PATCH(req({ enabled: false }, "PATCH"), ctx(ruleId));
    expect(await applyRules(ids.get("info-06")!)).toEqual({ matched: [] });
    await ruleRoute.PATCH(req({ enabled: true }, "PATCH"), ctx(ruleId));
    const r = await json(await applyRoute.POST(req({}), ctx(ruleId)));
    expect(r.body.matched).toBe(1); // info-05 erneut (Werte gleich) – info-06 enthält kein „Reklamation“
  });

  it("Label in Regel verhindert Löschen des Labels; Regel löschen geht", async () => {
    expect((await json(await labelRoute.DELETE(req(undefined, "DELETE"), ctx(labelId)))).body.error).toContain("Reklamationen an Tobias");
    expect((await ruleRoute.DELETE(req(undefined, "DELETE"), ctx(ruleId))).status).toBe(200);
    expect((await labelRoute.DELETE(req(undefined, "DELETE"), ctx(labelId))).status).toBe(200);
  });
});

describe("Zuweisen", () => {
  it("Mitarbeiterin darf nur selbst übernehmen; ganzer Verlauf, Status → In Bearbeitung, Aufgaben mit", async () => {
    const id = ids.get("info-04c")!;
    as("lea");
    expect((await emailRoute.PATCH(req({ assigneeId: users.tobias.userId }, "PATCH"), ctx(id))).status).toBe(403);
    const r = await json(await emailRoute.PATCH(req({ assigneeId: users.lea.userId }, "PATCH"), ctx(id)));
    expect(r.body.assignee).toMatchObject({ id: users.lea.userId });
    const thread = await db.email.findMany({ where: { id: { in: ["info-04a", "info-04b", "info-04c"].map((d) => ids.get(d)!) } } });
    expect(thread.every((e) => e.assigneeId === users.lea.userId && e.status === "IN_PROGRESS")).toBe(true);
    expect((await db.task.findFirstOrThrow({ where: { emailId: id } })).assigneeId).toBe(users.lea.userId);
  });

  it("Manager weist anderen zu; Filter „mir zugewiesen“; Verlauf nennt die Personen", async () => {
    const id = ids.get("info-04c")!;
    as("manager");
    await emailRoute.PATCH(req({ assigneeId: users.tobias.userId }, "PATCH"), ctx(id));
    const mine = await listEmails(orgId, { view: "open", sort: "newest", review: false, phishing: false, unread: false, assignee: "me" }, { showCosts: false, userId: users.tobias.userId });
    expect(mine.items.map((i) => i.id)).toContain(id);
    const detail = await getEmailDetail(orgId, id, { allowRemoteImages: false, showCosts: false });
    const texts = detail!.activity.map((a) => `${a.who}: ${a.text}`);
    expect(texts).toContain("Jonas Manager: hat an Tobias Techniker zugewiesen");
    expect(texts).toContain("Lea Mitarbeiterin: hat übernommen");
    expect(detail!.assignee).toMatchObject({ name: "Tobias Techniker" });
  });

  it("lehnt Personen anderer Firmen und deaktivierte Personen ab", async () => {
    as("manager");
    expect((await emailRoute.PATCH(req({ assigneeId: "gibt-es-nicht" }, "PATCH"), ctx(ids.get("info-01")!))).status).toBe(400);
  });
});

describe("Kommentare und Notizen", () => {
  it("gelten für den ganzen Verlauf; nur eigene bearbeiten, Admin darf löschen", async () => {
    as("lea");
    const c = await json(await commentsRoute.POST(req({ body: "Kundin hat angerufen, Antwort bis Mi 12 Uhr zugesagt.", isNote: true }), ctx(ids.get("info-04a")!)));
    expect(c.body).toMatchObject({ isNote: true, author: { name: "Lea Mitarbeiterin" } });
    // Sichtbar auch an der neuesten Mail des Verlaufs
    const d = await getEmailDetail(orgId, ids.get("info-04c")!, { allowRemoteImages: false, showCosts: false });
    expect(d!.comments.map((x) => x.body)).toContain("Kundin hat angerufen, Antwort bis Mi 12 Uhr zugesagt.");
    as("tobias");
    expect((await commentRoute.PATCH(req({ body: "geändert" }, "PATCH"), ctx(c.body.id))).status).toBe(403);
    expect((await commentRoute.DELETE(req(undefined, "DELETE"), ctx(c.body.id))).status).toBe(403);
    as("admin");
    expect((await commentRoute.DELETE(req(undefined, "DELETE"), ctx(c.body.id))).status).toBe(200);
    expect((await commentsRoute.POST(req({ body: "   " }), ctx(ids.get("info-01")!))).status).toBe(400);
  });
});

describe("Labels an E-Mails und Kategorien", () => {
  it("setzt/entfernt Labels; Filter nach Label", async () => {
    const label = (await json(await labelsRoute.POST(req({ name: "VIP", color: "violet" }), undefined))).body;
    expect((await labelsRoute.POST(req({ name: "VIP" }), undefined)).status).toBe(409);
    await emailLabelsRoute.POST(req({ labelId: label.id, on: true }), ctx(ids.get("info-01")!));
    const page = await listEmails(orgId, { view: "all", sort: "newest", review: false, phishing: false, unread: false, label: label.id }, { showCosts: false });
    expect(page.items.map((i) => i.id)).toEqual([ids.get("info-01")]);
    expect(page.items[0]!.labels).toEqual([{ id: label.id, name: "VIP", color: "violet" }]);
    await emailLabelsRoute.POST(req({ labelId: label.id, on: false }), ctx(ids.get("info-01")!));
    expect((await listEmails(orgId, { view: "all", sort: "newest", review: false, phishing: false, unread: false, label: label.id }, { showCosts: false })).items).toEqual([]);
  });

  it("eigene Kategorie anlegen (Schlüssel aus Name), „einklappen“ wirkt sofort, Standard-Kategorien nicht löschbar", async () => {
    const c = (await json(await categoriesRoute.POST(req({ name: "Projekt Phönix", description: "Alles zum Großprojekt Phönix" }), undefined))).body;
    expect(c.key).toBe("projekt-phoenix");
    await db.email.update({ where: { id: ids.get("info-11")! }, data: { categoryId: c.id } });
    await categoryRoute.PATCH(req({ autoCollapse: true }, "PATCH"), ctx(c.id));
    expect((await db.email.findUniqueOrThrow({ where: { id: ids.get("info-11")! } })).isCollapsed).toBe(true);
    const sys = await db.category.findFirstOrThrow({ where: { organizationId: orgId, key: "kunde" } });
    expect((await categoryRoute.DELETE(req(undefined, "DELETE"), ctx(sys.id))).status).toBe(409);
    expect((await categoryRoute.DELETE(req(undefined, "DELETE"), ctx(c.id))).status).toBe(200);
    as("lea");
    expect((await categoriesRoute.POST(req({ name: "X" }), undefined)).status).toBe(403);
  });
});

describe("Team-Verwaltung", () => {
  it("Admin legt Person an (Startpasswort einmalig), Schutz für eigene Rolle und letzten Admin", async () => {
    const r = await json(await teamRoute.POST(req({ name: "Neu Person", email: `neu-${Date.now()}@p6.local`, role: "MEMBER" }), undefined));
    expect(r.body.initialPassword).toMatch(/^[A-Za-z0-9]{14}$/);
    expect((await teamRoute.POST(req({ name: "Doppelt", email: users.lea.email }), undefined)).status).toBe(409);
    expect((await json(await teamMemberRoute.PATCH(req({ role: "MEMBER" }, "PATCH"), ctx(users.admin.userId)))).body.error).toContain("selbst");
    as("manager");
    expect((await teamRoute.POST(req({ name: "X", email: "x@p6.local" }), undefined)).status).toBe(403);
  });

  it("Deaktivieren entfernt offene Zuweisungen", async () => {
    await teamMemberRoute.PATCH(req({ isActive: false }, "PATCH"), ctx(users.tobias.userId));
    expect(await db.email.count({ where: { assigneeId: users.tobias.userId, status: { not: "DONE" } } })).toBe(0);
    await teamMemberRoute.PATCH(req({ isActive: true }, "PATCH"), ctx(users.tobias.userId));
  });
});

describe("Tages-Digest", () => {
  it("enthält Zugewiesenes, Wichtiges, Fälliges und die Phishing-Warnung", async () => {
    as("manager");
    await emailRoute.PATCH(req({ assigneeId: users.lea.userId }, "PATCH"), ctx(ids.get("info-01")!));
    await db.email.update({ where: { id: ids.get("info-01")! }, data: { priority: "URGENT", summary: "Anlage 3 der Stadtwerke ist ausgefallen." } });
    const d = await collectDigest(users.lea.userId, now);
    expect(d.assigned.map((e) => e.id)).toContain(ids.get("info-01"));
    expect(d.counts.phishing).toBe(1);
    expect(d.tasks.map((t) => t.title)).toContain("Rückfragen beantworten");
    expect(isDigestEmpty(d)).toBe(false);
    const { subject, html, text } = renderDigest(d, "https://mailmind.example");
    expect(subject).toMatch(/^MailMind – dein Tag: \d+ dir zugewiesen/);
    expect(html).toContain("Guten Morgen, Lea");
    expect(html).toContain("Möglicher Phishing-Versuch");
    expect(html).toContain("https://mailmind.example/inbox?view=all&amp;id=");
    expect(html).not.toMatch(/<script/i);
    expect(text).toContain("DIR ZUGEWIESEN");
  });

  it("verschickt per SMTP und protokolliert; ohne SMTP kein Versand", async () => {
    const received: { to: string; data: string }[] = [];
    const smtp = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS"],
      onData(stream, sess, cb) {
        let data = "";
        stream.on("data", (c) => (data += c));
        stream.on("end", () => {
          received.push({ to: sess.envelope.rcptTo.map((r) => r.address).join(","), data });
          cb();
        });
      },
    });
    await new Promise<void>((r) => smtp.listen(0, "127.0.0.1", r));
    const port = (smtp.server.address() as AddressInfo).port;

    setTransportForTests(null);
    const before = process.env.SMTP_URL;
    delete process.env.SMTP_URL;
    expect((await sendDigest(users.lea.userId, { now })).status).toBe("no_smtp");

    setTransportForTests(nodemailer.createTransport({ host: "127.0.0.1", port, secure: false, ignoreTLS: true }));
    const r = await sendDigest(users.lea.userId, { now });
    expect(r.status).toBe("sent");
    expect(received[0]!.to).toBe(users.lea.email);
    expect(received[0]!.data).toContain("Content-Type: text/html");
    expect(await db.digestLog.count({ where: { userId: users.lea.userId, success: true } })).toBe(1);
    await new Promise<void>((res) => smtp.close(() => res()));
    if (before) process.env.SMTP_URL = before;
  });

  it("Zeitplan: ab der eingestellten Stunde, nur werktags, einmal pro Tag, nur mit Opt-in", async () => {
    await db.organization.update({ where: { id: orgId }, data: { digestHour: 7, digestEnabled: true } });
    await db.user.update({ where: { id: users.tobias.userId }, data: { digestOptIn: false } });
    const due = await findDueDigests(now); // Mi 08:30 Berlin
    expect(due).toContain(users.admin.userId);
    expect(due).not.toContain(users.lea.userId); // heute schon verschickt
    expect(due).not.toContain(users.tobias.userId); // abgemeldet
    expect(await findDueDigests(new Date("2026-11-18T05:30:00Z"))).not.toContain(users.admin.userId); // 06:30 – zu früh
    expect(await findDueDigests(new Date("2026-11-21T09:00:00Z"))).not.toContain(users.admin.userId); // Samstag
    await db.organization.update({ where: { id: orgId }, data: { digestWeekdaysOnly: false } });
    expect(await findDueDigests(new Date("2026-11-21T09:00:00Z"))).toContain(users.admin.userId);
  });

  it("leerer Digest wird übersprungen", async () => {
    const empty = await db.organization.create({ data: { name: "Leer", slug: `test-p6-leer-${Date.now()}` } });
    const u = await db.user.create({ data: { organizationId: empty.id, name: "Leer", email: `leer-${Date.now()}@p6.local`, passwordHash: "x" } });
    expect((await sendDigest(u.id, { now })).status).toBe("skipped_empty");
    await db.organization.delete({ where: { id: empty.id } });
  });
});
