/**
 * Integrationstest gegen den laufenden KoSIT-Validator-Container.
 *   docker compose up -d validator && pnpm --filter @erl/core test:integration
 * Adresse: VALIDATOR_URL (Standard http://localhost:8081).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { analyseInvoice, createValidatorClient } from "../../src/index";
import { fixture, fixtureBytes, listFixtures } from "../helpers";

const baseUrl = process.env["VALIDATOR_URL"] ?? "http://localhost:8081";
const validator = createValidatorClient({ baseUrl, timeoutMs: 30_000 });

beforeAll(async () => {
  const res = await fetch(`${baseUrl}/server/health`).catch(() => null);
  if (!res?.ok)
    throw new Error(`Validator unter ${baseUrl} nicht erreichbar – bitte zuerst starten.`);
});

describe("offizielle KoSIT-Testrechnungen werden als gültig erkannt", () => {
  it.each(listFixtures("official/kosit-xrechnung-testsuite"))("%s", async (file) => {
    const r = await validator.validate(fixture(file));
    expect(r.status).toBe("geprueft");
    if (r.status !== "geprueft") return;
    expect(r.accepted).toBe(true);
    expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(r.engine).toMatch(/KoSIT Validator/);
  });
});

describe("Gesamtanalyse mit echtem Validator", () => {
  it.each([
    "official/ferd-zugferd-2.2/EN16931_Einfach.pdf",
    "official/ferd-zugferd-2.2/EN16931_Rabatte.pdf",
    "official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml",
  ])("%s → ok, vom Validator akzeptiert", async (file) => {
    const a = await analyseInvoice(fixtureBytes(file), file, { validator });
    expect(a.validation).toMatchObject({ status: "geprueft", accepted: true });
    expect(a.status).toBe("ok");
  });

  it("MINIMUM-Profil: kein Prüfszenario → Warnung, kein Absturz", async () => {
    const a = await analyseInvoice(fixtureBytes("broken/minimum-profil.pdf"), "m.pdf", {
      validator,
    });
    expect(a.validation.status).toBe("kein_szenario");
    expect(a.status).toBe("warnungen");
  });

  it("fehlende Rechnungsnummer wird auch vom Validator abgelehnt", async () => {
    const a = await analyseInvoice(fixtureBytes("broken/fehlende-rechnungsnummer.xml"), "f.xml", {
      validator,
    });
    expect(a.validation.accepted).toBe(false);
    expect(a.status).toBe("fehlerhaft");
  });
});
