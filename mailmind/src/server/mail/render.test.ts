import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml, wrapEmailDocument } from "./render";

describe("sanitizeEmailHtml", () => {
  it("entfernt Skripte, Event-Handler, Formulare und iframes", () => {
    const { html } = sanitizeEmailHtml(
      `<p onclick="alert(1)">Hallo</p><script>alert(2)</script><iframe src="https://x"></iframe><form><input></form><a href="javascript:alert(3)">x</a>`,
      { allowRemoteImages: false },
    );
    expect(html).not.toMatch(/script|onclick|iframe|<form|<input|javascript:/i);
    expect(html).toContain("<p>Hallo</p>");
  });

  it("blockiert externe Bilder standardmäßig und zählt sie", () => {
    const r = sanitizeEmailHtml(`<img src="https://tracker.example/p.gif" alt="">x<img src="data:image/png;base64,AAAA">`, { allowRemoteImages: false });
    expect(r.blockedImages).toBe(1);
    expect(r.html).not.toContain("tracker.example");
    expect(r.html).toContain("data:image/png");
  });

  it("lädt externe Bilder auf Wunsch", () => {
    const r = sanitizeEmailHtml(`<img src="https://cdn.example/logo.png">`, { allowRemoteImages: true });
    expect(r.blockedImages).toBe(0);
    expect(r.html).toContain("https://cdn.example/logo.png");
  });

  it("öffnet Links in neuem Tab ohne Referrer", () => {
    const { html } = sanitizeEmailHtml(`<a href="https://firma.de">Link</a>`, { allowRemoteImages: false });
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noreferrer");
  });

  it("setzt eine strenge CSP im Dokument", () => {
    expect(wrapEmailDocument("x", { allowRemoteImages: false })).toContain("default-src 'none'; img-src data:;");
  });
});
