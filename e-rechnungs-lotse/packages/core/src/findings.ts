/**
 * Einheitliches Modell für alle Prüfhinweise – vom KoSIT-Validator, von eigenen Regeln und von der Formaterkennung.
 */
export type FindingSeverity = "error" | "warning" | "info";

export type FindingSource = "validator" | "regel" | "format";

export interface ValidationFinding {
  severity: FindingSeverity;
  /** Stabile Regel-ID, z. B. "BR-DE-15" (Validator) oder "ERL-RECHNUNG-BRUTTO" (eigene Regel). */
  ruleId: string;
  /** Fundstelle: XPath (Validator), BT-/BG-ID (eigene Regeln) oder `null`. */
  location: string | null;
  /** Technische Originalmeldung (für Fachleute und Support). */
  technicalMessage: string;
  /** Verständlicher Text in einfachem Deutsch („Sie“-Form) für die Anzeige. */
  message: string;
  source: FindingSource;
}

export function finding(
  source: FindingSource,
  severity: FindingSeverity,
  ruleId: string,
  message: string,
  opts: { location?: string | null; technicalMessage?: string } = {},
): ValidationFinding {
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
