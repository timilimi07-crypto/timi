import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAnthropicCaller, type AiAttempt } from "./client";

type Params = Record<string, unknown> & { max_tokens: number; system: { cache_control?: unknown }[] };

/** Minimaler Ersatz für client.beta.messages.parse. */
function fakeClient(responses: ((p: Params) => unknown)[]) {
  const seen: Params[] = [];
  let i = 0;
  const client = {
    beta: {
      messages: {
        parse: async (p: Params) => {
          seen.push(p);
          return responses[Math.min(i++, responses.length - 1)]!(p);
        },
      },
    },
  } as unknown as Anthropic;
  return { client, seen };
}

const usage = { input_tokens: 400, output_tokens: 100, cache_read_input_tokens: 1200, cache_creation_input_tokens: 0 };
const ok = (parsed: unknown, model = "claude-sonnet-5-5") => () => ({ model, stop_reason: "end_turn", usage, parsed_output: parsed });
const schema = z.object({ summary: z.string() });
const base = {
  operation: "analyze" as const,
  model: "claude-sonnet-5-5",
  system: [
    { text: "statisch", cache: true },
    { text: "firma", cache: true },
  ],
  user: "E-Mail",
  schema,
  maxTokens: 1000,
  effort: "medium" as const,
};

describe("createAnthropicCaller", () => {
  it("setzt Cache-Marker, Effort, strukturierte Ausgabe und (bei Sonnet) den Fallback", async () => {
    const { client, seen } = fakeClient([ok({ summary: "x" })]);
    const attempts: AiAttempt[] = [];
    const r = await createAnthropicCaller(client)({ ...base, onAttempt: (a) => void attempts.push(a) });

    expect(r).toEqual({ ok: true, data: { summary: "x" }, model: "claude-sonnet-5-5" });
    const p = seen[0]!;
    expect(p.system.map((b) => b.cache_control)).toEqual([{ type: "ephemeral" }, { type: "ephemeral" }]);
    expect(p).toMatchObject({ fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect((p.output_config as { effort: string; format: unknown }).effort).toBe("medium");
    expect((p.output_config as { format: unknown }).format).toBeTruthy();
    // Kosten: 400×2 + 100×10 + 1200×0,1 pro 1 Mio.
    expect(attempts[0]).toMatchObject({ success: true, cacheReadTokens: 1200 });
    expect(attempts[0]!.costUsd).toBeCloseTo((400 * 2 + 100 * 10 + 1200 * 0.1) / 1e6, 9);
  });

  it("kein Fallback-Parameter bei Haiku", async () => {
    const { client, seen } = fakeClient([ok({ summary: "x" }, "claude-haiku-5-5")]);
    await createAnthropicCaller(client)({ ...base, model: "claude-haiku-5-5", operation: "triage", effort: "low" });
    expect(seen[0]).not.toHaveProperty("fallbacks");
    expect(seen[0]).not.toHaveProperty("betas");
  });

  it("wiederholt bei ungültiger Ausgabe und protokolliert jeden Versuch", async () => {
    const { client, seen } = fakeClient([ok({ falsch: 1 }), ok({ summary: "zweiter Versuch" })]);
    const attempts: AiAttempt[] = [];
    const r = await createAnthropicCaller(client)({ ...base, onAttempt: (a) => void attempts.push(a) });
    expect(r).toMatchObject({ ok: true, data: { summary: "zweiter Versuch" } });
    expect(seen).toHaveLength(2);
    expect(attempts.map((a) => [a.attempt, a.success])).toEqual([[1, false], [2, true]]);
  });

  it("verdoppelt max_tokens bei abgeschnittener Ausgabe", async () => {
    const { client, seen } = fakeClient([
      () => ({ model: "claude-sonnet-5-5", stop_reason: "max_tokens", usage, parsed_output: null }),
      ok({ summary: "x" }),
    ]);
    await createAnthropicCaller(client)(base);
    expect(seen.map((p) => p.max_tokens)).toEqual([1000, 2000]);
  });

  it("gibt nach 3 Fehlversuchen auf", async () => {
    const { client, seen } = fakeClient([ok({ falsch: 1 })]);
    const r = await createAnthropicCaller(client)(base);
    expect(r).toMatchObject({ ok: false, refused: false });
    expect(seen).toHaveLength(3);
  });

  it("wiederholt Ablehnungen nicht", async () => {
    const { client, seen } = fakeClient([
      () => ({ model: "claude-sonnet-5-5", stop_reason: "refusal", stop_details: { category: "cyber" }, usage, parsed_output: null }),
    ]);
    const r = await createAnthropicCaller(client)(base);
    expect(r).toMatchObject({ ok: false, refused: true, error: "Auswertung abgelehnt (cyber)" });
    expect(seen).toHaveLength(1);
  });

  it("verbucht Kosten mit dem tatsächlich antwortenden Modell (Fallback)", async () => {
    const { client } = fakeClient([ok({ summary: "x" }, "claude-sonnet-5")]);
    const attempts: AiAttempt[] = [];
    const r = await createAnthropicCaller(client)({ ...base, onAttempt: (a) => void attempts.push(a) });
    expect(r).toMatchObject({ model: "claude-sonnet-5" });
    expect(attempts[0]!.model).toBe("claude-sonnet-5");
  });

  it("reicht API-Fehler (nach SDK-Retries) an den Aufrufer weiter", async () => {
    const { client } = fakeClient([
      () => {
        throw new Anthropic.APIError(529, undefined, "overloaded", new Headers());
      },
    ]);
    await expect(createAnthropicCaller(client)(base)).rejects.toBeInstanceOf(Anthropic.APIError);
  });
});
