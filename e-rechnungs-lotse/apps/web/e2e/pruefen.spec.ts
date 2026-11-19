import { expect, test } from "@playwright/test";
import { fixture, pruefe } from "./helpers";

test.describe("Seite /pruefen", () => {
  test("zeigt Upload und Datenschutz-Hinweis", async ({ page }) => {
    await page.goto("/pruefen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rechnung prüfen");
    await expect(page.getByText("Ihre Datei wird nach der Prüfung sofort gelöscht.")).toBeVisible();
    await expect(page.getByLabel("Rechnungsdatei")).toBeVisible();
  });

  test("gültige XRechnung → grün", async ({ page }) => {
    const titel = await pruefe(page, "official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml");
    await expect(titel).toHaveText("In Ordnung");
    await expect(titel).toBeFocused();
    await expect(page.locator("[data-ampel]")).toHaveAttribute("data-ampel", "gruen");
    await expect(page.getByText("Die Rechnung ist in Ordnung.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rückfrage an Lieferant" })).toHaveCount(0);
  });

  test("kaputte Rechnung → rot mit verständlichem Titel und Erklärung", async ({ page }) => {
    const titel = await pruefe(page, "broken/falsche-summe.xml");
    await expect(titel).toHaveText("Fehlerhaft");
    await expect(page.locator("[data-ampel]")).toHaveAttribute("data-ampel", "rot");
    const befund = page
      .getByRole("listitem")
      .filter({ hasText: "Bruttobetrag stimmt nicht" })
      .first();
    await expect(befund).toBeVisible();
    await expect(befund.getByText("Was tun?")).toBeVisible();
    // Technische Meldung ist zunächst eingeklappt und lässt sich per Tastatur öffnen.
    const summary = befund.getByText("Technische Meldung anzeigen");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(befund.getByText("ERL-RECHNUNG-BRUTTO")).toBeVisible();
  });

  test("reines PDF → keine E-Rechnung", async ({ page }) => {
    const titel = await pruefe(page, "broken/pdf-ohne-xml.pdf");
    await expect(titel).toHaveText("Keine E-Rechnung");
    await expect(page.locator("[data-ampel]")).toHaveAttribute("data-ampel", "grau");
    await expect(
      page.getByRole("heading", { name: "Das ist keine E-Rechnung im Sinne des Gesetzes" }),
    ).toBeVisible();
    await expect(page.getByText(/Übergangszeit/).first()).toBeVisible();
  });

  test("ZUGFeRD-PDF → Positionen sichtbar", async ({ page }) => {
    await pruefe(page, "official/ferd-zugferd-2.2/EN16931_Einfach.pdf");
    const tabelle = page.getByRole("table", { name: "Rechnungspositionen" });
    await expect(tabelle).toBeVisible();
    await expect(tabelle.getByRole("cell", { name: "Trennblätter A4" })).toBeVisible();
    await expect(tabelle.getByRole("cell", { name: "Joghurt Banane" })).toBeVisible();
    await expect(page.getByText("Lieferant GmbH").first()).toBeVisible();
    await expect(page.getByText("529,87 €").first()).toBeVisible();
  });

  test("MINIMUM → Hinweis „keine vollwertige E-Rechnung“", async ({ page }) => {
    await pruefe(page, "broken/minimum-profil.pdf");
    await expect(
      page.getByRole("heading", { name: "In Deutschland keine vollwertige E-Rechnung" }),
    ).toBeVisible();
  });

  test("Rückfrage-Text ist kopierbar", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Zwischenablage-Rechte nur in Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await pruefe(page, "broken/falsche-summe.xml");
    await page.getByRole("button", { name: "Rückfrage an Lieferant" }).click();
    const text = page.getByLabel(/E-Mail-Text/);
    await expect(text).toHaveValue(/Rückfrage zu Ihrer Rechnung 123456XX vom 04\.04\.2016/);
    await expect(text).toHaveValue(/Bruttobetrag stimmt nicht/);
    await page.getByRole("button", { name: "Text kopieren" }).click();
    await expect(page.getByText("Der Text wurde kopiert.", { exact: false })).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("Bitte senden Sie uns eine korrigierte E-Rechnung");
  });

  test("falscher Dateityp wird abgefangen, bevor etwas hochgeladen wird", async ({ page }) => {
    await page.goto("/pruefen");
    await page.getByLabel("Rechnungsdatei").setInputFiles({
      name: "notiz.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Hallo"),
    });
    await expect(page.getByRole("alert").filter({ hasText: "XML- oder PDF-Datei" })).toHaveText(
      "Bitte wählen Sie eine XML- oder PDF-Datei.",
    );
  });

  test("ohne Datei: verständliche Meldung", async ({ page }) => {
    await page.goto("/pruefen");
    await page.getByRole("button", { name: "Rechnung prüfen" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Datei" })).toHaveText(
      "Bitte wählen Sie zuerst eine Datei aus.",
    );
  });

  test("mobil nutzbar (kleiner Bildschirm, ohne seitliches Scrollen)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await pruefe(page, "official/ferd-zugferd-2.2/EN16931_Einfach.pdf");
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBeLessThanOrEqual(0);
  });

  test("Fixture-Pfad existiert", () => {
    expect(fixture("broken/falsche-summe.xml")).toMatch(/falsche-summe\.xml$/);
  });
});
