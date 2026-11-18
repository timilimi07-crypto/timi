import { decimalEquals, isDecimal, sumDecimals } from "./decimal.js";
import { isValidIban } from "./iban.js";
import type { NormalizedInvoice } from "./types.js";

export type Severity = "fehler" | "warnung" | "hinweis";

export interface Finding {
  /** Stabile Regel-ID für Tests und Auswertung. */
  ruleId: string;
  severity: Severity;
  /** Verständlicher Text in einfachem Deutsch ("Sie"-Form). */
  message: string;
  /** Betroffenes Feld (Business Term nach EN 16931), falls zutreffend. */
  field?: string;
}

/**
 * Eigene Plausibilitätsprüfungen für die Anzeige.
 * Sie ERSETZEN NICHT die formale Prüfung durch den KoSIT-Validator (Schema + Schematron).
 */
export function checkPlausibility(inv: NormalizedInvoice): Finding[] {
  const findings: Finding[] = [];
  const required: [keyof NormalizedInvoice | string, string | null, string][] = [
    ["BT-1", inv.invoiceNumber, "Die Rechnungsnummer fehlt."],
    ["BT-2", inv.issueDate, "Das Rechnungsdatum fehlt."],
    ["BT-5", inv.currency, "Die Währung fehlt."],
    ["BT-27", inv.seller.name, "Der Name des Verkäufers fehlt."],
    ["BT-115", inv.totals.payableAmount, "Der Zahlbetrag fehlt."],
  ];
  for (const [field, value, message] of required) {
    if (value === null)
      findings.push({ ruleId: "ERL-PFLICHT", severity: "fehler", message, field });
  }

  const amounts = Object.entries(inv.totals).filter(([, v]) => v !== null) as [string, string][];
  for (const [name, value] of amounts) {
    if (!isDecimal(value)) {
      findings.push({
        ruleId: "ERL-BETRAG-FORMAT",
        severity: "fehler",
        message: `Der Betrag "${value}" (${name}) ist keine gültige Zahl.`,
      });
    }
  }

  const taxAmounts = inv.taxBreakdown.map((t) => t.taxAmount);
  if (
    inv.totals.taxAmount !== null &&
    isDecimal(inv.totals.taxAmount) &&
    taxAmounts.length > 0 &&
    taxAmounts.every((v): v is string => v !== null && isDecimal(v)) &&
    !decimalEquals(sumDecimals(taxAmounts), inv.totals.taxAmount)
  ) {
    findings.push({
      ruleId: "ERL-STEUERSUMME",
      severity: "fehler",
      message:
        "Die Summe der Steuerbeträge je Steuersatz stimmt nicht mit der Gesamtsteuer überein.",
      field: "BT-110",
    });
  }

  const { netAmount, taxAmount, grossAmount } = inv.totals;
  if (
    netAmount !== null &&
    taxAmount !== null &&
    grossAmount !== null &&
    [netAmount, taxAmount, grossAmount].every(isDecimal) &&
    !decimalEquals(sumDecimals([netAmount, taxAmount]), grossAmount)
  ) {
    findings.push({
      ruleId: "ERL-BRUTTO",
      severity: "fehler",
      message: "Nettobetrag plus Steuer ergibt nicht den Bruttobetrag.",
      field: "BT-112",
    });
  }

  for (const iban of inv.ibans) {
    if (!isValidIban(iban)) {
      findings.push({
        ruleId: "ERL-IBAN",
        severity: "warnung",
        message:
          "Die IBAN in der Rechnung ist formal ungültig. Bitte prüfen Sie die Bankverbindung vor der Zahlung.",
        field: "BT-84",
      });
    }
  }

  if (inv.issueDate && inv.dueDate && inv.dueDate < inv.issueDate) {
    findings.push({
      ruleId: "ERL-FAELLIGKEIT",
      severity: "warnung",
      message: "Das Fälligkeitsdatum liegt vor dem Rechnungsdatum.",
      field: "BT-9",
    });
  }

  if (inv.format.profile === "UNBEKANNT") {
    findings.push({
      ruleId: "ERL-PROFIL",
      severity: "hinweis",
      message: "Das Rechnungsprofil (z. B. XRechnung oder ZUGFeRD) ist nicht erkennbar.",
      field: "BT-24",
    });
  }

  return findings;
}
