/**
 * Rechenprüfung mit exakter Dezimalarithmetik (BigInt, keine Floats).
 *
 * Toleranz: 0,01 je Steuersatz (Anzahl der BG-23-Einträge, mindestens 1). Sie fängt zulässige
 * Rundungsdifferenzen ab, wenn Erzeuger je Steuersatz runden. Echte Rechenfehler sind größer.
 */
import { absBig, centAtScale, fromScaled, tryScaled } from "../decimal";
import { finding, type OwnRuleId, type ValidationFinding } from "../findings";
import type { NormalizedInvoice } from "../types";

const SCALE = 6;
const CENT = centAtScale(SCALE);

const show = (v: bigint) => fromScaled(v, SCALE);

function rule(ruleId: OwnRuleId, location: string, technicalMessage: string): ValidationFinding {
  return finding("regel", "error", ruleId, { location, technicalMessage });
}

/** Positionen, die in die Summe BT-106 eingehen (ohne EXTENDED-Unter- und Info-Positionen). */
export function summableLines(inv: NormalizedInvoice) {
  return inv.lines.filter(
    (l) => l.parentLineId === null && l.lineStatusReasonCode?.toUpperCase() !== "INFORMATION",
  );
}

export function amountFormatFindings(inv: NormalizedInvoice): ValidationFinding[] {
  const out: ValidationFinding[] = [];
  const check = (value: string | null, location: string) => {
    if (value !== null && tryScaled(value, SCALE) === null) {
      out.push(
        finding("regel", "error", "ERL-BETRAG-FORMAT", {
          location,
          technicalMessage: `Ungültiger Dezimalwert "${value}" in ${location}`,
        }),
      );
    }
  };
  check(inv.totals.lineTotal, "BT-106");
  check(inv.totals.allowanceTotal, "BT-107");
  check(inv.totals.chargeTotal, "BT-108");
  check(inv.totals.netAmount, "BT-109");
  check(inv.totals.taxAmount, "BT-110");
  check(inv.totals.grossAmount, "BT-112");
  check(inv.totals.prepaidAmount, "BT-113");
  check(inv.totals.roundingAmount, "BT-114");
  check(inv.totals.payableAmount, "BT-115");
  inv.taxBreakdown.forEach((t, i) => {
    check(t.taxableAmount, `BG-23[${i + 1}]/BT-116`);
    check(t.taxAmount, `BG-23[${i + 1}]/BT-117`);
    check(t.rate, `BG-23[${i + 1}]/BT-119`);
  });
  inv.lines.forEach((l, i) => check(l.netAmount, `BG-25[${i + 1}]/BT-131`));
  return out;
}

export function arithmeticFindings(inv: NormalizedInvoice): ValidationFinding[] {
  const out: ValidationFinding[] = [];
  const t = inv.totals;
  const tolerance = CENT * BigInt(Math.max(1, inv.taxBreakdown.length));
  const v = (s: string | null) => tryScaled(s, SCALE);
  const zero = (s: string | null) => v(s) ?? 0n;

  // 1. Summe der Positionen = BT-106
  const lines = summableLines(inv);
  const lineAmounts = lines.map((l) => v(l.netAmount));
  const lineSum = lineAmounts.every((a) => a !== null)
    ? (lineAmounts as bigint[]).reduce((a, b) => a + b, 0n)
    : null;
  const lineTotal = v(t.lineTotal);
  if (lines.length > 0 && lineSum !== null && lineTotal !== null) {
    if (absBig(lineSum - lineTotal) > tolerance) {
      out.push(
        rule(
          "ERL-RECHNUNG-POSITIONEN",
          "BT-106",
          `Summe BT-131 = ${show(lineSum)}, BT-106 = ${show(lineTotal)}`,
        ),
      );
    }
  }

  // 2. Positionen − Abschläge + Zuschläge = Netto (BT-109)
  const lineBase = lineTotal ?? (lines.length > 0 ? lineSum : null);
  const net = v(t.netAmount);
  if (lineBase !== null && net !== null) {
    const expected = lineBase - zero(t.allowanceTotal) + zero(t.chargeTotal);
    if (absBig(expected - net) > tolerance) {
      out.push(
        rule(
          "ERL-RECHNUNG-NETTO",
          "BT-109",
          `BT-106 − BT-107 + BT-108 = ${show(expected)}, BT-109 = ${show(net)}`,
        ),
      );
    }
  }

  // 3. Netto + Steuer = Brutto
  const gross = v(t.grossAmount);
  if (net !== null && gross !== null) {
    const expected = net + zero(t.taxAmount);
    if (absBig(expected - gross) > tolerance) {
      out.push(
        rule(
          "ERL-RECHNUNG-BRUTTO",
          "BT-112",
          `BT-109 + BT-110 = ${show(expected)}, BT-112 = ${show(gross)}`,
        ),
      );
    }
  }

  // 4. Summe der Steuerbeträge je Satz = Gesamtsteuer
  const taxTotal = v(t.taxAmount);
  const taxParts = inv.taxBreakdown.map((b) => v(b.taxAmount));
  if (taxTotal !== null && taxParts.length > 0 && taxParts.every((p) => p !== null)) {
    const sum = (taxParts as bigint[]).reduce((a, b) => a + b, 0n);
    if (absBig(sum - taxTotal) > tolerance) {
      out.push(
        rule(
          "ERL-RECHNUNG-STEUERSUMME",
          "BT-110",
          `Summe BT-117 = ${show(sum)}, BT-110 = ${show(taxTotal)}`,
        ),
      );
    }
  }

  // 5. Je Steuersatz: Bemessungsgrundlage × Satz = Steuerbetrag (± 0,01)
  inv.taxBreakdown.forEach((b, i) => {
    const base = v(b.taxableAmount);
    const rate = v(b.rate);
    const tax = v(b.taxAmount);
    if (base === null || rate === null || tax === null) return;
    const unit = 10n ** BigInt(SCALE);
    const expected = (base * rate) / 100n; // Skala 2·SCALE
    if (absBig(expected - tax * unit) > CENT * unit) {
      out.push(
        rule(
          "ERL-RECHNUNG-STEUERSATZ",
          `BG-23[${i + 1}]/BT-117`,
          `BT-116 × BT-119 = ${fromScaled(expected / unit, SCALE)}, BT-117 = ${show(tax)} (Toleranz 0,01)`,
        ),
      );
    }
  });

  // 6. Brutto − Vorauszahlung + Rundung = Zahlbetrag
  // Im Profil MINIMUM gibt es BT-113/BT-114 nicht – die Prüfung wäre dort nicht aussagekräftig.
  const payable = v(t.payableAmount);
  if (gross !== null && payable !== null && inv.format.profile !== "MINIMUM") {
    const expected = gross - zero(t.prepaidAmount) + zero(t.roundingAmount);
    if (absBig(expected - payable) > tolerance) {
      out.push(
        rule(
          "ERL-RECHNUNG-ZAHLBETRAG",
          "BT-115",
          `BT-112 − BT-113 + BT-114 = ${show(expected)}, BT-115 = ${show(payable)}`,
        ),
      );
    }
  }

  return out;
}
