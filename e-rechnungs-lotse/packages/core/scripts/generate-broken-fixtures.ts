/**
 * Erzeugt die absichtlich fehlerhaften Testdateien in fixtures/broken/ – deterministisch und reproduzierbar.
 * Grundlage: offizielle KoSIT-Testrechnung 01.01a (Apache-2.0, fiktive Daten) bzw. eigene synthetische Datei.
 *
 *   pnpm --filter @erl/core fixtures:broken
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AFRelationship, PDFDocument, StandardFonts } from "pdf-lib";

const root = fileURLToPath(new URL("../fixtures/", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf8");
const out = (name: string, data: string | Uint8Array) =>
  writeFileSync(root + "broken/" + name, data);

function replaceOnce(src: string, search: string | RegExp, replacement: string): string {
  const next = src.replace(search, replacement);
  if (next === src) throw new Error(`Muster nicht gefunden: ${String(search)}`);
  return next;
}

const FIXED_DATE = new Date("2026-01-01T00:00:00Z");

async function pdf(
  lines: string[],
  attachment?: { name: string; xml: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Testrechnung (synthetisch)");
  doc.setProducer("E-Rechnungs-Lotse Testdaten");
  doc.setCreator("generate-broken-fixtures.ts");
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 20, size: 12, font }));
  if (attachment) {
    await doc.attach(new TextEncoder().encode(attachment.xml), attachment.name, {
      mimeType: "text/xml",
      description: "Rechnungsdaten (Testdatei)",
      creationDate: FIXED_DATE,
      modificationDate: FIXED_DATE,
      afRelationship: AFRelationship.Alternative,
    });
  }
  return doc.save({ useObjectStreams: false });
}

async function main() {
  mkdirSync(root + "broken", { recursive: true });
  const ubl = read("official/kosit-xrechnung-testsuite/01.01a-INVOICE_ubl.xml");
  const cii = read("official/kosit-xrechnung-testsuite/01.01a-INVOICE_uncefact.xml");

  // 1. Falsche Summe: Brutto 336.9 → 346.9 (Zahlbetrag bleibt) → ERL-RECHNUNG-BRUTTO
  out(
    "falsche-summe.xml",
    replaceOnce(
      ubl,
      /<cbc:TaxInclusiveAmount currencyID="EUR">336.9</,
      '<cbc:TaxInclusiveAmount currencyID="EUR">346.9<',
    ),
  );

  // 2. Fehlende USt-IdNr. (und keine Steuernummer) beim Verkäufer → ERL-UST14-STEUERNR
  out(
    "fehlende-ustid.xml",
    replaceOnce(
      ubl,
      /\s*<cac:PartyTaxScheme>\s*<cbc:CompanyID>DE 123456789<\/cbc:CompanyID>[\s\S]*?<\/cac:PartyTaxScheme>/,
      "",
    ),
  );

  // 3. Fehlende Rechnungsnummer → ERL-UST14-NUMMER
  out("fehlende-rechnungsnummer.xml", replaceOnce(ubl, "<cbc:ID>123456XX</cbc:ID>", ""));

  // 4. PDF/XML-Abweichung: sichtbarer Text nennt andere Nummer und anderen Betrag → ERL-PDF-XML-ABWEICHUNG
  out(
    "pdf-xml-abweichung.pdf",
    await pdf(
      ["Rechnung (Testdatei)", "Rechnungsnummer: 999999ZZ", "Rechnungsbetrag: 1.234,56 EUR"],
      { name: "factur-x.xml", xml: cii },
    ),
  );

  // 5. MINIMUM-Profil (synthetische Daten) → ERL-PROFIL-MINIMUM
  const minimum = replaceOnce(
    read("synthetic/zugferd-cii-minimal.xml"),
    "urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended",
    "urn:factur-x.eu:1p0:minimum",
  );
  out(
    "minimum-profil.pdf",
    await pdf(["Rechnung (Testdatei)", "Rechnungsnummer: 00471", "Gesamtbetrag: 595,00 EUR"], {
      name: "factur-x.xml",
      xml: minimum,
    }),
  );

  // 6. Reines PDF ohne XML → Status keine_e_rechnung
  out(
    "pdf-ohne-xml.pdf",
    await pdf(["Rechnung (Testdatei)", "Rechnungsnummer: 4711", "Betrag: 100,00 EUR"]),
  );

  console.log("fixtures/broken/ erzeugt.");
}

await main();
