import { describe, expect, it } from "vitest";
import { computeCostUsd, modelForOperation, resolveModels } from "./models";

describe("Modellwahl", () => {
  it("nutzt standardmäßig Sonnet 5.5 (main) und Haiku 5.5 (fast)", () => {
    expect(resolveModels({}, {})).toEqual({ main: "claude-sonnet-5-5", fast: "claude-haiku-5-5" });
  });

  it("Firmeneinstellung (Opus) hat Vorrang vor .env", () => {
    expect(resolveModels({ aiModel: "claude-opus-5-5" }, { ANTHROPIC_MODEL: "claude-sonnet-5-5" }).main).toBe(
      "claude-opus-5-5",
    );
  });

  it("ignoriert ungültige oder für die Stufe unzulässige Modelle", () => {
    // Opus ist für die schnelle Stufe nicht vorgesehen, Haiku nicht als Hauptmodell.
    const r = resolveModels({ aiModel: "claude-haiku-5-5", aiModelFast: "claude-opus-5-5" }, { ANTHROPIC_MODEL: "tippfehler" });
    expect(r).toEqual({ main: "claude-sonnet-5-5", fast: "claude-haiku-5-5" });
  });

  it("routet einfache Aufgaben auf das schnelle Modell", () => {
    expect(modelForOperation("triage", {}, {})).toBe("claude-haiku-5-5");
    expect(modelForOperation("analyze", {}, {})).toBe("claude-sonnet-5-5");
    expect(modelForOperation("reply", { aiModel: "claude-opus-5-5" }, {})).toBe("claude-opus-5-5");
  });
});

describe("Kostenberechnung", () => {
  it("berechnet Sonnet-Kosten", () => {
    // 3.000 Input × 2 $ + 600 Output × 10 $ pro 1 Mio. = 0,006 + 0,006
    expect(computeCostUsd("claude-sonnet-5-5", { inputTokens: 3000, outputTokens: 600 })).toBeCloseTo(0.012, 6);
  });

  it("berechnet Haiku-Kosten inkl. Cache-Lesezugriffen", () => {
    expect(
      computeCostUsd("claude-haiku-5-5", { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 2000 }),
    ).toBeCloseTo((1000 * 0.1 + 200 * 0.5 + 2000 * 0.01) / 1e6, 9);
  });

  it("wendet bei Haiku den Aufpreis für Prompts > 100k Token an", () => {
    expect(computeCostUsd("claude-haiku-5-5", { inputTokens: 150_000, outputTokens: 1000 })).toBeCloseTo(
      (150_000 * 0.5 + 1000 * 2.5) / 1e6,
      9,
    );
  });

  it("Opus kostet doppelt so viel wie Sonnet", () => {
    const u = { inputTokens: 5000, outputTokens: 800 };
    expect(computeCostUsd("claude-opus-5-5", u)).toBeCloseTo(2 * computeCostUsd("claude-sonnet-5-5", u), 9);
  });
});
