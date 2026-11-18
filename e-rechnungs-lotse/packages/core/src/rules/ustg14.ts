/**
 * Pflichtangaben nach § 14 Abs. 4 UStG (vereinfachte technische Prüfung, keine Steuerberatung).
 *
 * Nr. 1 Name und Anschrift von leistendem Unternehmer und Leistungsempfänger
 * Nr. 2 Steuernummer oder USt-IdNr. des leistenden Unternehmers
 * Nr. 3 Ausstellungsdatum                 Nr. 4 Rechnungsnummer
 * Nr. 5 Menge und Art der Leistung        Nr. 6 Zeitpunkt der Lieferung/Leistung
 * Nr. 7 Entgelt je Steuersatz             Nr. 8 Steuersatz und Steuerbetrag bzw. Hinweis auf Befreiung
 *
 * Bei MINIMUM und BASIC WL fehlen Positionen und Anschriften im XML naturgemäß – dort werden nur
 * Nr. 3 und Nr. 4 geprüft (der Profil-Hinweis verweist auf die Prüfung im PDF).
 */
import { finding, type ValidationFinding } from "../findings.js";
import type { NormalizedInvoice, Party } from "../types.js";

/** Kategorien, bei denen keine deutsche USt ausgewiesen wird und ein Hinweis Pflicht ist. */
const EXEMPT_CATEGORIES = new Set(["E", "AE", "K", "G", "O"]);
const TAXED_CATEGORIES = new Set(["S", "AA", "L", "M", "B"]);

const err = (ruleId: string, location: string, message: string, technicalMessage: string) =>
  finding("regel", "error", ruleId, message, { location, technicalMessage });

function partyMissing(p: Party): string[] {
  const missing: string[] = [];
  if (!p.name) missing.push("Name");
  if (!p.address.city) missing.push("Ort");
  if (!p.address.postalCode && (p.address.countryCode ?? "DE") === "DE") missing.push("PLZ");
  return missing;
}

export function ustg14Findings(inv: NormalizedInvoice): ValidationFinding[] {
  const out: ValidationFinding[] = [];
  const reduced = inv.format.profile === "MINIMUM" || inv.format.profile === "BASIC_WL";

  if (!inv.issueDate) {
    out.push(
      err(
        "ERL-UST14-DATUM",
        "BT-2",
        "Das Rechnungsdatum fehlt.",
        "§ 14 Abs. 4 Nr. 3 UStG: BT-2 fehlt",
      ),
    );
  }
  if (!inv.invoiceNumber) {
    out.push(
      err(
        "ERL-UST14-NUMMER",
        "BT-1",
        "Die Rechnungsnummer fehlt.",
        "§ 14 Abs. 4 Nr. 4 UStG: BT-1 fehlt",
      ),
    );
  }
  if (reduced) return out;

  const sellerMissing = partyMissing(inv.seller);
  if (sellerMissing.length) {
    out.push(
      err(
        "ERL-UST14-LEISTENDER",
        "BG-4",
        `Name oder Anschrift des Rechnungsstellers sind unvollständig (fehlt: ${sellerMissing.join(", ")}).`,
        `§ 14 Abs. 4 Nr. 1 UStG: Verkäufer unvollständig (${sellerMissing.join(", ")})`,
      ),
    );
  }
  const buyerMissing = partyMissing(inv.buyer);
  if (buyerMissing.length) {
    out.push(
      err(
        "ERL-UST14-EMPFAENGER",
        "BG-7",
        `Name oder Anschrift des Rechnungsempfängers sind unvollständig (fehlt: ${buyerMissing.join(", ")}).`,
        `§ 14 Abs. 4 Nr. 1 UStG: Käufer unvollständig (${buyerMissing.join(", ")})`,
      ),
    );
  }

  if (!inv.seller.vatId && !inv.seller.taxNumber && !inv.taxRepresentativeVatId) {
    out.push(
      err(
        "ERL-UST14-STEUERNR",
        "BT-31",
        "Es fehlt die Steuernummer oder die Umsatzsteuer-Identifikationsnummer des Rechnungsstellers.",
        "§ 14 Abs. 4 Nr. 2 UStG: weder BT-31, BT-32 noch BT-63 vorhanden",
      ),
    );
  }

  if (inv.lines.length === 0) {
    out.push(
      err(
        "ERL-UST14-LEISTUNG",
        "BG-25",
        "Die Rechnung enthält keine Positionen. Menge und Art der Leistung fehlen.",
        "§ 14 Abs. 4 Nr. 5 UStG: keine Rechnungsposition (BG-25)",
      ),
    );
  } else {
    const bad = inv.lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => !l.name || !l.quantity)
      .map(({ i }) => i + 1);
    if (bad.length) {
      out.push(
        err(
          "ERL-UST14-LEISTUNG",
          `BG-25[${bad[0]}]`,
          `Bei ${bad.length === 1 ? "einer Position" : `${bad.length} Positionen`} fehlt die Menge oder die Bezeichnung der Leistung.`,
          `§ 14 Abs. 4 Nr. 5 UStG: BT-129/BT-153 fehlt in Position(en) ${bad.join(", ")}`,
        ),
      );
    }
  }

  const hasPeriodOnAllLines =
    inv.lines.length > 0 && inv.lines.every((l) => l.periodStart || l.periodEnd);
  if (
    !inv.deliveryDate &&
    !inv.invoicingPeriod.start &&
    !inv.invoicingPeriod.end &&
    !hasPeriodOnAllLines
  ) {
    out.push(
      finding(
        "regel",
        "warning",
        "ERL-UST14-ZEITPUNKT",
        "Das Liefer- oder Leistungsdatum fehlt. Steht es nicht an anderer Stelle (z. B. Hinweis „Leistungsdatum entspricht Rechnungsdatum“), ist die Rechnung unvollständig.",
        {
          location: "BT-72",
          technicalMessage:
            "§ 14 Abs. 4 Nr. 6 UStG: weder BT-72, BG-14 noch BG-26 in allen Positionen",
        },
      ),
    );
  }

  if (inv.taxBreakdown.length === 0) {
    out.push(
      err(
        "ERL-UST14-ENTGELT",
        "BG-23",
        "Die Aufschlüsselung nach Steuersätzen fehlt.",
        "§ 14 Abs. 4 Nr. 7/8 UStG: keine Umsatzsteueraufschlüsselung (BG-23)",
      ),
    );
  }
  inv.taxBreakdown.forEach((b, i) => {
    const loc = `BG-23[${i + 1}]`;
    const cat = (b.category ?? "").toUpperCase();
    if (b.taxableAmount === null) {
      out.push(
        err(
          "ERL-UST14-ENTGELT",
          `${loc}/BT-116`,
          "Für einen Steuersatz fehlt das Entgelt (Nettobetrag).",
          `§ 14 Abs. 4 Nr. 7 UStG: BT-116 fehlt in ${loc}`,
        ),
      );
    }
    if (TAXED_CATEGORIES.has(cat) && (b.rate === null || b.taxAmount === null)) {
      out.push(
        err(
          "ERL-UST14-STEUER",
          `${loc}/BT-119`,
          "Steuersatz oder Steuerbetrag fehlen.",
          `§ 14 Abs. 4 Nr. 8 UStG: BT-119/BT-117 fehlt in ${loc} (Kategorie ${cat})`,
        ),
      );
    }
    if (EXEMPT_CATEGORIES.has(cat) && !b.exemptionReason && !b.exemptionReasonCode) {
      out.push(
        err(
          "ERL-UST14-BEFREIUNG",
          `${loc}/BT-120`,
          cat === "AE"
            ? "Der Hinweis auf die Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge) fehlt."
            : "Der Hinweis auf die Steuerbefreiung fehlt.",
          `§ 14 Abs. 4 Nr. 8 UStG / § 14a UStG: BT-120/BT-121 fehlt in ${loc} (Kategorie ${cat})`,
        ),
      );
    }
  });

  return out;
}
