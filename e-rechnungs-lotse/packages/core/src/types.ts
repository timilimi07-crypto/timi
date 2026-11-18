/**
 * Normalisiertes Datenmodell einer E-Rechnung nach EN 16931.
 * Jedes Feld trägt die Business-Term-ID (BT-xx / BG-xx) als JSDoc; maschinenlesbar zusätzlich in `BT_IDS`.
 *
 * ALLE Werte stammen deterministisch aus dem XML (CLAUDE.md, Regel a). Beträge sind exakte Dezimal-Strings.
 * Fehlende Werte sind `null` – sie werden nie geschätzt oder ergänzt.
 */

export type InvoiceSyntax = "UBL" | "CII";

/**
 * Profil aus BT-24 (CustomizationID bzw. GuidelineSpecifiedDocumentContextParameter).
 * MINIMUM und BASIC_WL sind in Deutschland keine vollwertigen E-Rechnungen.
 */
export type InvoiceProfile =
  "MINIMUM" | "BASIC_WL" | "BASIC" | "EN16931" | "EXTENDED" | "XRECHNUNG" | "UNBEKANNT";

export interface DetectedFormat {
  syntax: InvoiceSyntax;
  /** UBL: Invoice oder CreditNote. CII: immer CrossIndustryInvoice. */
  documentType: "Invoice" | "CreditNote" | "CrossIndustryInvoice";
  /** BT-24 Specification identifier. */
  specificationId: string | null;
  profile: InvoiceProfile;
  /** Version aus der XRechnung-Kennung, z. B. "3.0" – nur bei Profil XRECHNUNG. */
  xrechnungVersion: string | null;
}

export interface PostalAddress {
  /** BT-35 / BT-50 / BT-75 Straße und Hausnummer. */
  street: string | null;
  /** BT-36 / BT-51 Adresszusatz. */
  additionalStreet: string | null;
  /** BT-37 / BT-52 Ort. */
  city: string | null;
  /** BT-38 / BT-53 Postleitzahl. */
  postalCode: string | null;
  /** BT-40 / BT-55 Ländercode (ISO 3166-1). */
  countryCode: string | null;
}

export interface Party {
  /** BT-27 (Verkäufer) / BT-44 (Käufer) Name. */
  name: string | null;
  /** BT-31 (Verkäufer) / BT-48 (Käufer) Umsatzsteuer-Identifikationsnummer. */
  vatId: string | null;
  /** BT-32 Steuernummer des Verkäufers (beim Käufer immer `null`). */
  taxNumber: string | null;
  /** BG-5 (Verkäufer) / BG-8 (Käufer) Postanschrift. */
  address: PostalAddress;
}

export interface TaxBreakdown {
  /** BT-118 Umsatzsteuerkategorie (z. B. S, Z, E, AE, K, G, O). */
  category: string | null;
  /** BT-119 Steuersatz in Prozent. */
  rate: string | null;
  /** BT-116 Bemessungsgrundlage (Entgelt je Steuersatz). */
  taxableAmount: string | null;
  /** BT-117 Steuerbetrag. */
  taxAmount: string | null;
  /** BT-120 Befreiungsgrund (Text). */
  exemptionReason: string | null;
  /** BT-121 Befreiungsgrund (Code, z. B. VATEX-EU-AE). */
  exemptionReasonCode: string | null;
}

export interface InvoiceLine {
  /** BT-126 Positionsnummer. */
  id: string | null;
  /** BT-153 Artikelname (Art der Leistung). */
  name: string | null;
  /** BT-129 Menge. */
  quantity: string | null;
  /** BT-130 Einheit (UN/ECE Rec. 20). */
  unitCode: string | null;
  /** BT-131 Nettobetrag der Position. */
  netAmount: string | null;
  /** BT-151 Umsatzsteuerkategorie der Position. */
  taxCategory: string | null;
  /** BT-152 Steuersatz der Position. */
  taxRate: string | null;
  /** BT-134 Beginn Leistungszeitraum der Position. */
  periodStart: string | null;
  /** BT-135 Ende Leistungszeitraum der Position. */
  periodEnd: string | null;
  /** Nur CII EXTENDED: übergeordnete Position (Unterpositionen zählen nicht zur Summe). */
  parentLineId: string | null;
  /** Nur CII EXTENDED: LineStatusReasonCode (z. B. INFORMATION = nicht summenrelevant). */
  lineStatusReasonCode: string | null;
}

export interface NormalizedInvoice {
  format: DetectedFormat;
  /** BT-1 Rechnungsnummer. */
  invoiceNumber: string | null;
  /** BT-2 Rechnungsdatum (ISO yyyy-mm-dd). */
  issueDate: string | null;
  /** BT-9 Fälligkeitsdatum (ISO). */
  dueDate: string | null;
  /** BT-3 Rechnungsart (380 Rechnung, 381 Gutschrift, …). */
  typeCode: string | null;
  /** BT-5 Rechnungswährung. */
  currency: string | null;
  /** BT-10 Käuferreferenz (z. B. Leitweg-ID). */
  buyerReference: string | null;
  /** BT-7 Datum der Steuerfälligkeit (ISO). */
  taxPointDate: string | null;
  /** BT-72 Tatsächliches Liefer-/Leistungsdatum (ISO). */
  deliveryDate: string | null;
  /** BG-14 Abrechnungszeitraum: BT-73 Beginn, BT-74 Ende (ISO). */
  invoicingPeriod: { start: string | null; end: string | null };
  /** BG-4 Verkäufer (leistender Unternehmer). */
  seller: Party;
  /** BG-7 Käufer (Leistungsempfänger). */
  buyer: Party;
  /** BT-63 USt-IdNr. des Steuervertreters. */
  taxRepresentativeVatId: string | null;
  /** BG-22 Gesamtbeträge. */
  totals: {
    /** BT-106 Summe der Positionsnettobeträge. */
    lineTotal: string | null;
    /** BT-107 Summe der Abschläge auf Dokumentebene. */
    allowanceTotal: string | null;
    /** BT-108 Summe der Zuschläge auf Dokumentebene. */
    chargeTotal: string | null;
    /** BT-109 Gesamtbetrag ohne Umsatzsteuer (Netto). */
    netAmount: string | null;
    /** BT-110 Umsatzsteuer-Gesamtbetrag. */
    taxAmount: string | null;
    /** BT-112 Gesamtbetrag mit Umsatzsteuer (Brutto). */
    grossAmount: string | null;
    /** BT-113 Vorauszahlungen. */
    prepaidAmount: string | null;
    /** BT-114 Rundungsbetrag. */
    roundingAmount: string | null;
    /** BT-115 Fälliger Zahlbetrag. */
    payableAmount: string | null;
  };
  /** BG-23 Aufschlüsselung der Umsatzsteuer je Steuersatz/-kategorie. */
  taxBreakdown: TaxBreakdown[];
  /** BG-25 Rechnungspositionen. */
  lines: InvoiceLine[];
  /** BT-84 IBAN(s) des Zahlungsempfängers. */
  ibans: string[];
}

/** Maschinenlesbare Zuordnung Feldpfad → EN-16931-ID (z. B. für Anzeige und Prüfhinweise). */
export const BT_IDS = {
  invoiceNumber: "BT-1",
  issueDate: "BT-2",
  typeCode: "BT-3",
  currency: "BT-5",
  taxPointDate: "BT-7",
  dueDate: "BT-9",
  buyerReference: "BT-10",
  "format.specificationId": "BT-24",
  "seller.name": "BT-27",
  "seller.vatId": "BT-31",
  "seller.taxNumber": "BT-32",
  "seller.address": "BG-5",
  "seller.address.street": "BT-35",
  "seller.address.city": "BT-37",
  "seller.address.postalCode": "BT-38",
  "seller.address.countryCode": "BT-40",
  "buyer.name": "BT-44",
  "buyer.vatId": "BT-48",
  "buyer.address": "BG-8",
  "buyer.address.street": "BT-50",
  "buyer.address.city": "BT-52",
  "buyer.address.postalCode": "BT-53",
  "buyer.address.countryCode": "BT-55",
  taxRepresentativeVatId: "BT-63",
  deliveryDate: "BT-72",
  "invoicingPeriod.start": "BT-73",
  "invoicingPeriod.end": "BT-74",
  ibans: "BT-84",
  "totals.lineTotal": "BT-106",
  "totals.allowanceTotal": "BT-107",
  "totals.chargeTotal": "BT-108",
  "totals.netAmount": "BT-109",
  "totals.taxAmount": "BT-110",
  "totals.grossAmount": "BT-112",
  "totals.prepaidAmount": "BT-113",
  "totals.roundingAmount": "BT-114",
  "totals.payableAmount": "BT-115",
  taxBreakdown: "BG-23",
  "taxBreakdown.taxableAmount": "BT-116",
  "taxBreakdown.taxAmount": "BT-117",
  "taxBreakdown.category": "BT-118",
  "taxBreakdown.rate": "BT-119",
  "taxBreakdown.exemptionReason": "BT-120",
  "taxBreakdown.exemptionReasonCode": "BT-121",
  lines: "BG-25",
  "lines.id": "BT-126",
  "lines.quantity": "BT-129",
  "lines.unitCode": "BT-130",
  "lines.netAmount": "BT-131",
  "lines.periodStart": "BT-134",
  "lines.periodEnd": "BT-135",
  "lines.taxCategory": "BT-151",
  "lines.taxRate": "BT-152",
  "lines.name": "BT-153",
} as const;

export type BtFieldPath = keyof typeof BT_IDS;
