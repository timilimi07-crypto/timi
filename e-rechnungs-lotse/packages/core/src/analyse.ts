/**
 * Zentrale Analyse einer eingehenden Rechnungsdatei (XML oder PDF).
 *
 * Ablauf: Hash → Formaterkennung → (PDF: XML herauslösen) → Parsing → eigene Regeln → KoSIT-Validator → Status.
 * Kein Sprachmodell-Aufruf. Alle Rechnungsdaten stammen deterministisch aus dem XML (CLAUDE.md, Regel a).
 */
import { finding, hasSeverity, type ValidationFinding } from "./findings";
import { sha256Hex } from "./hash";
import {
  MalformedXmlError,
  parseInvoice,
  UnsafeXmlError,
  UnsupportedFormatError,
} from "./parse/index";
import { inspectPdf, isPdf, PdfReadError, selectInvoiceAttachment } from "./pdf/index";
import { checkPlausibility, comparePdfTextWithInvoice } from "./rules/index";
import type { InvoiceProfile, NormalizedInvoice } from "./types";
import {
  createValidatorClient,
  type ValidatorClient,
  type ValidatorResult,
} from "./validator/index";

/**
 * - `ubl` / `cii`: reine XML-Datei (XRechnung oder anderes EN-16931-XML) in UBL- bzw. CII-Syntax
 * - `zugferd_pdf`: PDF mit eingebettetem Rechnungs-XML (ZUGFeRD/Factur-X)
 * - `pdf_ohne_xml`: PDF ohne Rechnungsdaten
 * - `unbekannt`: weder erkennbares Rechnungs-XML noch PDF
 */
export type InvoiceFileFormat = "ubl" | "cii" | "zugferd_pdf" | "pdf_ohne_xml" | "unbekannt";

export type AnalysisStatus =
  "ok" | "warnungen" | "fehlerhaft" | "keine_e_rechnung" | "pruefung_ausstehend";

export type ValidationStatus =
  "geprueft" | "kein_szenario" | "nicht_erreichbar" | "nicht_durchgefuehrt";

export interface InvoiceAnalysis {
  filename: string;
  /** SHA-256 über die unveränderten Original-Bytes (CLAUDE.md, Regel b). */
  sha256: string;
  sizeBytes: number;
  format: InvoiceFileFormat;
  profile: InvoiceProfile | null;
  /** Bei ZUGFeRD: Name des eingebetteten XML-Anhangs. */
  embeddedXmlFilename: string | null;
  invoice?: NormalizedInvoice;
  validation: {
    status: ValidationStatus;
    accepted: boolean | null;
    scenario: string | null;
    engine: string | null;
  };
  findings: ValidationFinding[];
  status: AnalysisStatus;
}

export interface AnalyseOptions {
  /**
   * Validator-Client. `undefined` = aus `VALIDATOR_URL` (Standard http://localhost:8081),
   * `null` = keine formale Prüfung (Status dann höchstens `pruefung_ausstehend`).
   */
  validator?: ValidatorClient | null;
  /** Maximale Dateigröße in Bytes (Standard 25 MB). */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

function decodeXml(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.replace(/^\uFEFF/, "");
}

const looksLikeXml = (s: string) => /^\s*</.test(s);

export function computeStatus(
  format: InvoiceFileFormat,
  findings: readonly ValidationFinding[],
  validation: ValidationStatus,
  isInvoice: boolean,
): AnalysisStatus {
  if (!isInvoice || format === "pdf_ohne_xml") return "keine_e_rechnung";
  if (hasSeverity(findings, "error")) return "fehlerhaft";
  if (validation === "nicht_erreichbar" || validation === "nicht_durchgefuehrt") {
    return "pruefung_ausstehend";
  }
  if (hasSeverity(findings, "warning")) return "warnungen";
  return "ok";
}

function defaultValidator(): ValidatorClient {
  return createValidatorClient({
    baseUrl: process.env["VALIDATOR_URL"] ?? "http://localhost:8081",
  });
}

export async function analyseInvoice(
  file: Uint8Array,
  filename: string,
  options: AnalyseOptions = {},
): Promise<InvoiceAnalysis> {
  const sha256 = sha256Hex(file);
  const findings: ValidationFinding[] = [];
  const result: InvoiceAnalysis = {
    filename,
    sha256,
    sizeBytes: file.byteLength,
    format: "unbekannt",
    profile: null,
    embeddedXmlFilename: null,
    invoice: undefined,
    validation: { status: "nicht_durchgefuehrt", accepted: null, scenario: null, engine: null },
    findings,
    status: "keine_e_rechnung",
  };
  const finish = (isInvoice: boolean) => {
    result.status = computeStatus(result.format, findings, result.validation.status, isInvoice);
    return result;
  };

  if (file.byteLength > (options.maxBytes ?? DEFAULT_MAX_BYTES)) {
    findings.push(
      finding("format", "error", "ERL-DATEI-ZU-GROSS", {
        technicalMessage: `${file.byteLength} Bytes > Limit ${options.maxBytes ?? DEFAULT_MAX_BYTES}`,
      }),
    );
    return finish(false);
  }

  // 1. XML beschaffen
  let xml: string;
  let pdfText: string | null = null;
  if (isPdf(file)) {
    let pdf;
    try {
      pdf = await inspectPdf(file);
    } catch (e) {
      findings.push(
        finding("format", "error", "ERL-PDF-DEFEKT", {
          technicalMessage:
            e instanceof PdfReadError ? String((e.cause as Error)?.message ?? e.cause) : String(e),
        }),
      );
      return finish(false);
    }
    const selected = selectInvoiceAttachment(pdf.attachments);
    if (!selected) {
      result.format = "pdf_ohne_xml";
      findings.push(
        finding("format", "warning", "ERL-KEINE-E-RECHNUNG", {
          technicalMessage: `Kein Rechnungsanhang gefunden (Anhänge: ${pdf.attachments.map((a) => a.filename).join(", ") || "keine"})`,
        }),
      );
      return finish(false);
    }
    result.format = "zugferd_pdf";
    result.embeddedXmlFilename = selected.attachment.filename;
    if (!selected.standardName) {
      findings.push(
        finding("format", "info", "ERL-ZUGFERD-ANHANGNAME", {
          technicalMessage: `Anhang "${selected.attachment.filename}" statt factur-x.xml/zugferd-invoice.xml/xrechnung.xml`,
        }),
      );
    }
    if (pdf.pdfaPart !== "3") {
      findings.push(
        finding("format", "info", "ERL-PDFA3", {
          technicalMessage: `XMP pdfaid:part = ${pdf.pdfaPart ?? "fehlt"}`,
        }),
      );
    }
    xml = decodeXml(selected.attachment.content);
    pdfText = pdf.text;
  } else {
    xml = decodeXml(file);
    if (!looksLikeXml(xml)) {
      findings.push(
        finding("format", "warning", "ERL-FORMAT-UNBEKANNT", {
          technicalMessage: "Weder %PDF- noch XML erkannt",
        }),
      );
      return finish(false);
    }
  }

  // 2. Parsen (deterministisch)
  let invoice: NormalizedInvoice;
  try {
    invoice = parseInvoice(xml);
  } catch (e) {
    if (e instanceof UnsupportedFormatError) {
      findings.push(
        finding(
          "format",
          "warning",
          e.reason === "ZUGFERD_1" ? "ERL-ZUGFERD-1" : "ERL-FORMAT-UNBEKANNT",
          { technicalMessage: e.message },
        ),
      );
      return finish(false);
    }
    const unsafe = e instanceof UnsafeXmlError;
    findings.push(
      finding("format", "error", unsafe ? "ERL-XML-UNSICHER" : "ERL-XML-DEFEKT", {
        technicalMessage:
          e instanceof MalformedXmlError || unsafe ? (e as Error).message : String(e),
      }),
    );
    return finish(true);
  }

  result.invoice = invoice;
  result.profile = invoice.format.profile;
  if (result.format === "unbekannt")
    result.format = invoice.format.syntax === "UBL" ? "ubl" : "cii";

  // 3. Eigene Regeln
  findings.push(...checkPlausibility(invoice));
  if (pdfText !== null) {
    findings.push(...comparePdfTextWithInvoice(pdfText, invoice));
    findings.push(
      finding("format", "info", "ERL-ZUGFERD-XML-MASSGEBLICH", {
        technicalMessage:
          "ZUGFeRD/Factur-X: eingebettetes XML ist maßgeblich, PDF ist Sichtkomponente",
      }),
    );
  }

  // 4. Formale Prüfung (KoSIT)
  const validator = options.validator === undefined ? defaultValidator() : options.validator;
  if (validator) {
    let vr: ValidatorResult;
    try {
      vr = await validator.validate(xml);
    } catch (e) {
      vr = {
        status: "nicht_erreichbar",
        reason: String((e as Error)?.message ?? e),
        findings: [
          finding("validator", "info", "KOSIT-NICHT-ERREICHBAR", {
            technicalMessage: String(e),
          }),
        ],
      };
    }
    findings.push(...vr.findings);
    result.validation = {
      status: vr.status,
      accepted: vr.status === "geprueft" ? vr.accepted : null,
      scenario: vr.status === "geprueft" ? vr.scenario : null,
      engine: vr.status === "nicht_erreichbar" ? null : vr.engine,
    };
  } else {
    findings.push(
      finding("validator", "info", "KOSIT-NICHT-KONFIGURIERT", {
        technicalMessage: "Kein Validator konfiguriert",
      }),
    );
  }

  return finish(true);
}
