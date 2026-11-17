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

const usd = new Intl.NumberFormat("de-DE", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdPrecise = new Intl.NumberFormat("de-DE", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const integer = new Intl.NumberFormat("de-DE");

/** KI-Kosten werden in USD abgerechnet und daher in USD angezeigt. Kleinbeträge mit 4 Nachkommastellen. */
export function formatUsd(v: number): string {
  return v > 0 && v < 0.1 ? usdPrecise.format(v) : usd.format(v);
}
export const formatInt = (v: number) => integer.format(v);

/** "2026-11-17" → "17.11." */
export function formatShortDay(isoDay: string): string {
  const [, m, d] = isoDay.split("-");
  return `${d}.${m}.`;
}
