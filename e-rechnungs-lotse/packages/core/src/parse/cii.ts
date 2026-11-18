import type { DetectedFormat, NormalizedInvoice, Party } from "../types.js";
import { at, attr, list, text, type XmlNode } from "./xml.js";

/** CII-Datum (Format 102 = JJJJMMTT) → ISO yyyy-mm-dd. Andere Formate werden nicht geraten. */
export function ciiDateToIso(node: unknown): string | null {
  const dts = at(node, "DateTimeString");
  const value = text(dts);
  if (!value) return null;
  const fmt = attr(dts, "format");
  if ((fmt === null || fmt === "102") && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return null;
}

function ciiParty(party: unknown): Party {
  const vat = list(party, "SpecifiedTaxRegistration").find(
    (r) => attr((r as XmlNode)["ID"], "schemeID") === "VA",
  );
  return {
    name: text(party, "Name"),
    vatId: vat ? text(vat, "ID") : null,
  };
}

export function normalizeCii(root: XmlNode, format: DetectedFormat): NormalizedInvoice {
  const doc = at(root, "ExchangedDocument");
  const tx = at(root, "SupplyChainTradeTransaction");
  const agreement = at(tx, "ApplicableHeaderTradeAgreement");
  const settlement = at(tx, "ApplicableHeaderTradeSettlement");
  const summation = at(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const currency = text(settlement, "InvoiceCurrencyCode");

  const taxTotalAmounts = list(summation, "TaxTotalAmount");
  const mainTaxTotal =
    taxTotalAmounts.find((t) => attr(t, "currencyID") === currency) ?? taxTotalAmounts[0];

  return {
    format,
    invoiceNumber: text(doc, "ID"),
    issueDate: ciiDateToIso(at(doc, "IssueDateTime")),
    dueDate: ciiDateToIso(at(settlement, "SpecifiedTradePaymentTerms", "DueDateDateTime")),
    typeCode: text(doc, "TypeCode"),
    currency,
    buyerReference: text(agreement, "BuyerReference"),
    seller: ciiParty(at(agreement, "SellerTradeParty")),
    buyer: ciiParty(at(agreement, "BuyerTradeParty")),
    totals: {
      netAmount: text(summation, "TaxBasisTotalAmount"),
      taxAmount: mainTaxTotal === undefined ? null : text(mainTaxTotal),
      grossAmount: text(summation, "GrandTotalAmount"),
      payableAmount: text(summation, "DuePayableAmount"),
    },
    taxBreakdown: list(settlement, "ApplicableTradeTax").map((t) => ({
      category: text(t, "CategoryCode"),
      rate: text(t, "RateApplicablePercent"),
      taxableAmount: text(t, "BasisAmount"),
      taxAmount: text(t, "CalculatedAmount"),
    })),
    ibans: list(settlement, "SpecifiedTradeSettlementPaymentMeans")
      .map((pm) => text(pm, "PayeePartyCreditorFinancialAccount", "IBANID"))
      .filter((v): v is string => v !== null),
  };
}
