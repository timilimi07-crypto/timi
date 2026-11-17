import { describe, expect, it } from "vitest";
import { maskSensitive } from "./mask";

describe("maskSensitive", () => {
  it("maskiert IBANs mit und ohne Leerzeichen", () => {
    expect(maskSensitive("IBAN DE89 3704 0044 0532 0130 00, BIC COLSDE33").text).toBe("IBAN [IBAN], BIC COLSDE33");
    expect(maskSensitive("auf DE89370400440532013000 überweisen").text).toBe("auf [IBAN] überweisen");
  });

  it("maskiert deutsche Telefonnummern in üblichen Schreibweisen", () => {
    const { text, stats } = maskSensitive(
      "Tel. 0561 782-4410 | Mobil 0171 4459 812 | +49 (0) 40 3344 1290 | 0049 561 99 31 20 | 0176/22345590",
    );
    expect(text).toBe("Tel. [TELEFON] | Mobil [TELEFON] | [TELEFON] | [TELEFON] | [TELEFON]");
    expect(stats.phone).toBe(5);
  });

  it("lässt Beträge, Daten, PLZ, Rechnungs- und Artikelnummern unverändert", () => {
    const input =
      "Rechnung RE-2026-10433 über 4.812,50 € vom 16.11.2026, PO-2026-8841, Art.-Nr. 40-2200, 34123 Kassel, 01067 Dresden, KW 48, SN-4471-22";
    expect(maskSensitive(input).text).toBe(input);
  });

  it("maskiert nur Luhn-gültige Kreditkartennummern", () => {
    expect(maskSensitive("Karte 4111 1111 1111 1111").text).toBe("Karte [KARTENNUMMER]");
    expect(maskSensitive("Auftrag 1234 5678 1234 5678").text).not.toContain("[KARTENNUMMER]");
  });
});
