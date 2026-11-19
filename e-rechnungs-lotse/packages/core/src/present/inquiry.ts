/**
 * Rückfrage an den Lieferanten – reine Textvorlage, kein Sprachmodell.
 * Rechnungsnummer und Datum stammen aus dem XML, die Punkte aus der Erklärtabelle.
 */
import type { InvoiceAnalysis } from "../analyse";
import type { ExplainedFinding } from "../explanations/index";
import { formatDate } from "./format";

export interface SupplierInquiry {
  betreff: string;
  text: string;
  /** Regel-IDs der aufgeführten Punkte (für Tests und Nachvollziehbarkeit). */
  punkte: string[];
}

/** Welche Befunde gehören in die Rückfrage? Fehler immer, Warnungen nur, wenn sie den Empfänger betreffen. */
export function isInquiryRelevant(f: ExplainedFinding): boolean {
  if (f.severity === "error") return true;
  return f.severity === "warning" && f.erklaerung.betrifft_mich_als_empfaenger;
}

function point(f: ExplainedFinding): string {
  const e = f.erklaerung;
  if (e.bitte_an_lieferant) return `${e.titel}: ${e.bitte_an_lieferant}`;
  const code = f.source === "validator" ? ` (Prüfregel ${f.ruleId})` : "";
  return `${e.titel}${code}: Bitte prüfen und korrigieren Sie diesen Punkt.`;
}

export function buildSupplierInquiry(
  analysis: InvoiceAnalysis,
  findings: readonly ExplainedFinding[],
): SupplierInquiry | null {
  const relevant = findings.filter(isInquiryRelevant);
  // Gleiche Titel nur einmal aufführen (z. B. eigene Regel und KoSIT melden dieselbe Rechenabweichung).
  const seen = new Set<string>();
  const unique = relevant.filter(
    (f) => !seen.has(f.erklaerung.titel) && seen.add(f.erklaerung.titel),
  );
  if (unique.length === 0) return null;

  const nr = analysis.invoice?.invoiceNumber ?? null;
  const datum = formatDate(analysis.invoice?.issueDate ?? null);
  const rechnung = nr
    ? `Rechnung ${nr}${datum ? ` vom ${datum}` : ""}`
    : `Rechnung (Datei „${analysis.filename}“)`;

  const keineERechnung = analysis.status === "keine_e_rechnung";
  const lines = [
    "Guten Tag,",
    "",
    `vielen Dank für Ihre ${rechnung}. Bei der Prüfung ist uns Folgendes aufgefallen:`,
    "",
    ...unique.map((f) => `- ${point(f)}`),
    "",
    keineERechnung
      ? "Bitte senden Sie uns die Rechnung als E-Rechnung (XRechnung oder ZUGFeRD ab Profil EN 16931)."
      : "Bitte senden Sie uns eine korrigierte E-Rechnung (XRechnung oder ZUGFeRD) zu.",
    "",
    "Vielen Dank und freundliche Grüße",
  ];
  return {
    betreff: `Rückfrage zu Ihrer ${rechnung}`,
    text: lines.join("\n"),
    punkte: unique.map((f) => f.ruleId),
  };
}
