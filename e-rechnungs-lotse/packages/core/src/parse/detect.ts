import type { DetectedFormat, InvoiceProfile } from "../types.js";
import { parseXml, text, type XmlNode } from "./xml.js";

export class UnsupportedFormatError extends Error {
  constructor(message = "Das Dokument ist keine unterstützte E-Rechnung (UBL oder CII).") {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

export function profileFromSpecificationId(specId: string | null): InvoiceProfile {
  if (!specId) return "UNBEKANNT";
  const s = specId.toLowerCase();
  if (s.includes("xrechnung")) return "XRECHNUNG";
  if (s.includes("factur-x") || s.includes("zugferd")) return "ZUGFERD_FACTURX";
  if (s.startsWith("urn:cen.eu:en16931:2017")) return "EN16931";
  return "UNBEKANNT";
}

export function detectFromTree(tree: XmlNode): { format: DetectedFormat; root: XmlNode } {
  const ublInvoice = tree["Invoice"];
  const ublCredit = tree["CreditNote"];
  const cii = tree["CrossIndustryInvoice"];

  if (ublInvoice || ublCredit) {
    const root = (ublInvoice ?? ublCredit) as XmlNode;
    const specificationId = text(root, "CustomizationID");
    return {
      root,
      format: {
        syntax: "UBL",
        documentType: ublInvoice ? "Invoice" : "CreditNote",
        specificationId,
        profile: profileFromSpecificationId(specificationId),
      },
    };
  }
  if (cii) {
    const root = cii as XmlNode;
    const specificationId = text(
      root,
      "ExchangedDocumentContext",
      "GuidelineSpecifiedDocumentContextParameter",
      "ID",
    );
    return {
      root,
      format: {
        syntax: "CII",
        documentType: "CrossIndustryInvoice",
        specificationId,
        profile: profileFromSpecificationId(specificationId),
      },
    };
  }
  throw new UnsupportedFormatError();
}

export function detectFormat(xml: string): DetectedFormat {
  return detectFromTree(parseXml(xml)).format;
}
