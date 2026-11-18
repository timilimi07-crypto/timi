import { describe, expect, it } from "vitest";
import {
  analyseInvoice,
  computeStatus,
  createValidatorClient,
  finding,
  isPdf,
  pdfaPartFromBytes,
  selectInvoiceAttachment,
  sha256Hex,
} from "../src/index.js";
import { fixture, fixtureBytes, stubValidator } from "./helpers.js";

const KOSIT = "official/kosit-xrechnung-testsuite/01.05a-INVOICE_ubl.xml";
const enc = (s: string) => new TextEncoder().encode(s);

describe("analyseInvoice – Grundverhalten", () => {
  it("berechnet den SHA-256 über die unveränderten Bytes", async () => {
    const bytes = fixtureBytes(KOSIT);
    const a = await analyseInvoice(bytes, "r.xml", { validator: stubValidator() });
    expect(a.sha256).toBe(sha256Hex(bytes));
    expect(a.sizeBytes).toBe(bytes.byteLength);
    expect(a.validation).toMatchObject({ status: "geprueft", accepted: true });
  });

  it("übernimmt Validator-Fehler und setzt Status fehlerhaft", async () => {
    const v = stubValidator({
      accepted: false,
      findings: [finding("validator", "error", "BR-01", "Fehler", { location: "/Invoice[1]" })],
    });
    const a = await analyseInvoice(fixtureBytes(KOSIT), "r.xml", { validator: v });
    expect(a.status).toBe("fehlerhaft");
    expect(a.validation.accepted).toBe(false);
  });

  it("Validator nicht erreichbar → kein Absturz, pruefung_ausstehend, verständliche Meldung", async () => {
    // Port 9 (discard) auf localhost: Verbindung wird abgewiesen.
    const validator = createValidatorClient({ baseUrl: "http://127.0.0.1:9", timeoutMs: 2000 });
    const a = await analyseInvoice(fixtureBytes(KOSIT), "r.xml", { validator });
    expect(a.status).toBe("pruefung_ausstehend");
    expect(a.validation.status).toBe("nicht_erreichbar");
    const f = a.findings.find((x) => x.ruleId === "KOSIT-NICHT-ERREICHBAR")!;
    expect(f.message).toMatch(/Prüfdienst nicht erreichbar/);
    expect(a.invoice?.invoiceNumber).toBeTruthy();
  });

  it("wirft der Validator-Client selbst, bleibt die Analyse stabil", async () => {
    const a = await analyseInvoice(fixtureBytes(KOSIT), "r.xml", {
      validator: { validate: () => Promise.reject(new Error("kaputt")) },
    });
    expect(a.status).toBe("pruefung_ausstehend");
  });

  it("ohne Validator → pruefung_ausstehend", async () => {
    const a = await analyseInvoice(fixtureBytes(KOSIT), "r.xml", { validator: null });
    expect(a.status).toBe("pruefung_ausstehend");
    expect(a.findings.map((f) => f.ruleId)).toContain("KOSIT-NICHT-KONFIGURIERT");
  });

  it("eigene Fehler haben Vorrang vor ausstehender Prüfung", async () => {
    const a = await analyseInvoice(fixtureBytes("broken/falsche-summe.xml"), "f.xml", {
      validator: null,
    });
    expect(a.status).toBe("fehlerhaft");
  });

  it("Validator ohne Prüfszenario → Status nach eigenen Regeln", async () => {
    const a = await analyseInvoice(fixtureBytes(KOSIT), "r.xml", {
      validator: {
        validate: async () => ({
          status: "kein_szenario",
          engine: "KoSIT",
          reportXml: "",
          findings: [finding("validator", "warning", "KOSIT-KEIN-SZENARIO", "x")],
        }),
      },
    });
    expect(a.validation.status).toBe("kein_szenario");
    expect(a.status).toBe("warnungen");
  });

  it("liest VALIDATOR_URL als Standard", async () => {
    process.env["VALIDATOR_URL"] = "http://127.0.0.1:9";
    try {
      const a = await analyseInvoice(fixtureBytes(KOSIT), "r.xml");
      expect(a.validation.status).toBe("nicht_erreichbar");
    } finally {
      delete process.env["VALIDATOR_URL"];
    }
  });
});

describe("analyseInvoice – Formate und Fehlerfälle", () => {
  const run = (data: Uint8Array | string, name = "x") =>
    analyseInvoice(typeof data === "string" ? enc(data) : data, name, {
      validator: stubValidator(),
    });

  it("unbekannte Datei → keine_e_rechnung", async () => {
    const a = await run("Hallo, das ist keine Rechnung.");
    expect(a).toMatchObject({ format: "unbekannt", status: "keine_e_rechnung" });
    expect(a.findings[0]!.ruleId).toBe("ERL-FORMAT-UNBEKANNT");
  });

  it("XML, das keine Rechnung ist → keine_e_rechnung", async () => {
    expect((await run("<bestellung/>")).status).toBe("keine_e_rechnung");
  });

  it("ZUGFeRD 1.0 → keine_e_rechnung mit eigenem Hinweis", async () => {
    const a = await run(
      '<rsm:CrossIndustryDocument xmlns:rsm="urn:ferd:CrossIndustryDocument:invoice:1p0"/>',
    );
    expect(a.findings[0]!.ruleId).toBe("ERL-ZUGFERD-1");
    expect(a.status).toBe("keine_e_rechnung");
  });

  it("DOCTYPE → abgelehnt (XXE-Schutz)", async () => {
    const a = await run(
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><Invoice>&e;</Invoice>',
    );
    expect(a.findings[0]!.ruleId).toBe("ERL-XML-UNSICHER");
    expect(a.status).toBe("fehlerhaft");
  });

  it("nicht wohlgeformtes XML → fehlerhaft", async () => {
    const a = await run("<Invoice><ID>1</Invoice>");
    expect(a.findings[0]!.ruleId).toBe("ERL-XML-DEFEKT");
    expect(a.status).toBe("fehlerhaft");
  });

  it("UTF-8-BOM wird akzeptiert", async () => {
    const a = await run("﻿" + fixture(KOSIT));
    expect(a.format).toBe("ubl");
  });

  it("zu große Datei → nicht verarbeitet", async () => {
    const a = await analyseInvoice(new Uint8Array(100), "x", { maxBytes: 10, validator: null });
    expect(a.findings[0]!.ruleId).toBe("ERL-DATEI-ZU-GROSS");
  });

  it("beschädigtes PDF → fehlerfrei abgefangen", async () => {
    const a = await run("%PDF-1.7\nkaputt");
    expect(a.findings[0]!.ruleId).toBe("ERL-PDF-DEFEKT");
    expect(a.status).toBe("keine_e_rechnung");
  });
});

describe("PDF-Hilfsfunktionen", () => {
  it("erkennt PDF-Signatur und PDF/A-Kennung", () => {
    expect(isPdf(enc("%PDF-1.7"))).toBe(true);
    expect(isPdf(enc("<xml/>"))).toBe(false);
    expect(pdfaPartFromBytes(enc('<rdf:Description pdfaid:part="3"/>'))).toBe("3");
    expect(pdfaPartFromBytes(enc("<pdfaid:part>3</pdfaid:part>"))).toBe("3");
    expect(pdfaPartFromBytes(enc("nichts"))).toBeNull();
  });

  it("wählt Standardnamen, sonst den einzigen XML-Anhang", () => {
    const a = (filename: string) => ({ filename, content: new Uint8Array() });
    expect(selectInvoiceAttachment([a("bild.png"), a("ZUGFeRD-invoice.xml")])).toMatchObject({
      standardName: true,
      attachment: { filename: "ZUGFeRD-invoice.xml" },
    });
    expect(selectInvoiceAttachment([a("rechnung.xml")])).toMatchObject({ standardName: false });
    expect(selectInvoiceAttachment([a("a.xml"), a("b.xml")])).toBeNull();
    expect(selectInvoiceAttachment([])).toBeNull();
  });
});

describe("computeStatus", () => {
  const w = [finding("regel", "warning", "W", "w")];
  const e = [finding("regel", "error", "E", "e")];
  it.each([
    ["cii", [], "geprueft", true, "ok"],
    ["cii", w, "geprueft", true, "warnungen"],
    ["cii", e, "nicht_erreichbar", true, "fehlerhaft"],
    ["cii", w, "nicht_erreichbar", true, "pruefung_ausstehend"],
    ["pdf_ohne_xml", [], "nicht_durchgefuehrt", false, "keine_e_rechnung"],
  ] as const)("%s/%j/%s → %s", (format, findings, v, isInv, expected) => {
    expect(computeStatus(format, findings, v, isInv)).toBe(expected);
  });
});
