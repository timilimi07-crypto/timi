/**
 * Deterministische deutsche Formatierung – nur String-Operationen, keine Floats (Regel a).
 */

const DECIMAL = /^([+-])?(\d+)(?:\.(\d+))?$/;

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "1480.43" → "1.480,43"; behält mindestens `minFraction` Nachkommastellen, entfernt überflüssige Nullen. */
export function formatDecimal(value: string | null, minFraction = 0): string | null {
  if (value === null) return null;
  const m = value.trim().match(DECIMAL);
  if (!m) return value;
  const sign = m[1] === "-" ? "−" : "";
  const int = groupThousands(m[2]!.replace(/^0+(?=\d)/, ""));
  let frac = (m[3] ?? "").replace(/0+$/, "");
  if (frac.length < minFraction) frac = frac.padEnd(minFraction, "0");
  return `${sign}${int}${frac ? "," + frac : ""}`;
}

/** Betrag mit Währung: "1480.4" + "EUR" → "1.480,40 €". */
export function formatAmount(value: string | null, currency: string | null): string | null {
  const num = formatDecimal(value, 2);
  if (num === null) return null;
  if (!currency || currency === "EUR") return `${num} €`;
  return `${num} ${currency}`;
}

/** ISO-Datum "2026-11-14" → "14.11.2026". */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Steuersatz "19.00" → "19 %", "7.5" → "7,5 %". */
export function formatRate(rate: string | null): string | null {
  const v = formatDecimal(rate);
  return v === null ? null : `${v} %`;
}

/** Häufige Mengeneinheiten (UN/ECE Recommendation 20/21) auf Deutsch. */
const UNITS: Record<string, string> = {
  H87: "Stück",
  C62: "Stück",
  XPP: "Stück",
  EA: "Stück",
  HUR: "Stunde(n)",
  MIN: "Minute(n)",
  DAY: "Tag(e)",
  WEE: "Woche(n)",
  MON: "Monat(e)",
  ANN: "Jahr(e)",
  MTR: "m",
  CMT: "cm",
  MMT: "mm",
  KMT: "km",
  MTK: "m²",
  MTQ: "m³",
  LTR: "l",
  KGM: "kg",
  GRM: "g",
  TNE: "t",
  KWH: "kWh",
  SET: "Satz",
  LS: "pauschal",
  XBX: "Karton",
  XPA: "Paket",
  PR: "Paar",
  P1: "%",
};

export function formatUnit(code: string | null): string | null {
  if (!code) return null;
  return UNITS[code.toUpperCase()] ?? code;
}

/** Steuerkategorie BT-118/BT-151 in Worten. */
const CATEGORIES: Record<string, string> = {
  S: "Normalsatz",
  Z: "Nullsatz",
  E: "steuerfrei",
  AE: "Reverse Charge",
  K: "innergemeinschaftliche Lieferung",
  G: "Ausfuhr",
  O: "nicht steuerbar",
  L: "Kanarische Inseln",
  M: "Ceuta/Melilla",
};

export function formatTaxCategory(code: string | null): string | null {
  if (!code) return null;
  return CATEGORIES[code.toUpperCase()] ?? code;
}

/** Rechnungsart BT-3. */
export function formatTypeCode(code: string | null): string {
  switch (code) {
    case "381":
      return "Gutschrift";
    case "384":
      return "Rechnungskorrektur";
    case "326":
      return "Teilrechnung";
    case "875":
    case "876":
    case "877":
      return "Bauleistungsrechnung";
    default:
      return "Rechnung";
  }
}
