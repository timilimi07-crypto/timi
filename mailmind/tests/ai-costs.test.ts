/**
 * Integrationstest: KI-Kostenauswertung (Dashboard) gegen die echte Datenbank.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeCostUsd } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { getAiCostStats } from "@/server/queries/ai-costs";

let orgId = "";
let otherOrgId = "";
const HOUR = 3600_000;

/** Ein Zeitpunkt, der sicher „heute“ in Berlin liegt (kurz nach Mitternacht Berliner Zeit + 1 h oder jetzt). */
function safelyToday(): Date {
  return new Date(Date.now() - 60_000);
}

async function log(organizationId: string, model: string, input: number, output: number, createdAt: Date) {
  await db.aiUsageLog.create({
    data: {
      organizationId,
      operation: "analyze",
      model,
      inputTokens: input,
      outputTokens: output,
      costUsd: computeCostUsd(model, { inputTokens: input, outputTokens: output }),
      createdAt,
    },
  });
}

beforeAll(async () => {
  orgId = (await db.organization.create({ data: { name: "Kosten-Test", slug: `test-costs-${Date.now()}` } })).id;
  otherOrgId = (await db.organization.create({ data: { name: "Andere Firma", slug: `test-costs-other-${Date.now()}` } })).id;
  const now = safelyToday();
  await log(orgId, "claude-sonnet-5-5", 3000, 600, now); // 0,012 $
  await log(orgId, "claude-haiku-5-5", 1000, 200, now); // 0,0002 $
  await log(orgId, "claude-sonnet-5-5", 3000, 600, new Date(now.getTime() - 26 * HOUR)); // gestern (oder Vormonat am 1.)
  await log(orgId, "claude-opus-5-5", 3000, 600, new Date(now.getTime() - 40 * 24 * HOUR)); // > 30 Tage, Vormonat
  await log(otherOrgId, "claude-opus-5-5", 1_000_000, 100_000, now); // andere Firma – darf nicht zählen
});

afterAll(async () => {
  await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await db.$disconnect();
});

describe("getAiCostStats", () => {
  it("summiert die heutigen Kosten nur der eigenen Firma", async () => {
    const s = await getAiCostStats(orgId);
    expect(s.today).toBeCloseTo(0.0122, 6);
  });

  it("liefert eine lückenlose 30-Tage-Reihe mit Aufteilung nach Modell", async () => {
    const s = await getAiCostStats(orgId);
    expect(s.daily).toHaveLength(30);
    const today = s.daily.at(-1)!;
    expect(today.byModel["claude-sonnet-5-5"]).toBeCloseTo(0.012, 6);
    expect(today.byModel["claude-haiku-5-5"]).toBeCloseTo(0.0002, 6);
    // Der Opus-Eintrag vor 40 Tagen liegt außerhalb der Reihe.
    expect(s.daily.some((d) => d.byModel["claude-opus-5-5"])).toBe(false);
  });

  it("berechnet Monatssumme, Aufrufe und Hochrechnung konsistent", async () => {
    const s = await getAiCostStats(orgId);
    const modelSum = s.byModelMonth.reduce((a, m) => a + m.cost, 0);
    expect(s.month).toBeCloseTo(modelSum, 6);
    expect(s.callsMonth).toBe(s.byModelMonth.reduce((a, m) => a + m.calls, 0));
    expect(s.monthForecast).toBeGreaterThanOrEqual(s.month);
    expect(s.month).toBeGreaterThanOrEqual(0.0122 - 1e-9);
  });

  it("liefert für eine Firma ohne Aufrufe Nullwerte", async () => {
    const empty = await db.organization.create({ data: { name: "Leer", slug: `test-costs-empty-${Date.now()}` } });
    const s = await getAiCostStats(empty.id);
    expect(s).toMatchObject({ today: 0, month: 0, previousMonth: 0, callsMonth: 0, byModelMonth: [] });
    await db.organization.delete({ where: { id: empty.id } });
  });
});
