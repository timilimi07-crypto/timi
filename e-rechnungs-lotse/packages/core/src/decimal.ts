/**
 * Beträge werden als exakte Dezimal-Strings geführt – niemals als JavaScript-Number,
 * damit keine Rundungsfehler entstehen. Rechnen erfolgt in BigInt mit fester Skala.
 */
const DECIMAL_RE = /^[+-]?\d+(\.\d+)?$/;

export function isDecimal(value: string): boolean {
  return DECIMAL_RE.test(value.trim());
}

/** Wandelt einen Dezimal-String in eine BigInt-Darstellung mit `scale` Nachkommastellen (ohne Runden). */
export function toScaled(value: string, scale = 4): bigint {
  const v = value.trim();
  if (!isDecimal(v)) throw new Error(`Kein gültiger Dezimalwert: "${v}"`);
  const negative = v.startsWith("-");
  const unsigned = v.replace(/^[+-]/, "");
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  if (fracPart.length > scale) {
    throw new Error(`Zu viele Nachkommastellen (${fracPart.length} > ${scale}): "${v}"`);
  }
  const scaled = BigInt(intPart + fracPart.padEnd(scale, "0"));
  return negative ? -scaled : scaled;
}

export function fromScaled(value: bigint, scale = 4, minFraction = 2): string {
  const negative = value < 0n;
  const abs = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const intPart = abs.slice(0, abs.length - scale);
  let frac = abs.slice(abs.length - scale).replace(/0+$/, "");
  frac = frac.padEnd(minFraction, "0");
  return `${negative ? "-" : ""}${intPart}${frac ? "." + frac : ""}`;
}

export function sumDecimals(values: readonly string[], scale = 4): string {
  return fromScaled(
    values.reduce((acc, v) => acc + toScaled(v, scale), 0n),
    scale,
  );
}

export function decimalEquals(a: string, b: string, scale = 4): boolean {
  return toScaled(a, scale) === toScaled(b, scale);
}

/** Wie `toScaled`, liefert aber `null` statt eines Fehlers (für fehlende oder ungültige Werte). */
export function tryScaled(value: string | null | undefined, scale = 4): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    return toScaled(value, scale);
  } catch {
    return null;
  }
}

export function absBig(v: bigint): bigint {
  return v < 0n ? -v : v;
}

/** Ein Cent in der Skala `scale` (0,01 → 100 bei Skala 4). */
export const centAtScale = (scale = 4): bigint => 10n ** BigInt(scale - 2);
