import { describe, expect, it } from "vitest";
import {
  ampelFor,
  analyseInvoice,
  buildCheckView,
  buildSupplierInquiry,
  explainFindings,
  formatAmount,
  formatDate,
  formatDecimal,
  formatRate,
  formatTaxCategory,
  formatTypeCode,
  formatUnit,
  type CheckView,
} from "../src/index";
import { fixtureBytes, stubValidator } from "./helpers";

async function view(path: string): Promise<CheckView> {
  const a = await analyseInvoice(fixtureBytes(path), path.split("/").pop()!, {
    validator: stubValidator(),
  });
  return buildCheckView(a);
}

/** Kompakte, stabile Form der Erklärungen für Snapshots. */
const explanations = (v: CheckView) =>
  v.befunde.map((f) => ({
    ruleId: f.ruleId,
    severity: f.severity,
    quelle: f.erklaerung.quelle,
    titel: f.erklaerung.titel,
    was_tun: f.erklaerung.was_tun,
  }));

describe("Erklärungen für 5 typische Dateien (Snapshot)", () => {
  it.each([
    ["gültig", "official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml", "gruen"],
    ["fehlerhaft", "broken/falsche-summe.xml", "rot"],
    ["keine E-Rechnung", "broken/pdf-ohne-xml.pdf", "grau"],
    ["MINIMUM", "broken/minimum-profil.pdf", "gelb"],
    ["PDF/XML-Abweichung", "broken/pdf-xml-abweichung.pdf", "gelb"],
  ])("%s", async (_name, path, farbe) => {
    const v = await view(path);
    expect(v.ampel.farbe).toBe(farbe);
    expect({
      zusammenfassung: v.zusammenfassung,
      hinweis: v.hinweis?.titel ?? null,
      befunde: explanations(v),
    }).toMatchSnapshot();
  });
});

describe("Ansichtsmodell", () => {
  it("Eckdaten und Rechnung wie auf Papier aus dem XML", async () => {
    const v = await view("official/ferd-zugferd-2.2/EN16931_Einfach.pdf");
    expect(v.rechnung).toMatchObject({ art: "Rechnung", nummer: "471102", datum: "05.03.2018" });
    expect(v.rechnung!.positionen.length).toBeGreaterThan(0);
    expect(v.rechnung!.summen.at(-1)).toMatchObject({ label: "Zu zahlen", hervorheben: true });
    expect(v.eckdaten.betrag).toMatch(/€$/);
    expect(v.formatLabel).toMatch(/ZUGFeRD/);
  });

  it("keine E-Rechnung: Hinweisbox mit Bedeutung für den Empfänger, keine Rechnung", async () => {
    const v = await view("broken/pdf-ohne-xml.pdf");
    expect(v.hinweis).toMatchObject({
      art: "keine_e_rechnung",
      titel: "Das ist keine E-Rechnung im Sinne des Gesetzes",
    });
    expect(v.hinweis!.text).toMatch(/Übergangszeit/);
    expect(v.rechnung).toBeNull();
    expect(v.zusammenfassung).toBe("Diese Datei ist keine E-Rechnung im Sinne des Gesetzes.");
  });

  it("MINIMUM: Profil-Hinweis", async () => {
    const v = await view("broken/minimum-profil.pdf");
    expect(v.hinweis).toMatchObject({
      art: "profil",
      titel: "In Deutschland keine vollwertige E-Rechnung",
    });
  });

  it("Ampel: Farbe nie allein (Label und Symbol)", () => {
    for (const s of [
      "ok",
      "warnungen",
      "pruefung_ausstehend",
      "fehlerhaft",
      "keine_e_rechnung",
    ] as const) {
      const a = ampelFor(s);
      expect(a.label.length).toBeGreaterThan(3);
      expect(a.symbol).toBeTruthy();
    }
  });

  it("Zusammenfassung für Prüfung ausstehend", async () => {
    const a = await analyseInvoice(
      fixtureBytes("official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml"),
      "r.xml",
      {
        validator: null,
      },
    );
    const v = await buildCheckView(a);
    expect(v.ampel.farbe).toBe("gelb");
    expect(v.zusammenfassung).toMatch(/formale Prüfung konnte noch nicht/);
  });
});

describe("Rückfrage an den Lieferanten", () => {
  it("Snapshot für eine fehlerhafte Rechnung", async () => {
    const v = await view("broken/falsche-summe.xml");
    expect(v.rueckfrage).not.toBeNull();
    expect(v.rueckfrage!.betreff).toBe("Rückfrage zu Ihrer Rechnung 123456XX vom 04.04.2016");
    expect(v.rueckfrage!.text).toMatchSnapshot();
  });

  it("ohne Rechnungsnummer: Bezug auf den Dateinamen; keine E-Rechnung: Bitte um E-Rechnung", async () => {
    const v = await view("broken/pdf-ohne-xml.pdf");
    expect(v.rueckfrage!.betreff).toMatch(/Datei „pdf-ohne-xml.pdf“/);
    expect(v.rueckfrage!.text).toMatch(/als E-Rechnung/);
  });

  it("keine Rückfrage, wenn nichts zu beanstanden ist", async () => {
    const v = await view("official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml");
    expect(v.rueckfrage).toBeNull();
  });

  it("Validator-Regel ohne Lieferanten-Text: Titel und Regel-ID", async () => {
    const a = await analyseInvoice(
      fixtureBytes("official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml"),
      "r.xml",
      {
        validator: stubValidator({
          accepted: false,
          findings: [
            {
              severity: "error",
              ruleId: "BR-CO-15",
              location: "/Invoice[1]",
              technicalMessage: "[BR-CO-15] …",
              message: "Bruttobetrag stimmt nicht",
              source: "validator",
            },
          ],
        }),
      },
    );
    const r = buildSupplierInquiry(a, await explainFindings(a.findings))!;
    expect(r.text).toMatch(/Bruttobetrag stimmt nicht \(Prüfregel BR-CO-15\)/);
  });
});

describe("Formatierung (ohne Floats)", () => {
  it.each([
    ["1480.43", "EUR", "1.480,43 €"],
    ["336.9", "EUR", "336,90 €"],
    ["-5", "EUR", "−5,00 €"],
    ["1000000", "USD", "1.000.000,00 USD"],
    ["0.1", null, "0,10 €"],
  ])("formatAmount(%s, %s) = %s", (v, c, out) => {
    expect(formatAmount(v, c)).toBe(out);
  });

  it("weitere Formate", () => {
    expect(formatAmount(null, "EUR")).toBeNull();
    expect(formatDecimal("abc")).toBe("abc");
    expect(formatDecimal("2.500")).toBe("2,5");
    expect(formatDate("2026-11-14")).toBe("14.11.2026");
    expect(formatDate("14.11.2026")).toBe("14.11.2026");
    expect(formatDate(null)).toBeNull();
    expect(formatRate("19.00")).toBe("19 %");
    expect(formatRate(null)).toBeNull();
    expect(formatUnit("HUR")).toBe("Stunde(n)");
    expect(formatUnit("XYZ")).toBe("XYZ");
    expect(formatUnit(null)).toBeNull();
    expect(formatTaxCategory("AE")).toBe("Reverse Charge");
    expect(formatTaxCategory("Q")).toBe("Q");
    expect(formatTaxCategory(null)).toBeNull();
    expect(["380", "381", "384", "326", "875"].map(formatTypeCode)).toEqual([
      "Rechnung",
      "Gutschrift",
      "Rechnungskorrektur",
      "Teilrechnung",
      "Bauleistungsrechnung",
    ]);
  });
});
