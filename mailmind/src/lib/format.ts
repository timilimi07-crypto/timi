/**
 * Deutsche Datums-/Zahlenformate. Zeitzone fest auf Europe/Berlin, damit
 * Server (oft UTC) und Browser dieselben Zeiten anzeigen.
 */
export const TIME_ZONE = "Europe/Berlin";

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
const dateTimeShort = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium", timeZone: TIME_ZONE });
const longDay = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
const hourFmt = new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE });

export const formatDateTime = (d: Date) => dateTime.format(d);
export const formatDateTimeShort = (d: Date) => dateTimeShort.format(d);
export const formatLongDay = (d: Date) => longDay.format(d);

/** Aktuelle Stunde (0–23) in Berlin. */
export function berlinHour(d = new Date()): number {
  return Number(hourFmt.formatToParts(d).find((p) => p.type === "hour")?.value ?? 12);
}

export function greeting(d = new Date()): string {
  const h = berlinHour(d);
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}
