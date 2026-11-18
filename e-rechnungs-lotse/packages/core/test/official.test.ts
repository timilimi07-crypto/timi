/**
 * Offizielle Testrechnungen (KoSIT-Testsuite, FeRD ZUGFeRD 2.2, intarsys ZUGFeRD 2.0, FNFE Factur-X).
 * Der Validator wird hier durch eine Attrappe ersetzt; die echte Prüfung läuft im Integrationstest.
 */
import { describe, expect, it } from "vitest";
import { analyseInvoice, type InvoiceAnalysis } from "../src/index.js";
import { fixtureBytes, listFixtures, stubValidator } from "./helpers.js";

const analyse = (path: string) =>
  analyseInvoice(fixtureBytes(path), path.split("/").pop()!, { validator: stubValidator() });

const kosit = listFixtures("official/kosit-xrechnung-testsuite");
const ubl = kosit.filter((f) => f.endsWith("_ubl.xml"));
const cii = kosit.filter((f) => f.endsWith("_uncefact.xml"));
const zugferd = [
  ...listFixtures("official/ferd-zugferd-2.2"),
  ...listFixtures("official/intarsys-zugferd-2.0"),
  ...listFixtures("official/fnfe-factur-x"),
];

function expectUsable(a: InvoiceAnalysis) {
  expect(["ok", "warnungen"]).toContain(a.status);
  expect(a.findings.filter((f) => f.severity === "error")).toEqual([]);
  expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
}

describe.each([
  ["XRechnung UBL", ubl, "ubl"],
  ["XRechnung CII", cii, "cii"],
  ["ZUGFeRD/Factur-X PDF", zugferd, "zugferd_pdf"],
] as const)("%s", (_name, files, format) => {
  it("hat mindestens 3 offizielle Fixtures", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(files)("%s → ok/warnungen, ohne Fehler", async (file) => {
    const a = await analyse(file);
    expect(a.format).toBe(format);
    expectUsable(a);
  });

  it.each(files.slice(0, 3))("%s → NormalizedInvoice (Snapshot)", async (file) => {
    const a = await analyse(file);
    expect(a.invoice).toMatchSnapshot();
  });
});

describe("Feldinhalte offizieller Rechnungen", () => {
  it("KoSIT 01.01a UBL und CII liefern dieselben Kerndaten", async () => {
    const [u, c] = await Promise.all([
      analyse("official/kosit-xrechnung-testsuite/01.01a-INVOICE_ubl.xml"),
      analyse("official/kosit-xrechnung-testsuite/01.01a-INVOICE_uncefact.xml"),
    ]);
    for (const a of [u, c]) {
      expect(a.profile).toBe("XRECHNUNG");
      expect(a.invoice).toMatchObject({
        invoiceNumber: "123456XX",
        issueDate: "2016-04-04",
        currency: "EUR",
        buyerReference: "04011000-12345-03",
        seller: { name: "[Seller name]", vatId: "DE 123456789" },
        format: { xrechnungVersion: "3.0" },
      });
      expect(a.invoice!.totals.payableAmount).toMatch(/^336\.90?$/);
    }
    expect(u.invoice!.lines.length).toBe(c.invoice!.lines.length);
  });

  it.each([
    ["official/ferd-zugferd-2.2/EN16931_Einfach.pdf", "EN16931", "factur-x.xml"],
    ["official/ferd-zugferd-2.2/XRECHNUNG_Einfach.pdf", "XRECHNUNG", "xrechnung.xml"],
    ["official/intarsys-zugferd-2.0/zugferd_2p0_BASIC_Einfach.pdf", "BASIC", "zugferd-invoice.xml"],
    [
      "official/intarsys-zugferd-2.0/zugferd_2p0_EXTENDED_Fremdwaehrung.pdf",
      "EXTENDED",
      "zugferd-invoice.xml",
    ],
    ["official/fnfe-factur-x/Facture_FR_MINIMUM.pdf", "MINIMUM", "factur-x.xml"],
    ["official/fnfe-factur-x/Facture_FR_BASICWL.pdf", "BASIC_WL", "factur-x.xml"],
  ])("%s → Profil %s aus %s", async (file, profile, attachment) => {
    const a = await analyse(file);
    expect(a.profile).toBe(profile);
    expect(a.embeddedXmlFilename).toBe(attachment);
  });

  it("FeRD EN16931_Einfach: Daten aus dem XML, PDF stimmt überein", async () => {
    const a = await analyse("official/ferd-zugferd-2.2/EN16931_Einfach.pdf");
    expect(a.invoice).toMatchObject({ invoiceNumber: "471102", issueDate: "2018-03-05" });
    expect(a.findings.map((f) => f.ruleId)).not.toContain("ERL-PDF-XML-ABWEICHUNG");
    expect(a.findings.map((f) => f.ruleId)).toContain("ERL-ZUGFERD-XML-MASSGEBLICH");
  });

  it("MINIMUM und BASIC WL werden als Warnung gekennzeichnet", async () => {
    const min = await analyse("official/fnfe-factur-x/Facture_FR_MINIMUM.pdf");
    const wl = await analyse("official/fnfe-factur-x/Facture_FR_BASICWL.pdf");
    expect(min.findings).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-PROFIL-MINIMUM", severity: "warning" }),
    );
    expect(wl.findings).toContainEqual(
      expect.objectContaining({ ruleId: "ERL-PROFIL-BASICWL", severity: "warning" }),
    );
    expect(min.findings.find((f) => f.ruleId === "ERL-PROFIL-MINIMUM")?.message).toMatch(
      /keine vollwertige E-Rechnung/,
    );
    expect(min.status).toBe("warnungen");
  });
});
