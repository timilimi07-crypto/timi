import { describe, expect, it } from "vitest";
import { DEMO_EMAILS } from "./demo/emails";
import { checkPhishing } from "./phishing";

const check = (id: string) => {
  const e = DEMO_EMAILS.find((x) => x.id === id)!;
  return checkPhishing({ fromName: e.from.name, fromEmail: e.from.email, subject: e.subject, text: e.text, attachments: e.attachments ?? [] });
};

describe("Phishing-Heuristik", () => {
  it("erkennt die gefälschte Bank-Mail", () => {
    const r = check("info-23");
    expect(r.suspected).toBe(true);
    expect(r.reasons).toEqual(expect.arrayContaining(["Behauptet gesperrtes Konto", "Erzeugt Zeitdruck"]));
  });

  it("erkennt die Inkasso-Mail mit ZIP-Anhang", () => {
    const r = check("bh-10");
    expect(r.suspected).toBe(true);
    expect(r.reasons.join(" ")).toContain("Forderung_Details.zip");
  });

  it("schlägt bei normaler Geschäftspost, Rechnungen und Newslettern nicht an", () => {
    const harmless = DEMO_EMAILS.filter((e) => !["info-22", "info-23", "info-24", "bh-10"].includes(e.id));
    const flagged = harmless.filter((e) =>
      checkPhishing({ fromName: e.from.name, fromEmail: e.from.email, subject: e.subject, text: e.text, attachments: e.attachments ?? [] }).suspected,
    );
    expect(flagged.map((e) => e.id)).toEqual([]);
  });

  it("wertet Links auf IP-Adressen und abweichende Antwortadressen", () => {
    const r = checkPhishing({
      fromName: "PayPal Kundenservice",
      fromEmail: "service@pp-hilfe.net",
      replyTo: "x@andere-domain.ru",
      subject: "Ihr Zugang",
      text: "Bitte hier anmelden: http://185.12.4.9/login",
      attachments: [],
    });
    expect(r.suspected).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(5);
  });
});
