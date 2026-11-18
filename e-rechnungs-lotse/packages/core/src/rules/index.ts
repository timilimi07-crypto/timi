/**
 * Eigene Prüfregeln. Sie ERGÄNZEN die formale Prüfung durch den KoSIT-Validator (Schema + Schematron),
 * ersetzen sie aber nicht.
 */
import { finding, type ValidationFinding } from "../findings.js";
import { isValidIban } from "../iban.js";
import type { NormalizedInvoice } from "../types.js";
import { amountFormatFindings, arithmeticFindings } from "./arithmetic.js";
import { ustg14Findings } from "./ustg14.js";

export { amountFormatFindings, arithmeticFindings, summableLines } from "./arithmetic.js";
export { ustg14Findings } from "./ustg14.js";
export { comparePdfTextWithInvoice, amountTextVariants } from "./pdf-xml.js";

export function profileFindings(inv: NormalizedInvoice): ValidationFinding[] {
  const { profile, xrechnungVersion } = inv.format;
  switch (profile) {
    case "MINIMUM":
    case "BASIC_WL":
      return [
        finding(
          "format",
          "warning",
          profile === "MINIMUM" ? "ERL-PROFIL-MINIMUM" : "ERL-PROFIL-BASICWL",
          `Profil ${profile === "MINIMUM" ? "MINIMUM" : "BASIC WL"}: Das ist in Deutschland keine vollwertige E-Rechnung. ` +
            "Das XML enthält nicht alle Pflichtangaben. Prüfen Sie die Angaben im PDF und fordern Sie bei Bedarf eine E-Rechnung an.",
          { location: "BT-24", technicalMessage: `Profil ${profile} erfüllt EN 16931 nicht` },
        ),
      ];
    case "UNBEKANNT":
      return [
        finding(
          "format",
          "info",
          "ERL-PROFIL-UNBEKANNT",
          "Das Rechnungsprofil ist nicht erkennbar.",
          {
            location: "BT-24",
            technicalMessage: `Unbekannte Spezifikationskennung: ${inv.format.specificationId ?? "(leer)"}`,
          },
        ),
      ];
    case "XRECHNUNG":
      if (xrechnungVersion && !xrechnungVersion.startsWith("3.")) {
        return [
          finding(
            "format",
            "warning",
            "ERL-XRECHNUNG-VERSION",
            `Die Rechnung nutzt die veraltete XRechnung-Version ${xrechnungVersion}. Aktuell ist Version 3.0.`,
            { location: "BT-24", technicalMessage: `XRechnung ${xrechnungVersion} (erwartet 3.x)` },
          ),
        ];
      }
      return [];
    default:
      return [];
  }
}

export function generalFindings(inv: NormalizedInvoice): ValidationFinding[] {
  const out: ValidationFinding[] = [];
  if (!inv.currency) {
    out.push(finding("regel", "error", "ERL-PFLICHT", "Die Währung fehlt.", { location: "BT-5" }));
  }
  if (!inv.totals.payableAmount) {
    out.push(
      finding("regel", "error", "ERL-PFLICHT", "Der Zahlbetrag fehlt.", { location: "BT-115" }),
    );
  }
  for (const iban of inv.ibans) {
    if (!isValidIban(iban)) {
      out.push(
        finding(
          "regel",
          "warning",
          "ERL-IBAN",
          "Die IBAN in der Rechnung ist formal ungültig. Bitte prüfen Sie die Bankverbindung vor der Zahlung.",
          { location: "BT-84", technicalMessage: "IBAN-Prüfsumme (mod 97) oder Länge ungültig" },
        ),
      );
    }
  }
  if (inv.issueDate && inv.dueDate && inv.dueDate < inv.issueDate) {
    out.push(
      finding(
        "regel",
        "warning",
        "ERL-FAELLIGKEIT",
        "Das Fälligkeitsdatum liegt vor dem Rechnungsdatum.",
        {
          location: "BT-9",
          technicalMessage: "BT-9 < BT-2",
        },
      ),
    );
  }
  return out;
}

/** Alle eigenen Regeln auf eine normalisierte Rechnung anwenden. */
export function checkPlausibility(inv: NormalizedInvoice): ValidationFinding[] {
  const formatErrors = amountFormatFindings(inv);
  return [
    ...profileFindings(inv),
    ...generalFindings(inv),
    ...ustg14Findings(inv),
    ...formatErrors,
    ...(formatErrors.length === 0 ? arithmeticFindings(inv) : []),
  ];
}
