import { describe, expect, it, vi } from "vitest";
import {
  createChatCompletionsTransport,
  createLlmGateway,
  readLlmConfig,
  redactTechnicalMessage,
  type LlmLogEvent,
} from "../src/llm/index";

const input = {
  ruleId: "PEPPOL-EN16931-R999",
  technicalMessage: "Feld (BT-10) fehlt",
  field: "BT-10",
};
const enabled = readLlmConfig({
  LLM_ENABLED: "true",
  LLM_ENDPOINT: "https://llm.eu.example/v1/chat/completions",
  LLM_ALLOWED_HOSTS: "llm.eu.example",
});
const ANSWER = JSON.stringify({
  titel: "Referenz fehlt",
  erklaerung_einfach: "Eine Angabe zur Zuordnung fehlt.",
  was_tun: "Fragen Sie beim Lieferanten nach.",
});

describe("LLM-Gateway", () => {
  it("ist standardmäßig deaktiviert und ruft nichts auf", async () => {
    const transport = { complete: vi.fn() };
    const logs: LlmLogEvent[] = [];
    const gw = createLlmGateway({ config: readLlmConfig({}), transport, log: (e) => logs.push(e) });
    expect(gw.enabled).toBe(false);
    expect(await gw.explainRule(input)).toBeNull();
    expect(transport.complete).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ outcome: "deaktiviert" });
  });

  it("verweigert nicht freigegebene (Nicht-EU-)Endpunkte", async () => {
    const config = { ...enabled, allowedHosts: ["anderer.eu.example"] };
    const gw = createLlmGateway({ config, transport: { complete: vi.fn() } });
    await expect(gw.explainRule(input)).rejects.toThrow(/nicht freigegeben/);
    await expect(
      createLlmGateway({
        config: { ...enabled, endpoint: null },
        transport: { complete: vi.fn() },
      }).explainRule(input),
    ).rejects.toThrow(/LLM_ENDPOINT/);
  });

  it("sendet nur ruleId, bereinigte Meldung und BT-ID; loggt keine Inhalte", async () => {
    const logs: LlmLogEvent[] = [];
    const transport = { complete: vi.fn().mockResolvedValue(`Hier: ${ANSWER}`) };
    const gw = createLlmGateway({ config: enabled, transport, log: (e) => logs.push(e) });
    const res = await gw.explainRule({
      ...input,
      technicalMessage: "Wert '4711' für Feld (BT-10) ungültig, IBAN DE02120300000000202051",
      // zusätzliche Felder dürfen nicht durchrutschen
      ...({ iban: "DE02120300000000202051" } as object),
    });
    expect(res).toMatchObject({ titel: "Referenz fehlt" });
    const prompt = transport.complete.mock.calls[0]![0].prompt as string;
    const payload = JSON.parse(prompt.slice(prompt.indexOf("{")));
    expect(Object.keys(payload).sort()).toEqual(["field", "ruleId", "technicalMessage"]);
    expect(prompt).not.toMatch(/4711|DE02/);
    expect(logs[0]).toMatchObject({
      outcome: "ok",
      sentFields: ["ruleId", "technicalMessage", "field"],
    });
    expect(JSON.stringify(logs)).not.toMatch(/BT-10|ungültig/);
  });

  it("lehnt unbrauchbare Antworten, Transportfehler und manipulierte Eingaben ab", async () => {
    const bad = createLlmGateway({
      config: enabled,
      transport: { complete: vi.fn().mockResolvedValue("kein JSON") },
    });
    expect(await bad.explainRule(input)).toBeNull();
    const broken = createLlmGateway({
      config: enabled,
      transport: { complete: vi.fn().mockResolvedValue("{kaputt}") },
    });
    expect(await broken.explainRule(input)).toBeNull();
    const failing = createLlmGateway({
      config: enabled,
      transport: { complete: vi.fn().mockRejectedValue(new Error("x")) },
    });
    expect(await failing.explainRule(input)).toBeNull();
    const ok = createLlmGateway({
      config: enabled,
      transport: { complete: vi.fn().mockResolvedValue(ANSWER) },
    });
    await expect(ok.explainRule({ ...input, ruleId: "x y; DROP" })).rejects.toThrow(/Regel-ID/);
  });
});

describe("redactTechnicalMessage", () => {
  it("entfernt Zahlen, Zitate, IBANs, E-Mails und URLs, behält Regel- und Feldkennungen", () => {
    const r = redactTechnicalMessage(
      "[BR-DE-15] Feld \"Buyer reference\" (BT-10) hat Wert 'Müller GmbH', Betrag 1.480,43 EUR, " +
        "IBAN DE02 1203 0000 0000 2020 51, Mail info@example.de, siehe https://example.de/x?id=5, BR-CO-10",
    );
    expect(r).toContain("BR-DE-15");
    expect(r).toContain("BT-10");
    expect(r).toContain("BR-CO-10");
    expect(r).not.toMatch(/Müller|1\.480|DE02|info@|example\.de|Buyer reference/);
  });

  it("kürzt sehr lange Meldungen", () => {
    expect(redactTechnicalMessage("a ".repeat(400)).length).toBeLessThanOrEqual(302);
  });
});

describe("createChatCompletionsTransport", () => {
  it("sendet Modell und Prompt und liest die Antwort", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "antwort" } }] }), {
          status: 200,
        }),
      );
    const t = createChatCompletionsTransport({
      apiKey: "test-key",
      model: "m",
      fetch: f as unknown as typeof fetch,
    });
    expect(await t.complete({ endpoint: "https://llm.eu.example/v1", prompt: "p" })).toBe(
      "antwort",
    );
    const [, init] = f.mock.calls[0]!;
    expect(JSON.parse(init.body)).toMatchObject({
      model: "m",
      messages: [{ role: "user", content: "p" }],
    });
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("meldet HTTP-Fehler und leere Antworten", async () => {
    const t = (r: Response) =>
      createChatCompletionsTransport({
        apiKey: "k",
        model: "m",
        fetch: vi.fn().mockResolvedValue(r) as unknown as typeof fetch,
      });
    await expect(
      t(new Response("x", { status: 500 })).complete({ endpoint: "https://a", prompt: "p" }),
    ).rejects.toThrow(/HTTP 500/);
    await expect(
      t(new Response("{}", { status: 200 })).complete({ endpoint: "https://a", prompt: "p" }),
    ).rejects.toThrow(/ohne Inhalt/);
  });
});
