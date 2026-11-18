import type { NormalizedInvoice } from "../types.js";
import { normalizeCii } from "./cii.js";
import { detectFromTree } from "./detect.js";
import { normalizeUbl } from "./ubl.js";
import { parseXml } from "./xml.js";

export { detectFormat, UnsupportedFormatError, profileFromSpecificationId } from "./detect.js";
export { ciiDateToIso } from "./cii.js";
export { UnsafeXmlError } from "./xml.js";

/**
 * Liest eine XRechnung (UBL/CII) bzw. das XML einer ZUGFeRD/Factur-X-Rechnung deterministisch aus.
 * Es wird nichts geschätzt, ergänzt oder "korrigiert".
 */
export function parseInvoice(xml: string): NormalizedInvoice {
  const { root, format } = detectFromTree(parseXml(xml));
  return format.syntax === "UBL" ? normalizeUbl(root, format) : normalizeCii(root, format);
}
