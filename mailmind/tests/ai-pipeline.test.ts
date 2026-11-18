/**
 * KI-Pipeline gegen die echte Datenbank, mit simuliertem Claude-Aufruf.
 * Prüft Routing (Haiku/Sonnet), „nur einmal auswerten“, „Bitte prüfen“,
 * Kosten pro E-Mail, Maskierung, Prompt-Caching-Aufbau, Korrekturen als
 * Beispiele, manuelle Übersteuerung, Tageslimit und inkrementelle Thread-Zusammenfassung.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { AiCallParams, AiCaller } from "@/server/ai/client";
import { processEmail, recordCorrection, summarizeThread } from "@/server/ai/pipeline";
import { DEFAULT_CATEGORIES } from "@/server/defaults";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { storeMessage } from "@/server/mail/sync";
import type { z } from "zod";

type Call = { operation: string; model: string; system: { text: string; cache: boolean }[]; user: string };
type Responder = (p: AiCallParams<z.ZodType>) => unknown | { __refuse: true };

const anchor = new Date("2026-11-17T08:00:00Z");
let orgId = "";
let userId = "";
let mailbox: { id: string; organizationId: string; emailAddress: string };
let calls: Call[] = [];
let responder: Responder;

/** Simulierter Claude-Aufruf: meldet Tokens/Kosten wie der echte Client. */
const fakeCaller: AiCaller = async (p) => {
  calls.push({ operation: p.operation, model: p.model, system: p.system, user: p.user });
  const out = responder(p as AiCallParams<z.ZodType>);
  const cost = p.model.includes("haiku") ? 0.0004 : 0.012;
  await p.onAttempt?.({
    operation: p.operation,
    model: p.model,
    attempt: 1,
    success: !(out as { __refuse?: boolean }).__refuse,
    inputTokens: 1000,
    outputTokens: 200,
    cacheReadTokens: 1500,
    cacheWriteTokens: 0,
    costUsd: cost,
    durationMs: 5,
  });
  if ((out as { __refuse?: boolean }).__refuse) return { ok: false, refused: true, error: "Auswertung abgelehnt (cyber)", model: p.model };
  return { ok: true, data: p.schema.parse(out), model: p.model };
};
const deps = { caller: fakeCaller, now: () => anchor };

const demo = new DemoConnector("info", anchor, () => new Date(anchor.getTime() + 200 * 60_000));
async function store(id: string) {
  const msg = await demo.fetchMessage(id);
  const emailId = await storeMessage(mailbox, { id: orgId }, msg!);
  return emailId!;
}

const triage = (category: string, confidence = 0.92, isBulk = false) => ({
  category,
  categoryConfidence: confidence,
  isBulk,
  summary: `Kurz: ${category}`,
  phishing: false,
  phishingReason: null,
});
const analysis = (over: Record<string, unknown> = {}) => ({
  summary: "Stadtwerke Kassel melden Ausfall von Anlage 3 und fordern heute einen Techniker.",
  category: "kunde",
  categoryConfidence: 0.95,
  priority: "URGENT",
  priorityConfidence: 0.93,
  priorityReason: "Produktionsstillstand, 4 h Reaktionszeit",
  sentiment: "NEGATIVE",
  tasks: [
    { title: "Techniker zu Stadtwerke Kassel schicken", dueDate: "2026-11-17", dueDateText: "heute" },
    { title: "Rückruf an Dr. Brandt", dueDate: "kein-datum", dueDateText: null },
  ],
  entities: [
    { type: "ORDER_NUMBER", label: "Wartungsvertrag", value: "WV-2024-118", normalizedValue: null },
    { type: "PHONE", label: "Telefon", value: "[TELEFON]", normalizedValue: null },
  ],
  ...over,
});

beforeAll(async () => {
  const org = await db.organization.create({
    data: {
      name: "Pipeline-Test GmbH",
      slug: `test-ai-${Date.now()}`,
      categories: { create: DEFAULT_CATEGORIES.map((c, i) => ({ key: c.key, name: c.name, description: c.description, color: c.color, autoCollapse: "autoCollapse" in c, sortOrder: i })) },
    },
  });
  orgId = org.id;
  userId = (await db.user.create({ data: { organizationId: orgId, name: "Lea Test", email: `lea-${Date.now()}@test.local`, passwordHash: "x" } })).id;
  mailbox = await db.mailbox.create({
    data: { organizationId: orgId, name: "Info", emailAddress: "info@mueller-partner.de", provider: "DEMO" },
    select: { id: true, organizationId: true, emailAddress: true },
  });
});

afterAll(async () => {
  await db.organization.delete({ where: { id: orgId } });
  await db.$disconnect();
});

beforeEach(() => {
  calls = [];
});

describe("processEmail", () => {
  it("Newsletter: nur Vorsortierung mit Haiku, keine Hauptanalyse, eingeklappt", async () => {
    responder = () => triage("newsletter", 0.97, true);
    const id = await store("info-18");
    const r = await processEmail(id, deps);

    expect(r).toMatchObject({ status: "done", path: "triage-only" });
    expect(calls.map((c) => [c.operation, c.model])).toEqual([["triage", "claude-haiku-5-5"]]);
    const e = await db.email.findUniqueOrThrow({ where: { id }, include: { category: true } });
    expect(e).toMatchObject({ aiStatus: "DONE", isCollapsed: true, priority: "LOW", needsReview: false, aiModels: ["claude-haiku-5-5"] });
    expect(e.category?.key).toBe("newsletter");
    expect(Number(e.aiCostUsd)).toBeCloseTo(0.0004, 6);
  });

  it("Kundenmail: Haiku-Triage + Sonnet-Analyse, Aufgaben, Daten, Kosten summiert", async () => {
    responder = (p) => (p.operation === "triage" ? triage("kunde") : analysis());
    const id = await store("info-01");
    const r = await processEmail(id, deps);

    expect(r).toMatchObject({ status: "done", path: "full", needsReview: false });
    expect(calls.map((c) => c.model)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
    const e = await db.email.findUniqueOrThrow({ where: { id }, include: { tasks: true, entities: true } });
    expect(e).toMatchObject({ priority: "URGENT", sentiment: "NEGATIVE", aiModels: ["claude-haiku-5-5", "claude-sonnet-5-5"] });
    expect(Number(e.aiCostUsd)).toBeCloseTo(0.0124, 6);
    expect(e.tasks).toHaveLength(2);
    expect(e.tasks.find((t) => t.title.startsWith("Techniker"))?.dueDate?.toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(e.tasks.find((t) => t.title.startsWith("Rückruf"))?.dueDate).toBeNull(); // ungültiges Datum verworfen
    // Platzhalter werden nicht als erkannte Daten gespeichert.
    expect(e.entities.map((x) => x.value)).toEqual(["WV-2024-118"]);
    // Kostenprotokoll: ein Eintrag je Aufruf, der E-Mail zugeordnet.
    expect(await db.aiUsageLog.count({ where: { emailId: id } })).toBe(2);
  });

  it("wertet jede E-Mail nur einmal aus", async () => {
    const e = await db.email.findFirstOrThrow({ where: { mailboxId: mailbox.id, providerMessageId: "info-01" } });
    expect(await processEmail(e.id, deps)).toEqual({ status: "already" });
    expect(calls).toHaveLength(0);
  });

  it("markiert unsichere Einordnungen mit „Bitte prüfen“", async () => {
    responder = (p) =>
      p.operation === "triage" ? triage("kunde", 0.6) : analysis({ category: "support", categoryConfidence: 0.55, priorityConfidence: 0.62, priority: "NORMAL" });
    const id = await store("info-06");
    const r = await processEmail(id, deps);
    expect(r).toMatchObject({ status: "done", needsReview: true });
    const e = await db.email.findUniqueOrThrow({ where: { id } });
    expect(e.needsReview).toBe(true);
    expect(e.reviewReason).toBe("Kategorie unsicher (55 %), Priorität unsicher (62 %)");
  });

  it("unsicherer Newsletter wird trotzdem vollständig analysiert", async () => {
    responder = (p) => (p.operation === "triage" ? triage("newsletter", 0.5, true) : analysis({ category: "lieferant", priority: "LOW" }));
    const id = await store("info-12");
    expect(await processEmail(id, deps)).toMatchObject({ path: "full" });
  });

  it("maskiert IBAN und Telefonnummern vor dem Aufruf", async () => {
    // info-01 enthält Telefonnummern; Buchhaltungs-Mail mit IBAN simulieren:
    responder = (p) => (p.operation === "triage" ? triage("rechnung") : analysis({ category: "rechnung", priority: "HIGH" }));
    const msg = await new DemoConnector("buchhaltung", anchor).fetchMessage("bh-01");
    const id = (await storeMessage(mailbox, { id: orgId }, { ...msg!, providerMessageId: "bh-01-test" }))!;
    await processEmail(id, deps);
    for (const c of calls) {
      expect(c.user).not.toContain("DE89 3704");
      expect(c.user).toContain("[IBAN]");
    }
  });

  it("baut den System-Prompt cache-freundlich: statischer Block + Firmenblock, beide gecacht, byte-identisch", async () => {
    responder = (p) => (p.operation === "triage" ? triage("intern") : analysis({ category: "intern", priority: "NORMAL" }));
    const a = await store("info-14");
    const b = await store("info-15");
    await processEmail(a, deps);
    await processEmail(b, deps);
    const analyses = calls.filter((c) => c.operation === "analyze");
    expect(analyses).toHaveLength(2);
    expect(analyses[0]!.system.map((s) => s.cache)).toEqual([true, true]);
    expect(analyses[0]!.system).toEqual(analyses[1]!.system); // gleicher Präfix → Cache-Treffer
    expect(analyses[0]!.system[1]!.text).toContain("- kunde: Kunde – ");
    // Variable Daten (Datum) stehen nur in der Nutzer-Nachricht.
    expect(analyses[0]!.system.map((s) => s.text).join("")).not.toMatch(/2026/);
    expect(analyses[0]!.user).toContain("Empfangen: ");
  });

  it("Korrekturen fließen als Beispiele in den Firmenblock (neueste zuerst)", async () => {
    const e = await db.email.findFirstOrThrow({ where: { mailboxId: mailbox.id, providerMessageId: "info-06" } });
    await recordCorrection({ organizationId: orgId, emailId: e.id, userId, field: "category", fromValue: "kunde", toValue: "support", subject: e.subject, fromEmail: e.fromEmail, mask: true });
    await db.classificationCorrection.create({
      data: { organizationId: orgId, field: "priority", fromValue: "NORMAL", toValue: "HIGH", subject: "Rahmenvertrag", senderDomain: "kaeltetechnik-nord.de", createdAt: new Date(Date.now() + 1000) },
    });

    responder = (p) => (p.operation === "triage" ? triage("support") : analysis({ category: "support", priority: "HIGH" }));
    const id = await store("info-30");
    await processEmail(id, deps);
    const orgBlock = calls[0]!.system[1]!.text;
    expect(orgBlock).toContain("„Rahmenvertrag“ (Absender-Domain kaeltetechnik-nord.de): Priorität Normal → korrigiert zu Hoch");
    expect(orgBlock).toContain("Kategorie Kunde → korrigiert zu Support");
    expect(orgBlock.indexOf("Rahmenvertrag")).toBeLessThan(orgBlock.indexOf("Fehlercode"));
  });

  it("überschreibt manuell gesetzte Kategorie/Priorität nicht", async () => {
    const id = await store("info-25");
    const intern = await db.category.findFirstOrThrow({ where: { organizationId: orgId, key: "intern" } });
    await db.email.update({ where: { id }, data: { manualOverride: true, categoryId: intern.id, priority: "LOW" } });
    responder = (p) => (p.operation === "triage" ? triage("kunde") : analysis({ priority: "HIGH", categoryConfidence: 0.3 }));
    await processEmail(id, deps);
    const e = await db.email.findUniqueOrThrow({ where: { id } });
    expect(e).toMatchObject({ categoryId: intern.id, priority: "LOW", needsReview: false, aiStatus: "DONE" });
    expect(e.summary).toBeTruthy();
  });

  it("Ablehnung durch die KI → fehlgeschlagen und „Bitte prüfen“", async () => {
    responder = () => ({ __refuse: true });
    const id = await store("info-22");
    expect(await processEmail(id, deps)).toMatchObject({ status: "failed", refused: true });
    const e = await db.email.findUniqueOrThrow({ where: { id } });
    expect(e).toMatchObject({ aiStatus: "FAILED", needsReview: true });
  });

  it("API-Ausfall: Status wird zurückgesetzt, ein späterer Versuch übernimmt die E-Mail", async () => {
    const id = await store("info-29");
    responder = () => {
      throw new Error("529 overloaded");
    };
    await expect(processEmail(id, deps)).rejects.toThrow("529");
    expect((await db.email.findUniqueOrThrow({ where: { id } })).aiStatus).toBe("PENDING");
    responder = (p) => (p.operation === "triage" ? triage("kunde") : analysis({ priority: "LOW", sentiment: "POSITIVE" }));
    expect(await processEmail(id, deps)).toMatchObject({ status: "done" });
  });

  it("Phishing: Heuristik beim Abruf + KI, Warnung bleibt sichtbar (nicht eingeklappt)", async () => {
    const id = await store("info-23");
    const before = await db.email.findUniqueOrThrow({ where: { id } });
    expect(before.phishingSuspected).toBe(true); // sofort beim Abruf, ohne KI
    expect(before.phishingReason).toContain("Behauptet gesperrtes Konto");

    responder = () => ({ ...triage("spam", 0.97, true), phishing: true, phishingReason: "Fordert Bestätigung der Identität über fremde Domain" });
    await processEmail(id, deps);
    const e = await db.email.findUniqueOrThrow({ where: { id } });
    expect(e).toMatchObject({ phishingSuspected: true, isCollapsed: false, priority: "LOW" });
    expect(e.phishingReason).toContain("KI: Fordert Bestätigung");
  });

  it("KI allein kann Phishing melden, auch wenn die Heuristik nichts findet", async () => {
    const id = await store("info-24");
    expect((await db.email.findUniqueOrThrow({ where: { id } })).phishingSuspected).toBe(false);
    responder = () => ({ ...triage("spam", 0.95, true), phishing: true, phishingReason: "Lockt mit kostenloser Analyse auf fremde Seite" });
    await processEmail(id, deps);
    expect(await db.email.findUniqueOrThrow({ where: { id } })).toMatchObject({ phishingSuspected: true, isCollapsed: false });
  });

  it("verschiebt die Auswertung, wenn das KI-Tageslimit erreicht ist", async () => {
    await db.organization.update({ where: { id: orgId }, data: { aiDailyEmailLimit: 1 } });
    const id = await store("info-28");
    const r = await processEmail(id, deps);
    expect(r).toMatchObject({ status: "deferred", reason: "daily_limit" });
    expect(calls).toHaveLength(0);
    expect((await db.email.findUniqueOrThrow({ where: { id } })).aiStatus).toBe("PENDING");
    await db.organization.update({ where: { id: orgId }, data: { aiDailyEmailLimit: 500 } });
  });
});

describe("summarizeThread", () => {
  it("erst vollständig, bei neuer Antwort nur inkrementell – ohne erneute Einzelanalyse", async () => {
    responder = (p) =>
      p.operation === "thread_summary"
        ? { summary: `Zusammenfassung #${calls.filter((c) => c.operation === "thread_summary").length}` }
        : p.operation === "triage"
          ? triage("kunde")
          : analysis({ summary: `Einzel: ${p.user.match(/Betreff: (.*)/)?.[1]}` });

    const a = await store("info-04a");
    const b = await store("info-04b");
    await processEmail(a, deps);
    await processEmail(b, deps);
    const threadId = (await db.email.findUniqueOrThrow({ where: { id: a } })).threadId!;

    calls = [];
    expect(await summarizeThread(threadId, deps)).toEqual({ status: "updated", mode: "initial", newEmails: 2 });
    expect(calls).toHaveLength(1);
    expect(await summarizeThread(threadId, deps)).toMatchObject({ status: "skipped", reason: "up_to_date" });

    // Neue Antwort: nur diese wird einzeln ausgewertet, der Thread nur ergänzt.
    const c = await store("info-04c");
    calls = [];
    await processEmail(c, deps);
    expect(calls.map((x) => x.operation)).toEqual(["triage", "analyze"]);
    // Analyse der Antwort bekommt den bisherigen Verlauf als Kontext.
    expect(calls[1]!.user).toContain("Bisheriger Verlauf (Zusammenfassung): Zusammenfassung #1");

    calls = [];
    expect(await summarizeThread(threadId, deps)).toEqual({ status: "updated", mode: "incremental", newEmails: 1 });
    const prompt = calls[0]!.user;
    expect(prompt).toContain("Bisherige Zusammenfassung:\nZusammenfassung #1");
    expect(prompt).toContain("Einzel: AW: AW: Angebot");
    expect(prompt).not.toContain("Einzel: Angebot A-2026-117"); // alte E-Mails werden nicht erneut gesendet

    const t = await db.thread.findUniqueOrThrow({ where: { id: threadId } });
    expect(t.summary).toBe("Zusammenfassung #1");
    expect(t.summarizedUntil?.getTime()).toBe((await db.email.findUniqueOrThrow({ where: { id: c } })).receivedAt.getTime());
    // Kosten der Thread-Zusammenfassung landen bei der neuesten E-Mail.
    expect(await db.aiUsageLog.count({ where: { emailId: c, operation: "thread_summary" } })).toBe(1);
  });
});
