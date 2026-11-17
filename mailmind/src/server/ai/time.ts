const fmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" });

/** „Dienstag, 17.11.2026, 08:15 (2026-11-17)“ – Wochentag und ISO-Datum helfen der KI, relative Fristen zu berechnen. */
export function formatInTimeZone(d: Date): string {
  return `${fmt.format(d)} (${isoDay.format(d)})`;
}

/** Beginn des heutigen Tages in Europe/Berlin als UTC-Zeitpunkt. */
export function startOfBerlinDay(now = new Date()): Date {
  const day = isoDay.format(now); // YYYY-MM-DD in Berlin
  // Offset Berlins zu diesem Zeitpunkt ermitteln (+1 h oder +2 h).
  const probe = new Date(`${day}T12:00:00Z`);
  const berlinNoon = Number(
    new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" })
      .formatToParts(probe)
      .find((p) => p.type === "hour")?.value ?? 13,
  );
  const offsetHours = berlinNoon - 12;
  return new Date(Date.parse(`${day}T00:00:00Z`) - offsetHours * 3600_000);
}
