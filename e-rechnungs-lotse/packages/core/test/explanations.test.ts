import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import raw from "../src/explanations/de.json";
import {
  analyseInvoice,
  EXPLANATIONS,
  ExplanationEntrySchema,
  ExplanationTableSchema,
  explainFindings,
  FALLBACK_TEXT,
  finding,
  lookupExplanation,
  memoryExplanationCache,
  OWN_RULE_IDS,
  sensitiveValuesOf,
  buildCheckView,
  type ValidationFinding,
} from "../src/index";
import { createLlmGateway, readLlmConfig } from "../src/llm/index";
import { fixtureBytes } from "./helpers";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** Alle eigenen Regel-IDs, die irgendwo im Quellcode als Literal vorkommen. */
const ruleIdsInSource = [
  ...new Set(
    sourceFiles(SRC).flatMap((p) =>
      [...readFileSync(p, "utf8").matchAll(/"((?:ERL|KOSIT)-[A-Z0-9-]+)"/g)].map((m) => m[1]!),
    ),
  ),
].sort();

describe("Erklärtabelle de.json", () => {
  it("erfüllt das Schema (jeder Eintrag einzeln und die Tabelle als Ganzes)", () => {
    expect(() => ExplanationTableSchema.parse(raw)).not.toThrow();
    for (const [id, entry] of Object.entries(EXPLANATIONS.regeln)) {
      const r = ExplanationEntrySchema.safeParse(entry);
      expect(r.success, `${id}: ${r.error?.message}`).toBe(true);
    }
  });

  it("lehnt fehlerhafte Einträge ab", () => {
    expect(ExplanationEntrySchema.safeParse({ titel: "x" }).success).toBe(false);
    expect(
      ExplanationEntrySchema.safeParse({
        titel: "Titel",
        erklaerung_einfach: "Eine Erklärung.",
        was_tun: "Etwas tun.",
        betrifft_mich_als_empfaenger: true,
        unbekannt: 1,
      }).success,
    ).toBe(false);
  });

  it("hat für jede eigene Regel-ID einen Eintrag (Liste und Quellcode)", () => {
    const missing = [...OWN_RULE_IDS, ...ruleIdsInSource].filter((id) => !EXPLANATIONS.regeln[id]);
    expect(missing).toEqual([]);
    // Die Liste OWN_RULE_IDS ist vollständig – neue Regeln müssen dort und in de.json auftauchen.
    expect(
      ruleIdsInSource.filter((id) => !(OWN_RULE_IDS as readonly string[]).includes(id)),
    ).toEqual([]);
  });

  it("enthält mindestens 40 KoSIT-/EN-16931-/BR-DE-Regeln", () => {
    const external = Object.keys(EXPLANATIONS.regeln).filter((k) =>
      /^(BR-|cvc-|UBL-|CII-)/.test(k),
    );
    expect(external.length).toBeGreaterThanOrEqual(40);
  });

  it("verwendet durchgehend „Sie“ und keine Du-Form", () => {
    const all = JSON.stringify(EXPLANATIONS.regeln);
    expect(all).not.toMatch(/\b(du|dich|dir|dein|deine|deinen)\b/i);
  });

  it("BR-DE-TMP-32 und ERL-UST14-ZEITPUNKT: Warnung mit dem vereinbarten Text", () => {
    const text =
      "Steht kein Leistungsdatum drin, gilt oft das Rechnungsdatum – kurz beim Lieferanten nachfragen, ob das stimmt.";
    expect(EXPLANATIONS.regeln["BR-DE-TMP-32"]!.erklaerung_einfach).toBe(text);
    expect(EXPLANATIONS.regeln["ERL-UST14-ZEITPUNKT"]!.erklaerung_einfach).toBe(text);
  });

  it("findet Einträge exakt und per Präfix", () => {
    expect(lookupExplanation("BR-DE-15")?.key).toBe("BR-DE-15");
    expect(lookupExplanation("cvc-complex-type.2.4.b")?.key).toBe("cvc-complex-type.2.4.b");
    expect(lookupExplanation("cvc-enumeration-valid")?.key).toBe("cvc-*");
    expect(lookupExplanation("UBL-CR-646")?.key).toBe("UBL-CR-*");
    expect(lookupExplanation("GIBT-ES-NICHT")).toBeNull();
    const custom = { ...EXPLANATIONS, regeln: { "X-*": EXPLANATIONS.regeln["cvc-*"]! } };
    expect(lookupExplanation("X-1", custom)?.key).toBe("X-*");
  });

  it("Anzeigetext der Befunde kommt aus der Tabelle (eine Quelle)", () => {
    expect(finding("regel", "error", "ERL-RECHNUNG-BRUTTO").message).toBe(
      EXPLANATIONS.regeln["ERL-RECHNUNG-BRUTTO"]!.titel,
    );
    expect(finding("validator", "error", "BR-DE-15", { fallbackMessage: "x" }).message).toBe(
      "Käuferreferenz fehlt",
    );
    expect(
      finding("validator", "error", "UNBEKANNT-1", { fallbackMessage: "Text vom Prüfprogramm" })
        .message,
    ).toBe("Text vom Prüfprogramm");
  });
});

const unknown: ValidationFinding = finding("validator", "error", "PEPPOL-EN16931-R999", {
  location: "/Invoice[1]",
  technicalMessage: "[PEPPOL-EN16931-R999] Element (BT-23) fehlt",
  fallbackMessage: "Element (BT-23) fehlt",
});

describe("explainFindings", () => {
  it("sortiert nach Schwere und nutzt die Tabelle", async () => {
    const r = await explainFindings([
      finding("format", "info", "ERL-PDFA3"),
      finding("regel", "warning", "ERL-IBAN"),
      finding("regel", "error", "ERL-RECHNUNG-BRUTTO"),
    ]);
    expect(r.map((f) => f.severity)).toEqual(["error", "warning", "info"]);
    expect(r.every((f) => f.erklaerung.quelle === "tabelle")).toBe(true);
  });

  it("Flag aus: Standardtext statt automatischer Erklärung", async () => {
    const gw = createLlmGateway({ config: readLlmConfig({}), transport: { complete: vi.fn() } });
    const [f] = await explainFindings([unknown], { llm: gw });
    expect(f!.erklaerung).toMatchObject({
      quelle: "standardtext",
      erklaerung_einfach: FALLBACK_TEXT,
    });
  });

  it("Flag an: automatische Erklärung, einmal pro Regel-ID, mit Cache", async () => {
    const complete = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({
          titel: "Feld fehlt",
          erklaerung_einfach: "Ein Feld fehlt.",
          was_tun: "Nachfragen.",
        }),
      );
    const gw = createLlmGateway({
      config: readLlmConfig({
        LLM_ENABLED: "true",
        LLM_ENDPOINT: "https://llm.eu.example/x",
        LLM_ALLOWED_HOSTS: "llm.eu.example",
      }),
      transport: { complete },
    });
    const cache = memoryExplanationCache();
    const r = await explainFindings([unknown, { ...unknown }], { llm: gw, cache });
    expect(r[0]!.erklaerung).toMatchObject({
      quelle: "automatisch",
      titel: "Feld fehlt",
      betrifft_mich_als_empfaenger: true,
    });
    expect(complete).toHaveBeenCalledTimes(1);
    // Zweiter Durchlauf: aus dem Cache, kein neuer Aufruf
    const again = await explainFindings([unknown], { llm: gw, cache });
    expect(again[0]!.erklaerung.quelle).toBe("automatisch");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("LLM-Fehler oder Cache-Fehler → Standardtext, kein Absturz", async () => {
    const gw = { enabled: true, explainRule: vi.fn().mockRejectedValue(new Error("x")) };
    const cache = { get: vi.fn().mockRejectedValue(new Error("db")), set: vi.fn() };
    const [f] = await explainFindings([unknown], { llm: gw, cache });
    expect(f!.erklaerung.quelle).toBe("standardtext");
  });
});

describe("LLM-Payload enthält keine Rechnungsinhalte", () => {
  it("weder Beträge, IBANs, Namen noch Rechnungsnummern", async () => {
    const bytes = fixtureBytes("official/kosit-xrechnung-testsuite/01.05a-INVOICE_ubl.xml");
    const probe = await analyseInvoice(bytes, "r.xml", { validator: null });
    const inv = probe.invoice!;
    // Eine (erfundene) Validator-Meldung, die Rechnungsinhalte zitiert – wie es Schemafehler tun können.
    const leaky = finding("validator", "error", "PEPPOL-EN16931-R998", {
      location: "/Invoice[1]/PaymentMeans[1]",
      technicalMessage:
        `Wert ${inv.seller.name} und ${inv.buyer.name} (BT-27) ungültig: Rechnung ${inv.invoiceNumber}, ` +
        `Betrag ${inv.totals.payableAmount} EUR, IBAN ${inv.ibans[0] ?? "DE02120300000000202051"}, ` +
        `Ort ${inv.seller.address.city}, Kontakt seller@email.de, Datum ${inv.issueDate}`,
      fallbackMessage: "x",
    });
    const complete = vi.fn().mockResolvedValue("{}");
    const gw = createLlmGateway({
      config: readLlmConfig({
        LLM_ENABLED: "true",
        LLM_ENDPOINT: "https://llm.eu.example/x",
        LLM_ALLOWED_HOSTS: "llm.eu.example",
      }),
      transport: { complete },
    });
    await buildCheckView({ ...probe, findings: [leaky] }, { llm: gw });
    expect(complete).toHaveBeenCalledTimes(1);
    const prompt = complete.mock.calls[0]![0].prompt as string;
    const payload = JSON.parse(prompt.slice(prompt.indexOf("{")));
    expect(Object.keys(payload).sort()).toEqual(["field", "ruleId", "technicalMessage"]);
    expect(payload).toMatchObject({ ruleId: "PEPPOL-EN16931-R998", field: "BT-27" });
    const sent = JSON.stringify(payload);
    for (const value of sensitiveValuesOf(inv)) {
      expect(sent, `Wert gesendet: ${value}`).not.toContain(value);
    }
    // Außer in Kennungen (BT-27) keine Ziffern, keine E-Mail, keine IBAN.
    expect(payload.technicalMessage.replace(/BT-\d+/g, "")).not.toMatch(/@|DE\d{2}|\d/);
  });
});

describe("mergeEquivalent", () => {
  it("zeigt gleiche Probleme einmal und behält die beteiligten Regeln", async () => {
    const { mergeEquivalent } = await import("../src/index");
    const r = mergeEquivalent(
      await explainFindings([
        finding("regel", "error", "ERL-RECHNUNG-BRUTTO", { technicalMessage: "eigene" }),
        finding("validator", "error", "BR-CO-15", {
          technicalMessage: "kosit",
          fallbackMessage: "x",
        }),
        finding("regel", "warning", "ERL-IBAN"),
      ]),
    );
    expect(r.map((f) => f.ruleId)).toEqual(["ERL-RECHNUNG-BRUTTO", "ERL-IBAN"]);
    expect(r[0]!.verwandt).toEqual([
      { ruleId: "BR-CO-15", source: "validator", location: null, technicalMessage: "kosit" },
    ]);
  });
});
