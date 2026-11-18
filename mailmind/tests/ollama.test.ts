/**
 * Ollama-Anbieter gegen einen lokalen HTTP-Server, der die Ollama-API
 * nachbildet (/api/chat, /api/tags). Prüft Anfrageformat, Modellwahl,
 * Validierung/Wiederholung, Fehlermeldungen und einen Durchlauf der
 * kompletten Pipeline (Kosten 0 $, Modell an der E-Mail vermerkt).
 *
 * Hinweis: Ein echtes lokales Modell läuft hier nicht – das testet der
 * Qualitätstest (AI_PROVIDER=ollama npm run ai:eval) auf dem eigenen Rechner.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { computeCostUsd, modelLabel } from "@/lib/ai/models";
import { db } from "@/lib/db";
import type { AiAttempt } from "@/server/ai/client";
import { checkOllama, createOllamaCaller, OllamaError, type OllamaOptions } from "@/server/ai/ollama";
import { processEmail } from "@/server/ai/pipeline";
import { getAiProvider, isAiConfigured } from "@/server/ai/provider";
import { DEFAULT_CATEGORIES } from "@/server/defaults";
import { DemoConnector } from "@/server/mail/connectors/demo";
import { storeMessage } from "@/server/mail/sync";

type ChatBody = {
  model: string;
  stream: boolean;
  format: Record<string, unknown>;
  options: { temperature: number; num_ctx: number };
  messages: { role: string; content: string }[];
};

let server: Server;
let base = "";
const requests: ChatBody[] = [];
/** Antworten der Reihe nach; Funktion bekommt die Anfrage. */
let replies: ((b: ChatBody) => { status?: number; body: unknown })[] = [];
let installed = ["qwen2.5:7b", "llama3.1:latest"];

const read = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
  });

const chat = (content: unknown, extra: object = {}) => () => ({
  body: { model: "x", message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) }, done: true, done_reason: "stop", prompt_eval_count: 812, eval_count: 95, ...extra },
});

beforeAll(async () => {
  server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/tags") {
      res.end(JSON.stringify({ models: installed.map((name) => ({ name })) }));
      return;
    }
    if (req.url === "/api/chat") {
      const body = JSON.parse(await read(req)) as ChatBody;
      requests.push(body);
      const next = replies.shift() ?? (() => ({ status: 500, body: { error: "keine Antwort vorbereitet" } }));
      const r = next(body);
      res.statusCode = r.status ?? 200;
      res.end(JSON.stringify(r.body));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  requests.length = 0;
  replies = [];
  installed = ["qwen2.5:7b", "llama3.1:latest"];
});

const opts = (o: Partial<OllamaOptions> = {}): OllamaOptions => ({ baseUrl: base, model: "qwen2.5:7b", fastModel: "llama3.1", numCtx: 16384, timeoutMs: 5000, ...o });
const schema = z.object({ category: z.enum(["kunde", "spam"]), confidence: z.number().min(0).max(1) });
const params = (onAttempt?: (a: AiAttempt) => void) => ({
  operation: "analyze" as const,
  model: "claude-sonnet-5-5",
  system: [
    { text: "Anweisungen", cache: true },
    { text: "Firmenkontext", cache: true },
  ],
  user: "E-Mail-Text",
  schema,
  maxTokens: 1000,
  effort: "medium" as const,
  onAttempt,
});

describe("Ollama-Client", () => {
  it("sendet Schema, Kontextgröße, Temperatur 0, System- und Nutzer-Nachricht", async () => {
    replies = [chat({ category: "kunde", confidence: 0.9 })];
    const attempts: AiAttempt[] = [];
    const r = await createOllamaCaller(opts())(params((a) => attempts.push(a)));

    expect(r).toEqual({ ok: true, data: { category: "kunde", confidence: 0.9 }, model: "ollama:qwen2.5:7b" });
    const b = requests[0]!;
    expect(b).toMatchObject({ model: "qwen2.5:7b", stream: false, options: { temperature: 0, num_ctx: 16384 } });
    expect(b.format).toMatchObject({ type: "object", required: ["category", "confidence"] });
    expect((b.format.properties as Record<string, { enum?: string[] }>).category!.enum).toEqual(["kunde", "spam"]);
    expect(b.messages[0]!.content).toContain("Anweisungen\n\nFirmenkontext");
    expect(b.messages[0]!.content).toContain("ausschließlich mit einem JSON-Objekt");
    expect(b.messages[1]).toEqual({ role: "user", content: "E-Mail-Text" });
    expect(attempts[0]).toMatchObject({ success: true, costUsd: 0, inputTokens: 812, outputTokens: 95, model: "ollama:qwen2.5:7b" });
  });

  it("nutzt für die Vorsortierung das schnelle Modell", async () => {
    replies = [chat({ category: "spam", confidence: 0.8 })];
    await createOllamaCaller(opts())({ ...params(), operation: "triage" });
    expect(requests[0]!.model).toBe("llama3.1");
  });

  it("wiederholt bei kaputtem JSON oder Schemafehler und gibt nach 3 Versuchen auf", async () => {
    replies = [chat("kein json"), chat({ category: "lieferant", confidence: 0.5 }), chat({ category: "kunde", confidence: 0.7 })];
    const attempts: AiAttempt[] = [];
    const r = await createOllamaCaller(opts())(params((a) => attempts.push(a)));
    expect(r).toMatchObject({ ok: true, data: { category: "kunde" } });
    expect(attempts.map((a) => a.success)).toEqual([false, false, true]);
    expect(attempts[0]!.error).toBe("Ausgabe ist kein gültiges JSON");

    replies = [chat("x"), chat("y"), chat("z")];
    expect(await createOllamaCaller(opts())(params())).toMatchObject({ ok: false, refused: false });
  });

  it("wertet abgeschnittene Ausgabe (done_reason length) als Fehlversuch", async () => {
    replies = [chat('{"category":"ku', { done_reason: "length" }), chat({ category: "kunde", confidence: 1 })];
    expect(await createOllamaCaller(opts())(params())).toMatchObject({ ok: true });
    expect(requests).toHaveLength(2);
  });

  it("meldet fehlende Modelle und nicht erreichbaren Server verständlich", async () => {
    replies = [() => ({ status: 404, body: { error: "model 'qwen2.5:7b' not found, try pulling it first" } })];
    await expect(createOllamaCaller(opts())(params())).rejects.toThrow(/ollama pull/);
    await expect(createOllamaCaller(opts({ baseUrl: "http://127.0.0.1:1" }))(params())).rejects.toBeInstanceOf(OllamaError);
    await expect(createOllamaCaller(opts({ baseUrl: "http://127.0.0.1:1" }))(params())).rejects.toThrow(/nicht erreichbar/);
  });

  it("Startprüfung erkennt fehlende Modelle (auch mit :latest)", async () => {
    expect(await checkOllama(opts())).toMatchObject({ ok: true });
    installed = ["llama3.1:latest"];
    const r = await checkOllama(opts());
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ollama pull qwen2.5:7b");
    expect((await checkOllama(opts({ baseUrl: "http://127.0.0.1:1" }))).message).toContain("nicht erreichbar");
  });
});

describe("Anbieter-Auswahl", () => {
  it("Claude ist Standard, Ollama per AI_PROVIDER", () => {
    expect(getAiProvider({})).toBe("anthropic");
    expect(getAiProvider({ AI_PROVIDER: "Ollama " })).toBe("ollama");
    expect(isAiConfigured({})).toBe(false);
    expect(isAiConfigured({ ANTHROPIC_API_KEY: "sk" })).toBe(true);
    expect(isAiConfigured({ AI_PROVIDER: "ollama" })).toBe(true);
  });

  it("lokale Modelle kosten nichts und werden lesbar benannt", () => {
    expect(computeCostUsd("ollama:qwen2.5:7b", { inputTokens: 100_000, outputTokens: 10_000 })).toBe(0);
    expect(modelLabel("ollama:qwen2.5:7b")).toBe("qwen2.5:7b (Ollama, lokal)");
  });
});

describe("Pipeline mit Ollama", () => {
  let orgId = "";
  afterAll(async () => {
    if (orgId) await db.organization.delete({ where: { id: orgId } });
    await db.$disconnect();
  });

  it("wertet eine E-Mail vollständig aus – 0 $ Kosten, Modell vermerkt", async () => {
    const org = await db.organization.create({
      data: {
        name: "Ollama-Test",
        slug: `test-ollama-${Date.now()}`,
        categories: { create: DEFAULT_CATEGORIES.map((c, i) => ({ key: c.key, name: c.name, description: c.description, autoCollapse: "autoCollapse" in c, sortOrder: i })) },
      },
    });
    orgId = org.id;
    const mb = await db.mailbox.create({ data: { organizationId: orgId, name: "Info", emailAddress: "info@t.local", provider: "DEMO" } });
    const id = (await storeMessage(mb, org, (await new DemoConnector("info", new Date()).fetchMessage("info-01"))!))!;

    replies = [
      chat({ category: "kunde", categoryConfidence: 0.92, isBulk: false, summary: "Ausfall Anlage 3.", phishing: false, phishingReason: null }),
      chat({
        summary: "Stadtwerke Kassel melden Ausfall von Anlage 3 und fordern heute einen Techniker.",
        category: "kunde",
        categoryConfidence: 0.95,
        priority: "URGENT",
        priorityConfidence: 0.9,
        priorityReason: "Produktionsstillstand",
        sentiment: "NEGATIVE",
        tasks: [{ title: "Techniker schicken", dueDate: null, dueDateText: "heute" }],
        entities: [],
      }),
    ];
    const r = await processEmail(id, { caller: createOllamaCaller(opts({ fastModel: "qwen2.5:7b" })) });
    expect(r).toMatchObject({ status: "done", path: "full" });
    const e = await db.email.findUniqueOrThrow({ where: { id }, include: { tasks: true } });
    expect(e).toMatchObject({ priority: "URGENT", aiModels: ["ollama:qwen2.5:7b"], aiStatus: "DONE" });
    expect(Number(e.aiCostUsd)).toBe(0);
    expect(e.tasks).toHaveLength(1);
    // Datenschutz: Maskierung greift auch bei Ollama (Telefonnummer aus info-01).
    expect(requests.every((b) => !b.messages[1]!.content.includes("0171 4459 812"))).toBe(true);
    expect(await db.aiUsageLog.count({ where: { emailId: id, model: "ollama:qwen2.5:7b", costUsd: 0 } })).toBe(2);
  });
});

describe("Worker: KI-Dienst nicht erreichbar", () => {
  it("pausiert bei Netzwerk-/Überlastungsfehlern statt Fehlversuche zu verbrauchen", async () => {
    const { isServiceUnavailable } = await import("@/worker/ai");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    expect(isServiceUnavailable(new OllamaError("Ollama ist unter http://x nicht erreichbar."))).toBe(true);
    expect(isServiceUnavailable(new OllamaError("Ollama-Modell nicht installiert: …"))).toBe(false);
    expect(isServiceUnavailable(new Anthropic.APIError(529, undefined, "overloaded", new Headers()))).toBe(true);
    expect(isServiceUnavailable(new Anthropic.APIError(400, undefined, "bad request", new Headers()))).toBe(false);
    expect(isServiceUnavailable(new Error("irgendwas"))).toBe(false);
  });
});
