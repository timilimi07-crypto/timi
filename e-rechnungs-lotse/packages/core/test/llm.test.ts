import { describe, expect, it, vi } from "vitest";
import { createLlmGateway, readLlmConfig, type LlmLogEvent } from "../src/llm/index.js";

const input = { findingMessages: ["Die IBAN ist formal ungültig."], profile: "XRECHNUNG" as const };

describe("LLM-Gateway", () => {
  it("ist standardmäßig deaktiviert und ruft nichts auf", async () => {
    const transport = { complete: vi.fn() };
    const gw = createLlmGateway({ config: readLlmConfig({}), transport });
    expect(gw.enabled).toBe(false);
    expect(await gw.explainFindings(input)).toBeNull();
    expect(transport.complete).not.toHaveBeenCalled();
  });

  it("verweigert nicht freigegebene (Nicht-EU-)Endpunkte", async () => {
    const config = readLlmConfig({
      LLM_ENABLED: "true",
      LLM_ENDPOINT: "https://api.example.com/v1",
      LLM_ALLOWED_HOSTS: "llm.eu.example",
    });
    const gw = createLlmGateway({ config, transport: { complete: vi.fn() } });
    await expect(gw.explainFindings(input)).rejects.toThrow(/nicht freigegeben/);
  });

  it("sendet nur freigegebene Felder und loggt keine Inhalte", async () => {
    const logs: LlmLogEvent[] = [];
    const transport = { complete: vi.fn().mockResolvedValue("Erklärung") };
    const config = readLlmConfig({
      LLM_ENABLED: "true",
      LLM_ENDPOINT: "https://llm.eu.example/v1",
      LLM_ALLOWED_HOSTS: "llm.eu.example",
    });
    const gw = createLlmGateway({ config, transport, log: (e) => logs.push(e) });
    const withExtra = { ...input, iban: "DE02120300000000202051" } as typeof input;
    expect(await gw.explainFindings(withExtra)).toBe("Erklärung");
    const prompt = transport.complete.mock.calls[0]![0].prompt as string;
    expect(prompt).not.toContain("DE02120300000000202051");
    expect(JSON.stringify(logs)).not.toContain("IBAN ist formal");
    expect(logs[0]).toMatchObject({ outcome: "ok", sentFields: ["findingMessages", "profile"] });
  });
});
