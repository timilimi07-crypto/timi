import type { DetectedFormat, NormalizedInvoice, Party } from "../types.js";
import { attr, list, text, type XmlNode } from "./xml.js";

function ublParty(partyRoot: unknown): Party {
  const vatScheme = list(partyRoot, "Party", "PartyTaxScheme").find(
    (s) => text(s, "TaxScheme", "ID") === "VAT",
  );
  return {
    name:
      text(partyRoot, "Party", "PartyLegalEntity", "RegistrationName") ??
      text(partyRoot, "Party", "PartyName", "Name"),
    vatId: vatScheme ? text(vatScheme, "CompanyID") : null,
  };
}

export function normalizeUbl(root: XmlNode, format: DetectedFormat): NormalizedInvoice {
  const currency = text(root, "DocumentCurrencyCode");
  const taxTotals = list(root, "TaxTotal");
  // BT-110: TaxTotal in Rechnungswährung (ein zweites TaxTotal kann BT-111 in Buchungswährung sein).
  const mainTaxTotal =
    taxTotals.find((t) => attr((t as XmlNode)["TaxAmount"], "currencyID") === currency) ??
    taxTotals[0];

  return {
    format,
    invoiceNumber: text(root, "ID"),
    issueDate: text(root, "IssueDate"),
    dueDate: text(root, "DueDate") ?? text(root, "PaymentMeans", "PaymentDueDate"),
    typeCode: text(root, "InvoiceTypeCode") ?? text(root, "CreditNoteTypeCode"),
    currency,
    buyerReference: text(root, "BuyerReference"),
    seller: ublParty((root as XmlNode)["AccountingSupplierParty"]),
    buyer: ublParty((root as XmlNode)["AccountingCustomerParty"]),
    totals: {
      netAmount: text(root, "LegalMonetaryTotal", "TaxExclusiveAmount"),
      taxAmount: mainTaxTotal ? text(mainTaxTotal, "TaxAmount") : null,
      grossAmount: text(root, "LegalMonetaryTotal", "TaxInclusiveAmount"),
      payableAmount: text(root, "LegalMonetaryTotal", "PayableAmount"),
    },
    taxBreakdown: list(mainTaxTotal, "TaxSubtotal").map((st) => ({
      category: text(st, "TaxCategory", "ID"),
      rate: text(st, "TaxCategory", "Percent"),
      taxableAmount: text(st, "TaxableAmount"),
      taxAmount: text(st, "TaxAmount"),
    })),
    ibans: list(root, "PaymentMeans")
      .map((pm) => text(pm, "PayeeFinancialAccount", "ID"))
      .filter((v): v is string => v !== null),
  };
}
