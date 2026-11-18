import { describe, expect, it, vi } from "vitest";
import { createValidatorClient, interpretReport, simplifyXpath } from "../src/index.js";
import { fixture } from "./helpers.js";

const report = (name: string) => fixture(`validator-reports/${name}`);

describe("interpretReport (aufgezeichnete KoSIT-Berichte)", () => {
  it("Annahme: offizielle Testrechnung", () => {
    const r = interpretReport(report("accept-01.01a-ubl.xml"));
    expect(r).toMatchObject({
      status: "geprueft",
      accepted: true,
      engine: "KoSIT Validator 1.6.3",
    });
    if (r.status !== "geprueft") throw new Error();
    expect(r.scenario).toMatch(/XRechnung/);
    expect(r.findings.every((f) => f.severity === "info")).toBe(true);
    expect(r.findings[0]).toMatchObject({ ruleId: "BR-DE-TMP-32", source: "validator" });
    expect(r.findings[0]!.location).toBe("/Invoice[1]");
  });

  it("Ablehnung: Schematron-Fehler mit Regel-ID und Fundstelle", () => {
    const r = interpretReport(report("reject-schematron-ohne-leitweg.xml"));
    expect(r).toMatchObject({ status: "geprueft", accepted: false });
    const f = r.findings.find((x) => x.ruleId === "BR-DE-15")!;
    expect(f).toMatchObject({ severity: "error", location: "/Invoice[1]" });
    expect(f.technicalMessage).toMatch(/^\[BR-DE-15\]/);
    expect(f.message).not.toMatch(/^\[BR-DE-15\]/);
  });

  it("Ablehnung: Schemafehler mit Zeile/Spalte", () => {
    const r = interpretReport(report("reject-xsd-synthetic.xml"));
    const f = r.findings.find((x) => x.ruleId === "cvc-complex-type.2.4.b")!;
    expect(f).toMatchObject({ severity: "error", location: "Zeile 48, Spalte 15" });
  });

  it("kein Szenario (z. B. MINIMUM) → Warnung", () => {
    const r = interpretReport(report("no-scenario.xml"));
    expect(r.status).toBe("kein_szenario");
    expect(r.findings[0]).toMatchObject({ ruleId: "KOSIT-KEIN-SZENARIO", severity: "warning" });
  });

  it("Ablehnung ohne Fehlermeldung → eigener Fehler", () => {
    const xml = report("accept-01.01a-ubl.xml").replace(
      /<rep:accept>[\s\S]*<\/rep:accept>/,
      "<rep:reject/>",
    );
    const r = interpretReport(xml);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ ruleId: "KOSIT-ABGELEHNT", severity: "error" }),
    );
  });

  it("lehnt Nicht-Berichte ab", () => {
    expect(() => interpretReport("<foo/>")).toThrow(/kein Prüfbericht/);
  });

  it("kürzt XPath-Angaben", () => {
    expect(simplifyXpath("/Q{urn:a}Invoice[1]/Q{urn:b}ID[1]")).toBe("/Invoice[1]/ID[1]");
    expect(simplifyXpath("/ubl:Invoice/cbc:ID")).toBe("/Invoice/ID");
  });
});

describe("createValidatorClient", () => {
  const ok = (body: string, status = 200) =>
    vi.fn().mockResolvedValue(new Response(body, { status })) as unknown as typeof fetch;

  it("sendet das XML per POST und wertet 200/406 aus", async () => {
    const f = ok(report("reject-schematron-ohne-leitweg.xml"), 406);
    const c = createValidatorClient({ baseUrl: "http://validator:8080/", fetch: f });
    const r = await c.validate("<Invoice/>");
    expect(r).toMatchObject({ status: "geprueft", accepted: false });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("http://validator:8080/");
    expect(init).toMatchObject({ method: "POST", body: "<Invoice/>" });
  });

  it.each([
    ["Verbindungsfehler", vi.fn().mockRejectedValue(new TypeError("fetch failed")), /fetch failed/],
    [
      "Zeitüberschreitung",
      vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })),
      /Zeitüberschreitung/,
    ],
    ["HTTP 500", vi.fn().mockResolvedValue(new Response("x", { status: 500 })), /HTTP 500/],
    [
      "kaputter Bericht",
      vi.fn().mockResolvedValue(new Response("<foo/>", { status: 200 })),
      /Unlesbarer/,
    ],
  ])("%s → nicht_erreichbar mit verständlicher Meldung", async (_n, f, reason) => {
    const c = createValidatorClient({ baseUrl: "http://x", fetch: f as unknown as typeof fetch });
    const r = await c.validate("<a/>");
    expect(r.status).toBe("nicht_erreichbar");
    if (r.status !== "nicht_erreichbar") throw new Error();
    expect(r.reason).toMatch(reason);
    expect(r.findings[0]).toMatchObject({ ruleId: "KOSIT-NICHT-ERREICHBAR", severity: "info" });
    expect(r.findings[0]!.message).toMatch(/Sie müssen nichts tun/);
  });
});
