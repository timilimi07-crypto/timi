/**
 * PDF-Auswertung für ZUGFeRD/Factur-X mit pdf.js (Mozilla).
 * Sicherheit: pdf.js ab v6 enthält keinen `eval`-Pfad mehr (vgl. CVE-2024-4367); zusätzlich keine
 * Schriftarten-Einbindung, keine Systemschriften, keine Netzwerkzugriffe. Es wird nur gelesen: Anhänge, Text und XMP-Metadaten.
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfAttachment {
  filename: string;
  content: Uint8Array;
}

export interface PdfInspection {
  pageCount: number;
  attachments: PdfAttachment[];
  /** Text aller Seiten (begrenzt auf `maxPages`), Seiten durch Zeilenumbruch getrennt. */
  text: string;
  /** PDF/A-Teil aus den XMP-Metadaten (z. B. "3") oder `null`. */
  pdfaPart: string | null;
}

/** Bevorzugte Anhangnamen (Kleinschreibung): Factur-X/ZUGFeRD 2.1+, ZUGFeRD 2.0, XRechnung-Profil, ZUGFeRD 1.0. */
export const INVOICE_ATTACHMENT_NAMES = [
  "factur-x.xml",
  "zugferd-invoice.xml",
  "xrechnung.xml",
  "zugferd_invoice.xml",
] as const;

export class PdfReadError extends Error {
  constructor(cause: unknown) {
    super("Die PDF-Datei konnte nicht gelesen werden.", { cause });
    this.name = "PdfReadError";
  }
}

export function isPdf(bytes: Uint8Array): boolean {
  // Laut Spezifikation darf "%PDF-" innerhalb der ersten 1024 Bytes stehen.
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

/** PDF/A-Kennung direkt aus dem (unkomprimierten) XMP-Paket lesen – Element- und Attributschreibweise. */
export function pdfaPartFromBytes(bytes: Uint8Array): string | null {
  const raw = Buffer.from(bytes).toString("latin1");
  const m =
    raw.match(/pdfaid:part\s*=\s*["'](\d)["']/) ??
    raw.match(/<pdfaid:part>\s*(\d)\s*<\/pdfaid:part>/);
  return m?.[1] ?? null;
}

export async function inspectPdf(bytes: Uint8Array, maxPages = 20): Promise<PdfInspection> {
  // Kopie übergeben: pdf.js darf den Puffer übernehmen, das Original bleibt unangetastet.
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    const attachments: PdfAttachment[] = [];
    const map = await doc.getAttachments();
    for (const [id, att] of map ?? []) {
      const content = att.content ?? (await doc.getAttachmentContent(id));
      if (content) attachments.push({ filename: att.filename, content });
    }
    const pages: string[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      pages.push(tc.items.map((i) => ("str" in i ? i.str : "")).join(" "));
    }
    return {
      pageCount: doc.numPages,
      attachments,
      text: pages.join("\n"),
      pdfaPart: pdfaPartFromBytes(bytes),
    };
  } catch (e) {
    throw new PdfReadError(e);
  } finally {
    await task.destroy();
  }
}

/**
 * Wählt den Rechnungsanhang: zuerst die Standardnamen (ohne Groß-/Kleinschreibung), sonst den einzigen
 * XML-Anhang. Liefert `null`, wenn es keinen eindeutigen Kandidaten gibt.
 */
export function selectInvoiceAttachment(
  attachments: readonly PdfAttachment[],
): { attachment: PdfAttachment; standardName: boolean } | null {
  for (const name of INVOICE_ATTACHMENT_NAMES) {
    const hit = attachments.find((a) => a.filename.toLowerCase() === name);
    if (hit) return { attachment: hit, standardName: true };
  }
  const xmls = attachments.filter((a) => a.filename.toLowerCase().endsWith(".xml"));
  return xmls.length === 1 ? { attachment: xmls[0]!, standardName: false } : null;
}
