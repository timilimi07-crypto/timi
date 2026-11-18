export type InvoiceSyntax = "UBL" | "CII";

export type InvoiceProfile = "XRECHNUNG" | "ZUGFERD_FACTURX" | "EN16931" | "UNBEKANNT";

export interface DetectedFormat {
  syntax: InvoiceSyntax;
  /** UBL: Invoice oder CreditNote. CII: immer CrossIndustryInvoice. */
  documentType: "Invoice" | "CreditNote" | "CrossIndustryInvoice";
  /** BT-24 Specification identifier (CustomizationID / GuidelineSpecifiedDocumentContextParameter). */
  specificationId: string | null;
  profile: InvoiceProfile;
}

export interface Party {
  name: string | null;
  vatId: string | null;
}

export interface TaxBreakdown {
  /** BT-118 Umsatzsteuerkategorie (z. B. S, Z, E, AE). */
  category: string | null;
  /** BT-119 Steuersatz in Prozent als Dezimal-String. */
  rate: string | null;
  /** BT-116 Bemessungsgrundlage. */
  taxableAmount: string | null;
  /** BT-117 Steuerbetrag. */
  taxAmount: string | null;
}

/**
 * Normalisierte Sicht auf eine E-Rechnung.
 * ALLE Werte stammen deterministisch aus dem XML. Beträge sind exakte Dezimal-Strings.
 * Fehlende Werte sind `null` – sie werden niemals geschätzt oder ergänzt.
 */
export interface NormalizedInvoice {
  format: DetectedFormat;
  invoiceNumber: string | null; // BT-1
  issueDate: string | null; // BT-2, ISO yyyy-mm-dd
  dueDate: string | null; // BT-9, ISO yyyy-mm-dd
  typeCode: string | null; // BT-3
  currency: string | null; // BT-5
  buyerReference: string | null; // BT-10 (Leitweg-ID)
  seller: Party; // BG-4
  buyer: Party; // BG-7
  totals: {
    netAmount: string | null; // BT-109
    taxAmount: string | null; // BT-110
    grossAmount: string | null; // BT-112
    payableAmount: string | null; // BT-115
  };
  taxBreakdown: TaxBreakdown[]; // BG-23
  ibans: string[]; // BT-84
}
