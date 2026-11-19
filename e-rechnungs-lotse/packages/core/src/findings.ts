/**
 * Einheitliches Modell für alle Prüfhinweise – vom KoSIT-Validator, von eigenen Regeln und von der Formaterkennung.
 * Der deutsche Anzeigetext (`message`) kommt ausschließlich aus der Erklärtabelle (explanations/de.json).
 */
import { lookupExplanation } from "./explanations/table";

export type FindingSeverity = "error" | "warning" | "info";

export type FindingSource = "validator" | "regel" | "format";

/** Alle eigenen Regel-IDs. Jede braucht einen Eintrag in explanations/de.json (per Test erzwungen). */
export const OWN_RULE_IDS = [
  "ERL-BETRAG-FORMAT",
  "ERL-DATEI-ZU-GROSS",
  "ERL-FAELLIGKEIT",
  "ERL-FORMAT-UNBEKANNT",
  "ERL-IBAN",
  "ERL-KEINE-E-RECHNUNG",
  "ERL-PDF-DEFEKT",
  "ERL-PDF-KEIN-TEXT",
  "ERL-PDF-XML-ABWEICHUNG",
  "ERL-PDFA3",
  "ERL-PFLICHT-WAEHRUNG",
  "ERL-PFLICHT-ZAHLBETRAG",
  "ERL-PROFIL-BASICWL",
  "ERL-PROFIL-MINIMUM",
  "ERL-PROFIL-UNBEKANNT",
  "ERL-RECHNUNG-BRUTTO",
  "ERL-RECHNUNG-NETTO",
  "ERL-RECHNUNG-POSITIONEN",
  "ERL-RECHNUNG-STEUERSATZ",
  "ERL-RECHNUNG-STEUERSUMME",
  "ERL-RECHNUNG-ZAHLBETRAG",
  "ERL-UST14-BEFREIUNG",
  "ERL-UST14-DATUM",
  "ERL-UST14-EMPFAENGER",
  "ERL-UST14-ENTGELT",
  "ERL-UST14-LEISTENDER",
  "ERL-UST14-LEISTUNG",
  "ERL-UST14-NUMMER",
  "ERL-UST14-STEUER",
  "ERL-UST14-STEUERNR",
  "ERL-UST14-ZEITPUNKT",
  "ERL-XML-DEFEKT",
  "ERL-XML-UNSICHER",
  "ERL-XRECHNUNG-VERSION",
  "ERL-ZUGFERD-1",
  "ERL-ZUGFERD-ANHANGNAME",
  "ERL-ZUGFERD-XML-MASSGEBLICH",
  "KOSIT-ABGELEHNT",
  "KOSIT-KEIN-SZENARIO",
  "KOSIT-NICHT-ERREICHBAR",
  "KOSIT-NICHT-KONFIGURIERT",
] as const;

export type OwnRuleId = (typeof OWN_RULE_IDS)[number];

export interface ValidationFinding {
  severity: FindingSeverity;
  /** Stabile Regel-ID, z. B. "BR-DE-15" (Validator) oder "ERL-RECHNUNG-BRUTTO" (eigene Regel). */
  ruleId: string;
  /** Fundstelle: XPath (Validator), BT-/BG-ID (eigene Regeln) oder `null`. */
  location: string | null;
  /** Technische Originalmeldung (für Fachleute und Support). */
  technicalMessage: string;
  /** Kurzer deutscher Anzeigetext – Titel aus der Erklärtabelle. */
  message: string;
  source: FindingSource;
}

interface FindingOptions {
  location?: string | null;
  technicalMessage?: string;
}

export function finding(
  source: FindingSource,
  severity: FindingSeverity,
  ruleId: OwnRuleId,
  opts?: FindingOptions,
): ValidationFinding;
/** Validator-Meldungen: beliebige Regel-ID; ohne Tabelleneintrag wird `fallbackMessage` angezeigt. */
export function finding(
  source: "validator",
  severity: FindingSeverity,
  ruleId: string,
  opts: FindingOptions & { fallbackMessage: string },
): ValidationFinding;
export function finding(
  source: FindingSource,
  severity: FindingSeverity,
  ruleId: string,
  opts: FindingOptions & { fallbackMessage?: string } = {},
): ValidationFinding {
  const message = lookupExplanation(ruleId)?.entry.titel ?? opts.fallbackMessage ?? ruleId;
  return {
    severity,
    ruleId,
    location: opts.location ?? null,
    technicalMessage: opts.technicalMessage ?? message,
    message,
    source,
  };
}

export const hasSeverity = (findings: readonly ValidationFinding[], s: FindingSeverity) =>
  findings.some((f) => f.severity === s);

const ORDER: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Stabil nach Schwere sortieren (Fehler, Warnungen, Hinweise). */
export function sortBySeverity<T extends { severity: FindingSeverity }>(items: readonly T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => ORDER[a.item.severity] - ORDER[b.item.severity] || a.i - b.i)
    .map(({ item }) => item);
}
