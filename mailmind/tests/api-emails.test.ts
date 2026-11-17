/**
 * API-Routen des Posteingangs gegen die echte Datenbank. Die Anmeldung
 * (NextAuth) und das Audit-Log (next/headers) werden ersetzt.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/server/defaults";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { storeMessage } from "@/server/mail/sync";

type Sess = { userId: string; name: string; email: string; role: "ADMIN" | "MANAGER" | "MEMBER"; organizationId: string; organizationName: string };
let session: Sess | null = null;
const audits: { action: string; entityId?: string }[] = [];

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
  audit: async (_s: unknown, action: string, entity: { id?: string }) => {
    audits.push({ action, entityId: entity.id });
    const { db } = await import("@/lib/db");
    if (session) await db.auditLog.create({ data: { organizationId: session.organizationId, userId: session.userId, action, entityType: "email", entityId: entity.id } });
  },
}));

const { GET: listGET } = await import("@/app/api/emails/route");
const { GET: detailGET, PATCH } = await import("@/app/api/emails/[id]/route");
const { POST: openPOST } = await import("@/app/api/emails/[id]/open/route");
const { POST: statusPOST } = await import("@/app/api/emails/[id]/status/route");
const { POST: restorePOST } = await import("@/app/api/emails/restore-status/route");

const anchor = new Date("2026-11-17T08:00:00Z");
let orgId = "";
let otherOrgId = "";
let admin: Sess;
let member: Sess;
const ids = new Map<string, string>();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (url: string, body?: unknown, method = body ? "POST" : "GET") =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  const org = await db.organization.create({
    data: {
      name: "API-Test",
      slug: `test-api-${Date.now()}`,
      categories: { create: DEFAULT_CATEGORIES.map((c, i) => ({ key: c.key, name: c.name, description: c.description, autoCollapse: "autoCollapse" in c, sortOrder: i })) },
    },
  });
  orgId = org.id;
  const a = await db.user.create({ data: { organizationId: orgId, name: "Anna Admin", email: `a-${Date.now()}@t.local`, passwordHash: "x", role: "ADMIN" } });
  const m = await db.user.create({ data: { organizationId: orgId, name: "Max Mitarbeiter", email: `m-${Date.now()}@t.local`, passwordHash: "x", role: "MEMBER" } });
  admin = { userId: a.id, name: a.name, email: a.email, role: "ADMIN", organizationId: orgId, organizationName: org.name };
  member = { ...admin, userId: m.id, name: m.name, email: m.email, role: "MEMBER" };
  const mb = await db.mailbox.create({ data: { organizationId: orgId, name: "Info", emailAddress: "info@test.local", provider: "DEMO" } });
  const demo = new DemoConnector("info", anchor, () => new Date(anchor.getTime() + 200 * 60_000));
  for (const d of ["info-04a", "info-04b", "info-04c", "info-01", "info-23", "info-05"]) {
    ids.set(d, (await storeMessage(mb, org, (await demo.fetchMessage(d))!))!);
  }
  await db.email.update({ where: { id: ids.get("info-05")! }, data: { aiModels: ["claude-sonnet-5-5"], aiCostUsd: 0.0123 } });
  otherOrgId = (await db.organization.create({ data: { name: "Fremd", slug: `test-api-other-${Date.now()}` } })).id;
});

afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await db.$disconnect();
});

beforeEach(() => {
  session = admin;
  audits.length = 0;
});

describe("GET /api/emails", () => {
  it("verlangt eine Anmeldung", async () => {
    session = null;
    expect((await listGET(req("/api/emails"), undefined)).status).toBe(401);
  });

  it("liefert Thread-Zeilen; Kosten nur für Admins", async () => {
    const r = await (await listGET(req("/api/emails?view=all"), undefined)).json();
    expect(r.items).toHaveLength(4); // 3 Mails des Weber-Threads → 1 Zeile
    expect(r.items.find((i: { id: string }) => i.id === ids.get("info-05")).aiCostUsd).toBeCloseTo(0.0123);
    session = member;
    const m = await (await listGET(req("/api/emails?view=all"), undefined)).json();
    const row = m.items.find((i: { id: string }) => i.id === ids.get("info-05"));
    expect(row.aiCostUsd).toBe(0);
    expect(row.aiModels).toEqual([]);
  });
});

describe("GET /api/emails/:id", () => {
  it("ist seiteneffektfrei (Vorladen markiert nichts als gelesen)", async () => {
    const id = ids.get("info-01")!;
    const r = await detailGET(req(`/api/emails/${id}`), ctx(id));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.subject).toContain("Anlage 3");
    expect((await db.email.findUniqueOrThrow({ where: { id } })).isRead).toBe(false);
    expect(audits).toEqual([]);
  });

  it("liefert den Verlauf und die Phishing-Markierung", async () => {
    const d = await (await detailGET(req(`/api/emails/${ids.get("info-04c")}`), ctx(ids.get("info-04c")!))).json();
    expect(d.thread.messages).toHaveLength(3);
    const p = await (await detailGET(req(`/api/emails/${ids.get("info-23")}`), ctx(ids.get("info-23")!))).json();
    expect(p.phishingSuspected).toBe(true);
  });

  it("gibt E-Mails anderer Firmen nicht heraus", async () => {
    session = { ...admin, organizationId: otherOrgId };
    expect((await detailGET(req(`/api/emails/${ids.get("info-01")}`), ctx(ids.get("info-01")!))).status).toBe(404);
  });
});

describe("POST /api/emails/:id/open", () => {
  it("markiert als gelesen und protokolliert das Öffnen nur einmal pro 30 Minuten", async () => {
    const id = ids.get("info-01")!;
    await openPOST(req(`/api/emails/${id}/open`, {}), ctx(id));
    await openPOST(req(`/api/emails/${id}/open`, {}), ctx(id));
    expect((await db.email.findUniqueOrThrow({ where: { id } })).isRead).toBe(true);
    expect(await db.auditLog.count({ where: { organizationId: orgId, action: "email.view", entityId: id } })).toBe(1);
  });
});

describe("Erledigen + Rückgängig", () => {
  it("setzt den ganzen Verlauf auf erledigt und kann es zurücknehmen", async () => {
    await db.email.update({ where: { id: ids.get("info-04b")! }, data: { status: "WAITING" } });
    const id = ids.get("info-04c")!;
    const r = await (await statusPOST(req(`/api/emails/${id}/status`, { status: "DONE" }), ctx(id))).json();
    expect(r.previous).toHaveLength(3);
    const thread = await db.email.findMany({ where: { id: { in: ["info-04a", "info-04b", "info-04c"].map((d) => ids.get(d)!) } } });
    expect(thread.every((e) => e.status === "DONE")).toBe(true);

    await restorePOST(req("/api/emails/restore-status", { items: r.previous }), undefined);
    expect((await db.email.findUniqueOrThrow({ where: { id: ids.get("info-04b")! } })).status).toBe("WAITING");
    expect((await db.email.findUniqueOrThrow({ where: { id } })).status).toBe("NEW");
  });

  it("Rückgängig kann keine fremden E-Mails ändern", async () => {
    const foreign = await db.mailbox.create({ data: { organizationId: otherOrgId, name: "X", emailAddress: "x@t.local", provider: "DEMO" } });
    const fid = (await storeMessage(foreign, { id: otherOrgId }, (await new DemoConnector("info", anchor).fetchMessage("info-05"))!))!;
    await restorePOST(req("/api/emails/restore-status", { items: [{ id: fid, status: "DONE" }] }), undefined);
    expect((await db.email.findUniqueOrThrow({ where: { id: fid } })).status).toBe("NEW");
  });
});

describe("PATCH /api/emails/:id", () => {
  it("„Einordnung passt“ entfernt „Bitte prüfen“ ohne Korrektur", async () => {
    const id = ids.get("info-05")!;
    await db.email.update({ where: { id }, data: { needsReview: true, reviewReason: "x" } });
    const r = await (await PATCH(req(`/api/emails/${id}`, { confirmReview: true }, "PATCH"), ctx(id))).json();
    expect(r).toMatchObject({ needsReview: false, correctionsSaved: 0 });
  });

  it("Prioritätsänderung speichert eine Korrektur", async () => {
    const id = ids.get("info-05")!;
    const r = await (await PATCH(req(`/api/emails/${id}`, { priority: "URGENT" }, "PATCH"), ctx(id))).json();
    expect(r.correctionsSaved).toBe(1);
    expect(await db.classificationCorrection.count({ where: { organizationId: orgId, field: "priority", toValue: "URGENT" } })).toBe(1);
  });

  it("lehnt leere oder ungültige Änderungen ab", async () => {
    const id = ids.get("info-05")!;
    expect((await PATCH(req(`/api/emails/${id}`, {}, "PATCH"), ctx(id))).status).toBe(400);
    expect((await PATCH(req(`/api/emails/${id}`, { priority: "SEHR_HOCH" }, "PATCH"), ctx(id))).status).toBe(400);
  });
});
