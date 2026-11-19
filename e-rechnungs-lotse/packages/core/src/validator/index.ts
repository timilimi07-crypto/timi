/**
 * Client für den KoSIT-Validator im Daemon-Modus (services/validator) und Übersetzung des Prüfberichts.
 * POST / mit dem XML im Body → Bericht (VARL). HTTP 200 = Annahme empfohlen, 406 = Ablehnung empfohlen.
 */
import { finding, type FindingSeverity, type ValidationFinding } from "../findings";
import { attr, list, parseXml, text, type XmlNode } from "../parse/xml";

export type ValidatorResult =
  | {
      status: "geprueft";
      accepted: boolean;
      scenario: string | null;
      engine: string | null;
      findings: ValidationFinding[];
      reportXml: string;
    }
  | {
      status: "kein_szenario";
      engine: string | null;
      findings: ValidationFinding[];
      reportXml: string;
    }
  | { status: "nicht_erreichbar"; reason: string; findings: ValidationFinding[] };

export interface ValidatorClient {
  validate(xml: string): Promise<ValidatorResult>;
}

export interface ValidatorClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const LEVEL: Record<string, FindingSeverity> = {
  error: "error",
  warning: "warning",
  information: "info",
};

/** XPath aus dem Bericht kürzen: "/Q{urn:…}Invoice[1]/Q{urn:…}ID[1]" → "/Invoice[1]/ID[1]". */
export function simplifyXpath(xpath: string): string {
  return xpath.replace(/Q\{[^}]*\}/g, "").replace(/\/[a-z]+:/gi, "/");
}

function messageFindings(report: XmlNode): ValidationFinding[] {
  const out: ValidationFinding[] = [];
  // Schritte stehen je nach Validator-Version unter rep:scenarioMatched oder direkt unter rep:report.
  const steps = [
    ...list(report, "validationStepResult"),
    ...list(report, "scenarioMatched", "validationStepResult"),
  ];
  for (const step of steps) {
    for (const msg of list(step, "message")) {
      const level = LEVEL[attr(msg, "level") ?? ""] ?? "error";
      const code = attr(msg, "code") ?? attr(msg, "id") ?? "KOSIT";
      const raw = (text(msg) ?? "").replace(/\s+/g, " ").trim();
      const xpath = attr(msg, "xpathLocation");
      const line = attr(msg, "lineNumber");
      const col = attr(msg, "columnNumber");
      const location = xpath
        ? simplifyXpath(xpath)
        : line
          ? `Zeile ${line}${col ? `, Spalte ${col}` : ""}`
          : null;
      const userText = raw.replace(/^\[[^\]]+\]\s*/, "");
      out.push(
        finding("validator", level, code, {
          location,
          technicalMessage: raw || code,
          // Für Regeln ohne Eintrag in der Erklärtabelle bleibt der Text des Prüfprogramms sichtbar.
          fallbackMessage: userText || "Formaler Fehler in der Rechnung.",
        }),
      );
    }
  }
  return out;
}

/** Wandelt einen KoSIT-Prüfbericht (XML) in ein Ergebnis um. */
export function interpretReport(
  reportXml: string,
): Exclude<ValidatorResult, { status: "nicht_erreichbar" }> {
  const tree = parseXml(reportXml, ["validationStepResult", "message"]);
  const report = tree["report"] as XmlNode | undefined;
  if (!report) throw new Error("Antwort des Validators ist kein Prüfbericht.");
  const engine = text(report, "engine", "name");

  if (report["noScenarioMatched"] !== undefined) {
    return {
      status: "kein_szenario",
      engine,
      reportXml,
      findings: [
        finding("validator", "warning", "KOSIT-KEIN-SZENARIO", {
          technicalMessage:
            "KoSIT: noScenarioMatched (Profil/Version nicht in der XRechnung-Konfiguration)",
        }),
      ],
    };
  }

  const accepted =
    report["assessment"] !== undefined && (report["assessment"] as XmlNode)["accept"] !== undefined;
  const findings = messageFindings(report);
  if (!accepted && !findings.some((f) => f.severity === "error")) {
    findings.push(
      finding("validator", "error", "KOSIT-ABGELEHNT", {
        technicalMessage: "KoSIT assessment: reject",
      }),
    );
  }
  return {
    status: "geprueft",
    accepted,
    scenario: text(report, "scenarioMatched", "scenario", "name"),
    engine,
    findings,
    reportXml,
  };
}

function unreachable(reason: string): ValidatorResult {
  return {
    status: "nicht_erreichbar",
    reason,
    findings: [
      finding("validator", "info", "KOSIT-NICHT-ERREICHBAR", {
        technicalMessage: `Validator nicht erreichbar: ${reason}`,
      }),
    ],
  };
}

export function createValidatorClient(opts: ValidatorClientOptions): ValidatorClient {
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = opts.baseUrl.replace(/\/+$/, "") + "/";
  return {
    async validate(xml) {
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          body: xml,
          headers: { "Content-Type": "application/xml", Accept: "application/xml" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        return unreachable(
          name === "TimeoutError"
            ? `Zeitüberschreitung nach ${timeoutMs} ms`
            : String((e as Error)?.message ?? e),
        );
      }
      if (res.status !== 200 && res.status !== 406) {
        return unreachable(`HTTP ${res.status}`);
      }
      const body = await res.text();
      try {
        return interpretReport(body);
      } catch (e) {
        return unreachable(`Unlesbarer Prüfbericht: ${(e as Error).message}`);
      }
    },
  };
}
