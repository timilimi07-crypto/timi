import { describe, expect, it } from "vitest";
import {
  decimalEquals,
  formatIban,
  isValidIban,
  sha256Hex,
  sumDecimals,
  toScaled,
} from "../src/index";

describe("Dezimalarithmetik ohne Float", () => {
  it("addiert exakt", () => {
    expect(sumDecimals(["0.1", "0.2"])).toBe("0.30");
    expect(decimalEquals("19", "19.00")).toBe(true);
  });
  it("lehnt ungültige Werte ab", () => {
    expect(() => toScaled("1,50")).toThrow();
    expect(() => toScaled("1e3")).toThrow();
  });
});

describe("IBAN", () => {
  it("prüft die Prüfsumme", () => {
    expect(isValidIban("DE02 1203 0000 0000 2020 51")).toBe(true);
    expect(isValidIban("DE02120300000000202052")).toBe(false);
  });
  it("formatiert für die Anzeige", () => {
    expect(formatIban("DE02120300000000202051")).toBe("DE02 1203 0000 0000 2020 51");
  });
});

describe("sha256Hex", () => {
  it("liefert den bekannten Hash", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
