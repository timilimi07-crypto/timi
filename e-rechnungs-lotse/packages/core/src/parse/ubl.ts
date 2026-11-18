import type {
  DetectedFormat,
  InvoiceLine,
  NormalizedInvoice,
  Party,
  PostalAddress,
} from "../types.js";
import { at, attr, list, text, type XmlNode } from "./xml.js";

function ublAddress(addr: unknown): PostalAddress {
  return {
    street: text(addr, "StreetName"),
    additionalStreet: text(addr, "AdditionalStreetName"),
    city: text(addr, "CityName"),
    postalCode: text(addr, "PostalZone"),
    countryCode: text(addr, "Country", "IdentificationCode"),
  };
}

function ublParty(partyRoot: unknown, withTaxNumber: boolean): Party {
  const party = at(partyRoot, "Party");
  const schemes = list(party, "PartyTaxScheme");
  const vat = schemes.find((s) => text(s, "TaxScheme", "ID") === "VAT");
  const other = schemes.find((s) => text(s, "TaxScheme", "ID") !== "VAT");
  return {
    name: text(party, "PartyLegalEntity", "RegistrationName") ?? text(party, "PartyName", "Name"),
    vatId: vat ? text(vat, "CompanyID") : null,
    taxNumber: withTaxNumber && other ? text(other, "CompanyID") : null,
    address: ublAddress(at(party, "PostalAddress")),
  };
}

function ublLine(line: unknown, quantityElement: string): InvoiceLine {
  return {
    id: text(line, "ID"),
    name: text(line, "Item", "Name"),
    quantity: text(line, quantityElement),
    unitCode: attr(at(line, quantityElement), "unitCode"),
    netAmount: text(line, "LineExtensionAmount"),
    taxCategory: text(line, "Item", "ClassifiedTaxCategory", "ID"),
    taxRate: text(line, "Item", "ClassifiedTaxCategory", "Percent"),
    periodStart: text(line, "InvoicePeriod", "StartDate"),
    periodEnd: text(line, "InvoicePeriod", "EndDate"),
    parentLineId: null,
    lineStatusReasonCode: null,
  };
}

export function normalizeUbl(root: XmlNode, format: DetectedFormat): NormalizedInvoice {
  const currency = text(root, "DocumentCurrencyCode");
  const taxTotals = list(root, "TaxTotal");
  // BT-110: TaxTotal in Rechnungswährung (ein zweites TaxTotal kann BT-111 in Buchungswährung sein).
  const mainTaxTotal =
    taxTotals.find((t) => attr((t as XmlNode)["TaxAmount"], "currencyID") === currency) ??
    taxTotals[0];
  const isCredit = format.documentType === "CreditNote";
  const lmt = at(root, "LegalMonetaryTotal");

  return {
    format,
    invoiceNumber: text(root, "ID"),
    issueDate: text(root, "IssueDate"),
    dueDate: text(root, "DueDate") ?? text(root, "PaymentMeans", "PaymentDueDate"),
    typeCode: text(root, "InvoiceTypeCode") ?? text(root, "CreditNoteTypeCode"),
    currency,
    buyerReference: text(root, "BuyerReference"),
    taxPointDate: text(root, "TaxPointDate"),
    deliveryDate: text(root, "Delivery", "ActualDeliveryDate"),
    invoicingPeriod: {
      start: text(root, "InvoicePeriod", "StartDate"),
      end: text(root, "InvoicePeriod", "EndDate"),
    },
    seller: ublParty(root["AccountingSupplierParty"], true),
    buyer: ublParty(root["AccountingCustomerParty"], false),
    taxRepresentativeVatId: text(root, "TaxRepresentativeParty", "PartyTaxScheme", "CompanyID"),
    totals: {
      lineTotal: text(lmt, "LineExtensionAmount"),
      allowanceTotal: text(lmt, "AllowanceTotalAmount"),
      chargeTotal: text(lmt, "ChargeTotalAmount"),
      netAmount: text(lmt, "TaxExclusiveAmount"),
      taxAmount: mainTaxTotal ? text(mainTaxTotal, "TaxAmount") : null,
      grossAmount: text(lmt, "TaxInclusiveAmount"),
      prepaidAmount: text(lmt, "PrepaidAmount"),
      roundingAmount: text(lmt, "PayableRoundingAmount"),
      payableAmount: text(lmt, "PayableAmount"),
    },
    taxBreakdown: list(mainTaxTotal, "TaxSubtotal").map((st) => ({
      category: text(st, "TaxCategory", "ID"),
      rate: text(st, "TaxCategory", "Percent"),
      taxableAmount: text(st, "TaxableAmount"),
      taxAmount: text(st, "TaxAmount"),
      exemptionReason: text(st, "TaxCategory", "TaxExemptionReason"),
      exemptionReasonCode: text(st, "TaxCategory", "TaxExemptionReasonCode"),
    })),
    lines: isCredit
      ? list(root, "CreditNoteLine").map((l) => ublLine(l, "CreditedQuantity"))
      : list(root, "InvoiceLine").map((l) => ublLine(l, "InvoicedQuantity")),
    ibans: list(root, "PaymentMeans")
      .map((pm) => text(pm, "PayeeFinancialAccount", "ID"))
      .filter((v): v is string => v !== null),
  };
}
