import { describe, expect, it } from "vitest";
import { deriveThreadKey, normalizeSubject, relatedMessageIds } from "./threading";

describe("Threading", () => {
  it("entfernt deutsche und englische Antwort-/Weiterleitungs-Präfixe", () => {
    expect(normalizeSubject("AW: Re: WG: Angebot Nr. 4711")).toBe("Angebot Nr. 4711");
    expect(normalizeSubject("Antw: Fwd:  Rechnung")).toBe("Rechnung");
    expect(normalizeSubject("RE[2]: Termin")).toBe("Termin");
  });

  it("bevorzugt die Thread-ID des Providers", () => {
    expect(deriveThreadKey({ providerThreadId: "t1", references: ["<a@x>"], subject: "x", fromEmail: "a@b" })).toBe("p:t1");
  });

  it("nutzt die erste Message-ID aus References als Wurzel", () => {
    const key = deriveThreadKey({ references: ["<root@x>", "<mid@x>"], inReplyTo: "<mid@x>", messageIdHeader: "<me@x>", subject: "Re: x", fromEmail: "a@b" });
    expect(key).toBe("m:root@x");
  });

  it("fällt ohne Header auf Betreff + Absender zurück", () => {
    expect(deriveThreadKey({ references: [], subject: "AW: Hallo", fromEmail: "Max@Firma.de" })).toBe("s:hallo|max@firma.de");
  });

  it("sammelt verwandte Message-IDs ohne Duplikate", () => {
    expect(relatedMessageIds({ inReplyTo: "<b@x>", references: ["<a@x>", "<b@x>"] })).toEqual(["a@x", "b@x"]);
  });
});
