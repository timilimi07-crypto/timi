import { describe, expect, it } from "vitest";
import { checkPlausibility, parseInvoice, type NormalizedInvoice } from "../src/index.js";
import { fixture } from "./helpers.js";

const base = (): NormalizedInvoice => parseInvoice(fixture("xrechnung-ubl-minimal.xml"));

describe("checkPlausibility", () => {
  it("meldet bei einer stimmigen Rechnung nichts", () => {
    expect(checkPlausibility(base())).toEqual([]);
    expect(checkPlausibility(parseInvoice(fixture("zugferd-cii-minimal.xml")))).toEqual([]);
  });

  it("erkennt eine abweichende Steuersumme", () => {
    const inv = base();
    inv.totals.taxAmount = "210.00";
    const ids = checkPlausibility(inv).map((f) => f.ruleId);
    expect(ids).toContain("ERL-STEUERSUMME");
    expect(ids).toContain("ERL-BRUTTO");
  });

  it("warnt bei ungültiger IBAN", () => {
    const inv = base();
    inv.ibans = ["DE02120300000000202052"];
    expect(checkPlausibility(inv)).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-IBAN", severity: "warnung" }),
    );
  });

  it("meldet fehlende Pflichtfelder", () => {
    const inv = base();
    inv.invoiceNumber = null;
    expect(checkPlausibility(inv)).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-PFLICHT", field: "BT-1" }),
    );
  });
});
