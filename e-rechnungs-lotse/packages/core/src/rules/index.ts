/**
 * Eigene Prüfregeln. Sie ERGÄNZEN die formale Prüfung durch den KoSIT-Validator (Schema + Schematron),
 * ersetzen sie aber nicht.
 */
import { finding, type ValidationFinding } from "../findings";
import { isValidIban } from "../iban";
import type { NormalizedInvoice } from "../types";
import { amountFormatFindings, arithmeticFindings } from "./arithmetic";
import { ustg14Findings } from "./ustg14";

export { amountFormatFindings, arithmeticFindings, summableLines } from "./arithmetic";
export { ustg14Findings } from "./ustg14";
export { comparePdfTextWithInvoice, amountTextVariants } from "./pdf-xml";

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
          { location: "BT-24", technicalMessage: `Profil ${profile} erfüllt EN 16931 nicht` },
        ),
      ];
    case "UNBEKANNT":
      return [
        finding("format", "info", "ERL-PROFIL-UNBEKANNT", {
          location: "BT-24",
          technicalMessage: `Unbekannte Spezifikationskennung: ${inv.format.specificationId ?? "(leer)"}`,
        }),
      ];
    case "XRECHNUNG":
      if (xrechnungVersion && !xrechnungVersion.startsWith("3.")) {
        return [
          finding("format", "warning", "ERL-XRECHNUNG-VERSION", {
            location: "BT-24",
            technicalMessage: `XRechnung ${xrechnungVersion} (erwartet 3.x)`,
          }),
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
    out.push(
      finding("regel", "error", "ERL-PFLICHT-WAEHRUNG", {
        location: "BT-5",
        technicalMessage: "BT-5 fehlt",
      }),
    );
  }
  if (!inv.totals.payableAmount) {
    out.push(
      finding("regel", "error", "ERL-PFLICHT-ZAHLBETRAG", {
        location: "BT-115",
        technicalMessage: "BT-115 fehlt",
      }),
    );
  }
  for (const iban of inv.ibans) {
    if (!isValidIban(iban)) {
      out.push(
        finding("regel", "warning", "ERL-IBAN", {
          location: "BT-84",
          technicalMessage: "IBAN-Prüfsumme (mod 97) oder Länge ungültig",
        }),
      );
    }
  }
  if (inv.issueDate && inv.dueDate && inv.dueDate < inv.issueDate) {
    out.push(
      finding("regel", "warning", "ERL-FAELLIGKEIT", {
        location: "BT-9",
        technicalMessage: "BT-9 < BT-2",
      }),
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
