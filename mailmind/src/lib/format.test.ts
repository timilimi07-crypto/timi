import { describe, expect, it } from "vitest";
import { berlinHour, greeting } from "./format";

describe("Formatierung (Europe/Berlin)", () => {
  it("rechnet UTC in Berliner Zeit um (Winterzeit +1h)", () => {
    expect(berlinHour(new Date("2026-01-15T06:30:00Z"))).toBe(7);
  });

  it("rechnet UTC in Berliner Zeit um (Sommerzeit +2h)", () => {
    expect(berlinHour(new Date("2026-07-15T06:30:00Z"))).toBe(8);
  });

  it("wählt die passende Begrüßung", () => {
    expect(greeting(new Date("2026-01-15T07:00:00Z"))).toBe("Guten Morgen");
    expect(greeting(new Date("2026-01-15T12:00:00Z"))).toBe("Guten Tag");
    expect(greeting(new Date("2026-01-15T19:00:00Z"))).toBe("Guten Abend");
  });
});
