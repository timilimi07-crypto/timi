import { describe, expect, it } from "vitest";
import { detectFormat, parseInvoice, UnsafeXmlError, UnsupportedFormatError } from "../src/index";
import { fixture } from "./helpers";

describe("parseInvoice – XRechnung UBL", () => {
  const inv = parseInvoice(fixture("synthetic/xrechnung-ubl-minimal.xml"));

  it("erkennt Syntax und Profil", () => {
    expect(inv.format).toMatchObject({
      syntax: "UBL",
      documentType: "Invoice",
      profile: "XRECHNUNG",
    });
  });

  it("liest Kopfdaten exakt aus dem XML", () => {
    expect(inv.invoiceNumber).toBe("RE-2026-0042");
    expect(inv.issueDate).toBe("2026-10-15");
    expect(inv.dueDate).toBe("2026-11-14");
    expect(inv.currency).toBe("EUR");
    expect(inv.buyerReference).toBe("04011000-12345-03");
    expect(inv.seller).toMatchObject({ name: "Muster Elektro GmbH", vatId: "DE123456789" });
    expect(inv.ibans).toEqual(["DE02120300000000202051"]);
  });

  it("behält Beträge als exakte Strings", () => {
    expect(inv.totals).toMatchObject({
      netAmount: "1271.43",
      taxAmount: "209.00",
      grossAmount: "1480.43",
      payableAmount: "1480.43",
    });
    expect(inv.taxBreakdown).toHaveLength(2);
    expect(inv.taxBreakdown[1]).toMatchObject({
      category: "S",
      rate: "7",
      taxableAmount: "271.43",
      taxAmount: "19.00",
    });
  });
});

describe("parseInvoice – ZUGFeRD/Factur-X CII", () => {
  const inv = parseInvoice(fixture("synthetic/zugferd-cii-minimal.xml"));

  it("erkennt CII und Factur-X-EXTENDED-Profil", () => {
    expect(inv.format).toMatchObject({ syntax: "CII", profile: "EXTENDED" });
  });

  it("verliert führende Nullen der Rechnungsnummer nicht", () => {
    expect(inv.invoiceNumber).toBe("00471");
  });

  it("wandelt CII-Datum 102 in ISO um", () => {
    expect(inv.issueDate).toBe("2026-11-02");
    expect(inv.dueDate).toBe("2026-12-02");
  });

  it("liest Beträge, Steuer und Umsatzsteuer-ID", () => {
    expect(inv.totals.payableAmount).toBe("595.00");
    expect(inv.taxBreakdown).toHaveLength(1);
    expect(inv.taxBreakdown[0]).toMatchObject({
      category: "S",
      rate: "19.00",
      taxableAmount: "500.00",
      taxAmount: "95.00",
    });
    expect(inv.seller.vatId).toBe("DE987654321");
    expect(inv.seller.name).toBe("Holzbau Beispiel GmbH & Co. KG");
  });
});

describe("detectFormat", () => {
  it("lehnt Nicht-Rechnungen ab", () => {
    expect(() => detectFormat("<foo/>")).toThrow(UnsupportedFormatError);
  });

  it("lehnt XML mit DOCTYPE ab (XXE-Schutz)", () => {
    const xxe =
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><Invoice>&e;</Invoice>';
    expect(() => detectFormat(xxe)).toThrow(UnsafeXmlError);
  });
});
