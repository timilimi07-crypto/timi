import type { NormalizedInvoice } from "../types";
import { normalizeCii } from "./cii";
import { detectFromTree } from "./detect";
import { normalizeUbl } from "./ubl";
import { parseXml } from "./xml";

export {
  detectFormat,
  UnsupportedFormatError,
  profileFromSpecificationId,
  xrechnungVersionFromSpecificationId,
  type UnsupportedReason,
} from "./detect";
export { ciiDateToIso } from "./cii";
export { MalformedXmlError, UnsafeXmlError } from "./xml";

/**
 * Liest eine XRechnung (UBL/CII) bzw. das XML einer ZUGFeRD/Factur-X-Rechnung deterministisch aus.
 * Es wird nichts geschätzt, ergänzt oder "korrigiert".
 */
export function parseInvoice(xml: string): NormalizedInvoice {
  const { root, format } = detectFromTree(parseXml(xml));
  return format.syntax === "UBL" ? normalizeUbl(root, format) : normalizeCii(root, format);
}
