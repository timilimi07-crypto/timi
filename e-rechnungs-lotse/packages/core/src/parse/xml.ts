import { XMLParser } from "fast-xml-parser";

export type XmlNode = Record<string, unknown>;

const ALWAYS_ARRAY = new Set([
  // UBL
  "TaxTotal",
  "TaxSubtotal",
  "PaymentMeans",
  "PartyTaxScheme",
  "PartyName",
  // CII
  "ApplicableTradeTax",
  "SpecifiedTradeSettlementPaymentMeans",
  "SpecifiedTaxRegistration",
  "SpecifiedTradePaymentTerms",
  "TaxTotalAmount",
]);

/**
 * Sicherer, deterministischer XML-Parser:
 * - Namespaces werden entfernt (UBL/CII-Präfixe variieren je nach Erzeuger).
 * - Werte bleiben Strings (`parseTagValue: false`) – "0012" oder "19.00" werden NICHT in Zahlen umgewandelt.
 * - Dokumente mit DOCTYPE werden abgelehnt (kein XXE, keine Entity-Expansion).
 *   Nur die fünf vordefinierten XML-Entitäten (&amp; usw.) werden aufgelöst.
 */
const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  isArray: (name) => ALWAYS_ARRAY.has(name),
});

export class UnsafeXmlError extends Error {
  constructor() {
    super("Das XML enthält eine DOCTYPE-Deklaration und wird aus Sicherheitsgründen abgelehnt.");
    this.name = "UnsafeXmlError";
  }
}

export function parseXml(xml: string): XmlNode {
  if (/<!DOCTYPE/i.test(xml)) throw new UnsafeXmlError();
  return parser.parse(xml) as XmlNode;
}

/** Folgt einem Pfad durch den Baum; bei Arrays wird das erste Element genommen. */
export function at(node: unknown, ...path: string[]): unknown {
  let current: unknown = node;
  for (const key of path) {
    if (Array.isArray(current)) current = current[0];
    if (current === null || typeof current !== "object") return undefined;
    current = (current as XmlNode)[key];
  }
  return current;
}

export function list(node: unknown, ...path: string[]): unknown[] {
  const value = path.length ? at(node, ...path) : node;
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Liefert den Textinhalt eines Elements (auch wenn es Attribute trägt) oder `null`. */
export function text(node: unknown, ...path: string[]): string | null {
  let value = path.length ? at(node, ...path) : node;
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "object" && "#text" in (value as XmlNode)) {
    const t = (value as XmlNode)["#text"];
    return typeof t === "string" && t !== "" ? t : null;
  }
  return null;
}

export function attr(node: unknown, name: string): string | null {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return null;
  const v = (node as XmlNode)[`@_${name}`];
  return typeof v === "string" ? v : null;
}
