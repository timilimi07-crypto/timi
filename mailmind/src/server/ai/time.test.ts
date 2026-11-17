import { describe, expect, it } from "vitest";
import { formatInTimeZone, startOfBerlinDay } from "./time";

describe("Zeit (Europe/Berlin)", () => {
  it("Tagesbeginn im Winter (UTC+1) und Sommer (UTC+2)", () => {
    expect(startOfBerlinDay(new Date("2026-11-17T08:00:00Z")).toISOString()).toBe("2026-11-16T23:00:00.000Z");
    expect(startOfBerlinDay(new Date("2026-07-15T23:30:00Z")).toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });

  it("formatiert Empfangsdatum mit Wochentag und ISO-Datum für die KI", () => {
    expect(formatInTimeZone(new Date("2026-11-17T07:15:00Z"))).toBe("Dienstag, 17.11.2026, 08:15 (2026-11-17)");
  });
});
