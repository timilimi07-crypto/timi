import { describe, expect, it } from "vitest";
import {
  amountTextVariants,
  checkPlausibility,
  comparePdfTextWithInvoice,
  fromScaled,
  toScaled,
  parseInvoice,
  profileFromSpecificationId,
  type NormalizedInvoice,
} from "../src/index.js";
import { fixture } from "./helpers.js";

const kosit = (): NormalizedInvoice =>
  parseInvoice(fixture("official/kosit-xrechnung-testsuite/01.05a-INVOICE_ubl.xml"));
const ids = (inv: NormalizedInvoice) => checkPlausibility(inv).map((f) => f.ruleId);

describe("checkPlausibility – Grundfälle", () => {
  it("meldet bei einer stimmigen offiziellen Rechnung keine Fehler", () => {
    expect(checkPlausibility(kosit()).filter((f) => f.severity === "error")).toEqual([]);
  });

  it("warnt bei ungültiger IBAN", () => {
    const inv = kosit();
    inv.ibans = ["DE02120300000000202052"];
    expect(checkPlausibility(inv)).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-IBAN", severity: "warning", source: "regel" }),
    );
  });

  it("warnt bei Fälligkeit vor Rechnungsdatum", () => {
    const inv = kosit();
    inv.issueDate = "2026-02-01";
    inv.dueDate = "2026-01-01";
    expect(ids(inv)).toContain("ERL-FAELLIGKEIT");
  });

  it("meldet fehlende Währung und fehlenden Zahlbetrag", () => {
    const inv = kosit();
    inv.currency = null;
    inv.totals.payableAmount = null;
    expect(checkPlausibility(inv).filter((f) => f.ruleId === "ERL-PFLICHT")).toHaveLength(2);
  });

  it("meldet ungültige Beträge und überspringt dann die Rechenprüfung", () => {
    const inv = kosit();
    inv.totals.netAmount = "1,50";
    const r = ids(inv);
    expect(r).toContain("ERL-BETRAG-FORMAT");
    expect(r).not.toContain("ERL-RECHNUNG-BRUTTO");
  });
});

describe("Rechenprüfung (exakt, Toleranz 0,01 je Steuersatz)", () => {
  it("toleriert 0,01 Rundungsdifferenz", () => {
    const inv = kosit();
    const gross = toScaled(inv.totals.grossAmount!);
    inv.totals.grossAmount = fromScaled(gross + 100n); // + 0,01
    inv.totals.payableAmount = inv.totals.grossAmount;
    expect(ids(inv)).not.toContain("ERL-RECHNUNG-BRUTTO");
  });

  it("erkennt Abweichung Positionen ↔ BT-106", () => {
    const inv = kosit();
    inv.lines[0]!.netAmount = "9999.99";
    expect(ids(inv)).toContain("ERL-RECHNUNG-POSITIONEN");
  });

  it("erkennt Abweichung Netto bei Abschlägen/Zuschlägen", () => {
    const inv = kosit();
    inv.totals.chargeTotal = "10.00";
    expect(ids(inv)).toContain("ERL-RECHNUNG-NETTO");
  });

  it("erkennt falsche Steuersumme und falschen Steuerbetrag je Satz", () => {
    const inv = kosit();
    inv.taxBreakdown[0]!.taxAmount = "1.00";
    const r = ids(inv);
    expect(r).toContain("ERL-RECHNUNG-STEUERSUMME");
    expect(r).toContain("ERL-RECHNUNG-STEUERSATZ");
  });

  it("erkennt falschen Zahlbetrag", () => {
    const inv = kosit();
    inv.totals.payableAmount = "1.00";
    expect(ids(inv)).toContain("ERL-RECHNUNG-ZAHLBETRAG");
  });

  it("ignoriert EXTENDED-Unterpositionen und Info-Positionen in der Summe", () => {
    const inv = kosit();
    inv.lines.push(
      { ...inv.lines[0]!, id: "9a", netAmount: "500.00", parentLineId: "1" },
      { ...inv.lines[0]!, id: "9b", netAmount: "500.00", lineStatusReasonCode: "INFORMATION" },
    );
    expect(ids(inv)).not.toContain("ERL-RECHNUNG-POSITIONEN");
  });
});

describe("§ 14 Abs. 4 UStG", () => {
  it("meldet unvollständige Anschriften", () => {
    const inv = kosit();
    inv.seller.address.city = null;
    inv.buyer.name = null;
    const r = ids(inv);
    expect(r).toContain("ERL-UST14-LEISTENDER");
    expect(r).toContain("ERL-UST14-EMPFAENGER");
  });

  it("akzeptiert Steuernummer statt USt-IdNr.", () => {
    const inv = kosit();
    inv.seller.vatId = null;
    inv.seller.taxNumber = "201/113/40209";
    expect(ids(inv)).not.toContain("ERL-UST14-STEUERNR");
  });

  it("meldet fehlende Positionen bzw. Menge/Art", () => {
    const inv = kosit();
    inv.lines[0]!.quantity = null;
    expect(ids(inv)).toContain("ERL-UST14-LEISTUNG");
    inv.lines = [];
    expect(ids(inv)).toContain("ERL-UST14-LEISTUNG");
  });

  it("meldet fehlendes Datum", () => {
    const inv = kosit();
    inv.issueDate = null;
    expect(ids(inv)).toContain("ERL-UST14-DATUM");
  });

  it("verlangt Leistungszeitpunkt (Warnung) – Positionszeiträume genügen", () => {
    const inv = kosit();
    inv.deliveryDate = null;
    inv.invoicingPeriod = { start: null, end: null };
    inv.lines.forEach((l) => (l.periodStart = l.periodEnd = null));
    expect(checkPlausibility(inv)).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-UST14-ZEITPUNKT", severity: "warning" }),
    );
    inv.lines.forEach((l) => (l.periodStart = "2026-01-01"));
    expect(ids(inv)).not.toContain("ERL-UST14-ZEITPUNKT");
  });

  it("meldet fehlendes Entgelt, fehlenden Steuersatz und fehlende Aufschlüsselung", () => {
    const inv = kosit();
    inv.taxBreakdown[0]!.taxableAmount = null;
    inv.taxBreakdown[0]!.rate = null;
    const r = ids(inv);
    expect(r).toContain("ERL-UST14-ENTGELT");
    expect(r).toContain("ERL-UST14-STEUER");
    inv.taxBreakdown = [];
    expect(ids(inv)).toContain("ERL-UST14-ENTGELT");
  });

  it("verlangt Befreiungshinweis bei Reverse Charge", () => {
    const inv = kosit();
    Object.assign(inv.taxBreakdown[0]!, {
      category: "AE",
      rate: "0",
      taxAmount: "0",
      exemptionReason: null,
      exemptionReasonCode: null,
    });
    const f = checkPlausibility(inv).find((x) => x.ruleId === "ERL-UST14-BEFREIUNG");
    expect(f?.message).toMatch(/Steuerschuldnerschaft/);
    inv.taxBreakdown[0]!.category = "E";
    expect(checkPlausibility(inv).find((x) => x.ruleId === "ERL-UST14-BEFREIUNG")?.message).toMatch(
      /Steuerbefreiung/,
    );
  });
});

describe("Profile", () => {
  it.each([
    ["urn:factur-x.eu:1p0:minimum", "MINIMUM"],
    ["urn:factur-x.eu:1p0:basicwl", "BASIC_WL"],
    ["urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic", "BASIC"],
    ["urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p0:basic", "BASIC"],
    ["urn:cen.eu:en16931:2017", "EN16931"],
    ["urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended", "EXTENDED"],
    ["urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0", "XRECHNUNG"],
    ["irgendwas", "UNBEKANNT"],
    [null, "UNBEKANNT"],
  ])("%s → %s", (id, profile) => {
    expect(profileFromSpecificationId(id)).toBe(profile);
  });

  it("warnt bei BASIC WL und veralteter XRechnung, Hinweis bei unbekanntem Profil", () => {
    const inv = kosit();
    inv.format.profile = "BASIC_WL";
    expect(ids(inv)).toContain("ERL-PROFIL-BASICWL");
    inv.format.profile = "XRECHNUNG";
    inv.format.xrechnungVersion = "2.1";
    expect(ids(inv)).toContain("ERL-XRECHNUNG-VERSION");
    inv.format.profile = "UNBEKANNT";
    expect(checkPlausibility(inv)).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-PROFIL-UNBEKANNT", severity: "info" }),
    );
  });

  it("prüft bei MINIMUM nur Nummer und Datum aus § 14", () => {
    const inv = kosit();
    inv.format.profile = "MINIMUM";
    inv.lines = [];
    inv.seller.vatId = null;
    const r = ids(inv);
    expect(r).toContain("ERL-PROFIL-MINIMUM");
    expect(r.filter((x) => x.startsWith("ERL-UST14"))).toEqual([]);
  });
});

describe("PDF/XML-Abgleich", () => {
  it("kennt deutsche und englische Schreibweisen", () => {
    expect(amountTextVariants("1480.43")).toEqual(["1480,43", "1.480,43", "1480.43", "1,480.43"]);
    expect(amountTextVariants("336.9")).toContain("336,90");
    expect(amountTextVariants("-5")).toContain("5,00");
    expect(amountTextVariants("1.234")).toEqual([]);
    expect(amountTextVariants("abc")).toEqual([]);
  });

  it("findet Nummer und Betrag im PDF-Text", () => {
    const inv = kosit();
    const text = `Rechnung Nr. ${inv.invoiceNumber} ... Gesamt ${amountTextVariants(inv.totals.grossAmount!)[1]} EUR`;
    expect(comparePdfTextWithInvoice(text, inv)).toEqual([]);
  });

  it("meldet Abweichung und leeren Text", () => {
    const inv = kosit();
    const [f] = comparePdfTextWithInvoice("Rechnung Nr. 1 über 1,00 EUR und weiterer Text", inv);
    expect(f).toMatchObject({ ruleId: "ERL-PDF-XML-ABWEICHUNG", severity: "warning" });
    expect(f!.message).toMatch(/maßgeblich ist das XML/);
    expect(comparePdfTextWithInvoice("   ", inv)[0]?.ruleId).toBe("ERL-PDF-KEIN-TEXT");
  });
});
