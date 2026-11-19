/**
 * Ansichtsmodell für die Prüfseite: alles, was die Oberfläche anzeigt, als einfache, serialisierbare Daten.
 * Alle Rechnungswerte kommen deterministisch aus der NormalizedInvoice (Regel a).
 */
import type { AnalysisStatus, InvoiceAnalysis } from "../analyse";
import {
  explainFindings,
  type ExplainOptions,
  type ExplainedFinding,
  type ExplanationEntry,
  mergeEquivalent,
  sensitiveValuesOf,
} from "../explanations/index";
import { lookupExplanation } from "../explanations/table";
import { formatIban } from "../iban";
import type { NormalizedInvoice, Party } from "../types";
import {
  formatAmount,
  formatDate,
  formatDecimal,
  formatRate,
  formatTaxCategory,
  formatTypeCode,
  formatUnit,
} from "./format";
import { buildSupplierInquiry, type SupplierInquiry } from "./inquiry";

export type AmpelFarbe = "gruen" | "gelb" | "rot" | "grau";

export interface Ampel {
  farbe: AmpelFarbe;
  /** Kurzes Wort für die Ampel – Farbe wird nie allein verwendet. */
  label: string;
  /** Symbolname für die Oberfläche. */
  symbol: "haken" | "ausrufezeichen" | "kreuz" | "dokument";
}

export function ampelFor(status: AnalysisStatus): Ampel {
  switch (status) {
    case "ok":
      return { farbe: "gruen", label: "In Ordnung", symbol: "haken" };
    case "warnungen":
      return { farbe: "gelb", label: "Bitte prüfen", symbol: "ausrufezeichen" };
    case "pruefung_ausstehend":
      return { farbe: "gelb", label: "Prüfung unvollständig", symbol: "ausrufezeichen" };
    case "fehlerhaft":
      return { farbe: "rot", label: "Fehlerhaft", symbol: "kreuz" };
    case "keine_e_rechnung":
      return { farbe: "grau", label: "Keine E-Rechnung", symbol: "dokument" };
  }
}

export interface PartyView {
  name: string | null;
  anschrift: string[];
  ustId: string | null;
  steuernummer: string | null;
}

export interface PaperInvoice {
  art: string;
  nummer: string | null;
  datum: string | null;
  leistungsdatum: string | null;
  faellig: string | null;
  waehrung: string | null;
  lieferant: PartyView;
  empfaenger: PartyView;
  kaeuferreferenz: string | null;
  positionen: {
    nr: string | null;
    bezeichnung: string | null;
    menge: string | null;
    einheit: string | null;
    steuersatz: string | null;
    netto: string | null;
  }[];
  steuern: {
    satz: string | null;
    kategorie: string | null;
    netto: string | null;
    steuer: string | null;
    befreiungsgrund: string | null;
  }[];
  summen: { label: string; betrag: string; hervorheben?: boolean }[];
  zahlbetrag: string | null;
  iban: string[];
}

export interface Hinweisbox {
  art: "keine_e_rechnung" | "profil";
  titel: string;
  text: string;
  schwere_hinweis?: string;
}

export interface CheckView {
  dateiname: string;
  status: AnalysisStatus;
  ampel: Ampel;
  zusammenfassung: string;
  eckdaten: { lieferant: string | null; betrag: string | null; faellig: string | null };
  hinweis: Hinweisbox | null;
  rechnung: PaperInvoice | null;
  befunde: ExplainedFinding[];
  rueckfrage: SupplierInquiry | null;
  formatLabel: string;
}

function partyView(p: Party, withTaxNumber: boolean): PartyView {
  const a = p.address;
  const ort = [a.postalCode, a.city].filter(Boolean).join(" ");
  return {
    name: p.name,
    anschrift: [
      a.street,
      a.additionalStreet,
      ort || null,
      a.countryCode && a.countryCode !== "DE" ? a.countryCode : null,
    ].filter((x): x is string => !!x),
    ustId: p.vatId,
    steuernummer: withTaxNumber ? p.taxNumber : null,
  };
}

function leistungsdatum(inv: NormalizedInvoice): string | null {
  if (inv.deliveryDate) return formatDate(inv.deliveryDate);
  const { start, end } = inv.invoicingPeriod;
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end);
}

export function paperInvoice(inv: NormalizedInvoice): PaperInvoice {
  const cur = inv.currency;
  const t = inv.totals;
  const summen: PaperInvoice["summen"] = [];
  const add = (label: string, v: string | null, hervorheben = false, nullAusblenden = false) => {
    if (nullAusblenden && v !== null && /^[+-]?0+(\.0+)?$/.test(v.trim())) return;
    const betrag = formatAmount(v, cur);
    if (betrag) summen.push(hervorheben ? { label, betrag, hervorheben } : { label, betrag });
  };
  add("Summe Positionen", t.lineTotal);
  add("Abzüglich Rabatte", t.allowanceTotal, false, true);
  add("Zuzüglich Zuschläge", t.chargeTotal, false, true);
  add("Nettobetrag", t.netAmount);
  add("Umsatzsteuer", t.taxAmount);
  add("Bruttobetrag", t.grossAmount);
  add("Bereits gezahlt", t.prepaidAmount, false, true);
  add("Rundung", t.roundingAmount, false, true);
  add("Zu zahlen", t.payableAmount, true);

  return {
    art: formatTypeCode(inv.typeCode),
    nummer: inv.invoiceNumber,
    datum: formatDate(inv.issueDate),
    leistungsdatum: leistungsdatum(inv),
    faellig: formatDate(inv.dueDate),
    waehrung: cur,
    lieferant: partyView(inv.seller, true),
    empfaenger: partyView(inv.buyer, false),
    kaeuferreferenz: inv.buyerReference,
    positionen: inv.lines.map((l) => ({
      nr: l.id,
      bezeichnung: l.name,
      menge: formatDecimal(l.quantity),
      einheit: formatUnit(l.unitCode),
      steuersatz: formatRate(l.taxRate),
      netto: formatAmount(l.netAmount, cur),
    })),
    steuern: inv.taxBreakdown.map((b) => ({
      satz: formatRate(b.rate),
      kategorie: formatTaxCategory(b.category),
      netto: formatAmount(b.taxableAmount, cur),
      steuer: formatAmount(b.taxAmount, cur),
      befreiungsgrund: b.exemptionReason ?? b.exemptionReasonCode,
    })),
    summen,
    zahlbetrag: formatAmount(t.payableAmount, cur),
    iban: inv.ibans.map(formatIban),
  };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function summarySentence(
  analysis: InvoiceAnalysis,
  findings: readonly ExplainedFinding[],
): string {
  if (analysis.status === "keine_e_rechnung") {
    return "Diese Datei ist keine E-Rechnung im Sinne des Gesetzes.";
  }
  const inv = analysis.invoice;
  const wer = inv?.seller.name ?? "Der Lieferant";
  const betrag = formatAmount(inv?.totals.payableAmount ?? null, inv?.currency ?? null);
  const bis = formatDate(inv?.dueDate ?? null);
  const kopf = betrag
    ? `${wer} verlangt ${betrag}${bis ? `, zahlbar bis ${bis}` : ""}.`
    : `Rechnung von ${wer}.`;
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  switch (analysis.status) {
    case "ok":
      return `${kopf} Die Rechnung ist in Ordnung.`;
    case "fehlerhaft":
      return `${kopf} Die Rechnung hat ${count(errors, "Fehler", "Fehler")} – bitte nicht ungeprüft bezahlen.`;
    case "warnungen":
      return `${kopf} ${count(warnings, "Punkt sollten", "Punkte sollten")} Sie kurz prüfen.`;
    case "pruefung_ausstehend":
      return `${kopf} Die formale Prüfung konnte noch nicht durchgeführt werden.`;
  }
}

function hinweisFor(analysis: InvoiceAnalysis): Hinweisbox | null {
  const box = (
    art: Hinweisbox["art"],
    titel: string,
    e: ExplanationEntry | undefined,
  ): Hinweisbox | null =>
    e
      ? {
          art,
          titel,
          text: `${e.erklaerung_einfach} ${e.was_tun}`,
          ...(e.schwere_hinweis ? { schwere_hinweis: e.schwere_hinweis } : {}),
        }
      : null;
  if (analysis.status === "keine_e_rechnung") {
    const id =
      analysis.findings.find((f) => f.severity !== "info")?.ruleId ?? "ERL-KEINE-E-RECHNUNG";
    return box(
      "keine_e_rechnung",
      "Das ist keine E-Rechnung im Sinne des Gesetzes",
      (lookupExplanation(id) ?? lookupExplanation("ERL-KEINE-E-RECHNUNG"))?.entry,
    );
  }
  if (analysis.profile === "MINIMUM" || analysis.profile === "BASIC_WL") {
    const id = analysis.profile === "MINIMUM" ? "ERL-PROFIL-MINIMUM" : "ERL-PROFIL-BASICWL";
    return box(
      "profil",
      "In Deutschland keine vollwertige E-Rechnung",
      lookupExplanation(id)?.entry,
    );
  }
  return null;
}

function formatLabel(a: InvoiceAnalysis): string {
  const profil =
    a.profile && a.profile !== "UNBEKANNT" ? ` · Profil ${a.profile.replace("_", " ")}` : "";
  switch (a.format) {
    case "ubl":
      return `XML-Rechnung (UBL)${profil}`;
    case "cii":
      return `XML-Rechnung (CII)${profil}`;
    case "zugferd_pdf":
      return `ZUGFeRD/Factur-X (PDF mit XML)${profil}`;
    case "pdf_ohne_xml":
      return "PDF ohne Rechnungsdaten";
    case "unbekannt":
      return "Unbekanntes Format";
  }
}

/** Baut das komplette Ansichtsmodell inklusive Erklärungen und Rückfrage-Text. */
export async function buildCheckView(
  analysis: InvoiceAnalysis,
  opts: ExplainOptions = {},
): Promise<CheckView> {
  const erklaert = await explainFindings(analysis.findings, {
    ...opts,
    sensitiveValues: [...(opts.sensitiveValues ?? []), ...sensitiveValuesOf(analysis.invoice)],
  });
  const befunde = mergeEquivalent(erklaert);
  const inv = analysis.invoice;
  return {
    dateiname: analysis.filename,
    status: analysis.status,
    ampel: ampelFor(analysis.status),
    zusammenfassung: summarySentence(analysis, befunde),
    eckdaten: {
      lieferant: inv?.seller.name ?? null,
      betrag: formatAmount(inv?.totals.payableAmount ?? null, inv?.currency ?? null),
      faellig: formatDate(inv?.dueDate ?? null),
    },
    hinweis: hinweisFor(analysis),
    rechnung: inv ? paperInvoice(inv) : null,
    befunde,
    rueckfrage: buildSupplierInquiry(analysis, befunde),
    formatLabel: formatLabel(analysis),
  };
}
