/**
 * Maskierung sensibler Daten vor dem KI-Aufruf (DSGVO, pro Firma abschaltbar).
 * Ersetzt IBANs, Kreditkartennummern und Telefonnummern durch Platzhalter.
 * Die KI kennt die Platzhalter (siehe prompts.ts) und erfindet keine Werte.
 */

export type MaskStats = { iban: number; card: number; phone: number };

// IBAN: Ländercode + Prüfziffer + 11–30 alphanumerische Zeichen, optional in 4er-Gruppen.
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
// Kreditkarte: 4×4 Ziffern (mit Leerzeichen/Bindestrich), Luhn-geprüft.
const CARD = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
// Telefon: international (+49 …, 0049 …) oder national mit führender 0 und mindestens
// einer weiteren Zifferngruppe. Mindestens 7 Ziffern, damit PLZ/Artikelnummern unberührt bleiben.
const PHONE = /(?:(?:\+|\b00)\d{1,3}[\s\-/]?(?:\(0\)[\s\-/]?)?\d{1,5}|\b0\d{2,5})(?:[\s\-/]?\d{1,8}){1,5}\b/g;

function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function maskSensitive(text: string): { text: string; stats: MaskStats } {
  const stats: MaskStats = { iban: 0, card: 0, phone: 0 };
  let out = text.replace(IBAN, (m) => {
    // Mindestlänge 15 (Norwegen) – verhindert Treffer auf kurze Codes.
    if (m.replace(/\s/g, "").length < 15) return m;
    stats.iban++;
    return "[IBAN]";
  });
  out = out.replace(CARD, (m) => {
    if (!luhn(m)) return m;
    stats.card++;
    return "[KARTENNUMMER]";
  });
  out = out.replace(PHONE, (m) => {
    if (m.replace(/\D/g, "").length < 7) return m;
    stats.phone++;
    return "[TELEFON]";
  });
  return { text: out, stats };
}
