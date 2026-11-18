import type {
  DetectedFormat,
  InvoiceLine,
  NormalizedInvoice,
  Party,
  PostalAddress,
} from "../types.js";
import { at, attr, list, text, type XmlNode } from "./xml.js";

/**
 * CII-Datum (Format 102 = JJJJMMTT) → ISO yyyy-mm-dd.
 * Liest `DateTimeString` oder `DateString`. Andere Formate werden nicht geraten (→ `null`).
 */
export function ciiDateToIso(node: unknown): string | null {
  const dts = at(node, "DateTimeString") ?? at(node, "DateString");
  const value = text(dts);
  if (!value) return null;
  const fmt = attr(dts, "format");
  if ((fmt === null || fmt === "102") && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return null;
}

function ciiAddress(addr: unknown): PostalAddress {
  return {
    street: text(addr, "LineOne"),
    additionalStreet: text(addr, "LineTwo"),
    city: text(addr, "CityName"),
    postalCode: text(addr, "PostcodeCode"),
    countryCode: text(addr, "CountryID"),
  };
}

function registration(party: unknown, scheme: string): string | null {
  const reg = list(party, "SpecifiedTaxRegistration").find(
    (r) => attr((r as XmlNode)["ID"], "schemeID") === scheme,
  );
  return reg ? text(reg, "ID") : null;
}

function ciiParty(party: unknown, withTaxNumber: boolean): Party {
  return {
    name: text(party, "Name"),
    vatId: registration(party, "VA"),
    taxNumber: withTaxNumber ? registration(party, "FC") : null,
    address: ciiAddress(at(party, "PostalTradeAddress")),
  };
}

function ciiLine(item: unknown): InvoiceLine {
  const doc = at(item, "AssociatedDocumentLineDocument");
  const settlement = at(item, "SpecifiedLineTradeSettlement");
  const qty = at(item, "SpecifiedLineTradeDelivery", "BilledQuantity");
  return {
    id: text(doc, "LineID"),
    name: text(item, "SpecifiedTradeProduct", "Name"),
    quantity: text(qty),
    unitCode: attr(qty, "unitCode"),
    netAmount: text(settlement, "SpecifiedTradeSettlementLineMonetarySummation", "LineTotalAmount"),
    taxCategory: text(settlement, "ApplicableTradeTax", "CategoryCode"),
    taxRate: text(settlement, "ApplicableTradeTax", "RateApplicablePercent"),
    periodStart: ciiDateToIso(at(settlement, "BillingSpecifiedPeriod", "StartDateTime")),
    periodEnd: ciiDateToIso(at(settlement, "BillingSpecifiedPeriod", "EndDateTime")),
    parentLineId: text(doc, "ParentLineID"),
    lineStatusReasonCode: text(doc, "LineStatusReasonCode"),
  };
}

export function normalizeCii(root: XmlNode, format: DetectedFormat): NormalizedInvoice {
  const doc = at(root, "ExchangedDocument");
  const tx = at(root, "SupplyChainTradeTransaction");
  const agreement = at(tx, "ApplicableHeaderTradeAgreement");
  const delivery = at(tx, "ApplicableHeaderTradeDelivery");
  const settlement = at(tx, "ApplicableHeaderTradeSettlement");
  const summation = at(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const currency = text(settlement, "InvoiceCurrencyCode");

  const taxTotalAmounts = list(summation, "TaxTotalAmount");
  const mainTaxTotal =
    taxTotalAmounts.find((t) => attr(t, "currencyID") === currency) ?? taxTotalAmounts[0];
  const taxes = list(settlement, "ApplicableTradeTax");

  return {
    format,
    invoiceNumber: text(doc, "ID"),
    issueDate: ciiDateToIso(at(doc, "IssueDateTime")),
    dueDate: ciiDateToIso(at(settlement, "SpecifiedTradePaymentTerms", "DueDateDateTime")),
    typeCode: text(doc, "TypeCode"),
    currency,
    buyerReference: text(agreement, "BuyerReference"),
    taxPointDate: ciiDateToIso(at(taxes[0], "TaxPointDate")),
    deliveryDate: ciiDateToIso(
      at(delivery, "ActualDeliverySupplyChainEvent", "OccurrenceDateTime"),
    ),
    invoicingPeriod: {
      start: ciiDateToIso(at(settlement, "BillingSpecifiedPeriod", "StartDateTime")),
      end: ciiDateToIso(at(settlement, "BillingSpecifiedPeriod", "EndDateTime")),
    },
    seller: ciiParty(at(agreement, "SellerTradeParty"), true),
    buyer: ciiParty(at(agreement, "BuyerTradeParty"), false),
    taxRepresentativeVatId: registration(at(agreement, "SellerTaxRepresentativeTradeParty"), "VA"),
    totals: {
      lineTotal: text(summation, "LineTotalAmount"),
      allowanceTotal: text(summation, "AllowanceTotalAmount"),
      chargeTotal: text(summation, "ChargeTotalAmount"),
      netAmount: text(summation, "TaxBasisTotalAmount"),
      taxAmount: mainTaxTotal === undefined ? null : text(mainTaxTotal),
      grossAmount: text(summation, "GrandTotalAmount"),
      prepaidAmount: text(summation, "TotalPrepaidAmount"),
      roundingAmount: text(summation, "RoundingAmount"),
      payableAmount: text(summation, "DuePayableAmount"),
    },
    taxBreakdown: taxes.map((t) => ({
      category: text(t, "CategoryCode"),
      rate: text(t, "RateApplicablePercent"),
      taxableAmount: text(t, "BasisAmount"),
      taxAmount: text(t, "CalculatedAmount"),
      exemptionReason: text(t, "ExemptionReason"),
      exemptionReasonCode: text(t, "ExemptionReasonCode"),
    })),
    lines: list(tx, "IncludedSupplyChainTradeLineItem").map(ciiLine),
    ibans: list(settlement, "SpecifiedTradeSettlementPaymentMeans")
      .map((pm) => text(pm, "PayeePartyCreditorFinancialAccount", "IBANID"))
      .filter((v): v is string => v !== null),
  };
}
