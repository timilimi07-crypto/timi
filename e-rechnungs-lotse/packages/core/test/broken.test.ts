import { describe, expect, it } from "vitest";
import { analyseInvoice } from "../src/index.js";
import { fixtureBytes, stubValidator } from "./helpers.js";

const analyse = (name: string) =>
  analyseInvoice(fixtureBytes(`broken/${name}`), name, { validator: stubValidator() });

describe("kaputte Varianten (fixtures/broken)", () => {
  it.each([
    ["falsche-summe.xml", "ERL-RECHNUNG-BRUTTO", "error", "fehlerhaft"],
    ["fehlende-ustid.xml", "ERL-UST14-STEUERNR", "error", "fehlerhaft"],
    ["fehlende-rechnungsnummer.xml", "ERL-UST14-NUMMER", "error", "fehlerhaft"],
    ["pdf-xml-abweichung.pdf", "ERL-PDF-XML-ABWEICHUNG", "warning", "warnungen"],
    ["minimum-profil.pdf", "ERL-PROFIL-MINIMUM", "warning", "warnungen"],
    ["pdf-ohne-xml.pdf", "ERL-KEINE-E-RECHNUNG", "warning", "keine_e_rechnung"],
  ])("%s → %s (%s), Status %s", async (file, ruleId, severity, status) => {
    const a = await analyse(file);
    expect(a.findings).toContainEqual(expect.objectContaining({ ruleId, severity }));
    expect(a.status).toBe(status);
  });

  it("reines PDF ohne Anhang ist keine E-Rechnung und hat keine Rechnungsdaten", async () => {
    const a = await analyse("pdf-ohne-xml.pdf");
    expect(a).toMatchObject({ format: "pdf_ohne_xml", profile: null, status: "keine_e_rechnung" });
    expect(a.invoice).toBeUndefined();
  });

  it("PDF/XML-Abweichung nennt beide Felder und das XML als maßgeblich", async () => {
    const a = await analyse("pdf-xml-abweichung.pdf");
    const f = a.findings.find((x) => x.ruleId === "ERL-PDF-XML-ABWEICHUNG")!;
    expect(f.location).toBe("BT-1, BT-112");
    expect(f.message).toMatch(/Rechtlich maßgeblich ist das XML/);
    // Die angezeigten Daten stammen aus dem XML, nicht aus dem PDF-Text.
    expect(a.invoice?.invoiceNumber).toBe("123456XX");
  });
});
