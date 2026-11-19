/**
 * ZUGFeRD/Factur-X: Abgleich der Sichtkomponente (PDF-Text) mit dem XML.
 * Das XML ist rechtlich maßgeblich – Abweichungen werden nur gemeldet, nie "korrigiert".
 */
import { finding, type ValidationFinding } from "../findings";
import type { NormalizedInvoice } from "../types";

const MIN_TEXT_CHARS = 20;

const squash = (s: string) => s.replace(/\s+/g, "");

function group(int: string, sep: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Schreibweisen eines Betrags im PDF: 1480,43 · 1.480,43 · 1480.43 · 1,480.43 (Vorzeichen ignoriert). */
export function amountTextVariants(amount: string): string[] {
  const m = amount.trim().match(/^[+-]?(\d+)(?:\.(\d+))?$/);
  if (!m) return [];
  const int = m[1]!.replace(/^0+(?=\d)/, "");
  let frac = (m[2] ?? "").replace(/0+$/, "");
  if (frac.length > 2) return [];
  frac = frac.padEnd(2, "0");
  return [
    `${int},${frac}`,
    `${group(int, ".")},${frac}`,
    `${int}.${frac}`,
    `${group(int, ",")}.${frac}`,
  ];
}

export function comparePdfTextWithInvoice(
  pdfText: string,
  inv: NormalizedInvoice,
): ValidationFinding[] {
  const hay = squash(pdfText);
  if (hay.length < MIN_TEXT_CHARS) {
    return [
      finding("format", "info", "ERL-PDF-KEIN-TEXT", {
        technicalMessage: "PDF-Textebene leer (z. B. gescanntes Bild)",
      }),
    ];
  }

  const missing: string[] = [];
  if (inv.invoiceNumber && !hay.includes(squash(inv.invoiceNumber))) {
    missing.push("Rechnungsnummer (BT-1)");
  }
  const gross = inv.totals.grossAmount ?? inv.totals.payableAmount;
  if (gross) {
    const variants = amountTextVariants(gross);
    if (variants.length && !variants.some((v) => hay.includes(v))) {
      missing.push(inv.totals.grossAmount ? "Bruttobetrag (BT-112)" : "Zahlbetrag (BT-115)");
    }
  }
  if (missing.length === 0) return [];
  return [
    finding("format", "warning", "ERL-PDF-XML-ABWEICHUNG", {
      location: missing.map((m) => m.match(/BT-\d+/)?.[0]).join(", "),
      technicalMessage: `Im PDF-Text nicht gefunden: ${missing.join(", ")}`,
    }),
  ];
}
