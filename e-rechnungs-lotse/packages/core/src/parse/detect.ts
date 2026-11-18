import type { DetectedFormat, InvoiceProfile } from "../types.js";
import { parseXml, text, type XmlNode } from "./xml.js";

export type UnsupportedReason = "KEINE_RECHNUNG" | "ZUGFERD_1";

export class UnsupportedFormatError extends Error {
  constructor(
    public readonly reason: UnsupportedReason = "KEINE_RECHNUNG",
    message = reason === "ZUGFERD_1"
      ? "Das Dokument ist eine ZUGFeRD-1.0-Rechnung. Dieses veraltete Format erfüllt die Norm EN 16931 nicht."
      : "Das Dokument ist keine unterstützte E-Rechnung (UBL oder CII).",
  ) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

/**
 * Ermittelt das Profil aus BT-24. Reihenfolge ist wichtig, weil sich Kennungen überschneiden
 * (z. B. enthält die BASIC-Kennung "urn:cen.eu:en16931:2017#compliant#…basic").
 */
export function profileFromSpecificationId(specId: string | null): InvoiceProfile {
  if (!specId) return "UNBEKANNT";
  const s = specId.trim().toLowerCase();
  if (s.includes("xrechnung")) return "XRECHNUNG";
  if (s.includes(":extended")) return "EXTENDED";
  if (s.includes(":basicwl")) return "BASIC_WL";
  if (s.includes(":minimum")) return "MINIMUM";
  if (s.includes(":basic")) return "BASIC";
  if (s.startsWith("urn:cen.eu:en16931:2017")) return "EN16931";
  return "UNBEKANNT";
}

export function xrechnungVersionFromSpecificationId(specId: string | null): string | null {
  const m = specId?.match(/xrechnung_(\d+(?:\.\d+)*)/i);
  return m?.[1] ?? null;
}

function format(
  syntax: DetectedFormat["syntax"],
  documentType: DetectedFormat["documentType"],
  specificationId: string | null,
): DetectedFormat {
  const profile = profileFromSpecificationId(specificationId);
  return {
    syntax,
    documentType,
    specificationId,
    profile,
    xrechnungVersion:
      profile === "XRECHNUNG" ? xrechnungVersionFromSpecificationId(specificationId) : null,
  };
}

export function detectFromTree(tree: XmlNode): { format: DetectedFormat; root: XmlNode } {
  // `in` statt Wahrheitswert: Ein leeres Wurzelelement wird als "" geparst.
  const asNode = (v: unknown): XmlNode => (v && typeof v === "object" ? (v as XmlNode) : {});
  const isUblInvoice = "Invoice" in tree;

  if (isUblInvoice || "CreditNote" in tree) {
    const root = asNode(isUblInvoice ? tree["Invoice"] : tree["CreditNote"]);
    return {
      root,
      format: format("UBL", isUblInvoice ? "Invoice" : "CreditNote", text(root, "CustomizationID")),
    };
  }
  if ("CrossIndustryInvoice" in tree) {
    const root = asNode(tree["CrossIndustryInvoice"]);
    const specId = text(
      root,
      "ExchangedDocumentContext",
      "GuidelineSpecifiedDocumentContextParameter",
      "ID",
    );
    return { root, format: format("CII", "CrossIndustryInvoice", specId) };
  }
  if ("CrossIndustryDocument" in tree) throw new UnsupportedFormatError("ZUGFERD_1");
  throw new UnsupportedFormatError();
}

export function detectFormat(xml: string): DetectedFormat {
  return detectFromTree(parseXml(xml)).format;
}
