import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { pruefe } from "./helpers";

/** Barrierefreiheit (WCAG 2.1 AA) mit axe-core – Startzustand und alle Ergebnisarten. */
async function axe(page: Page) {
  // Aufklappbare Bereiche öffnen, damit auch deren Inhalt geprüft wird.
  await page
    .locator("details")
    .evaluateAll((els) => els.forEach((d) => d.setAttribute("open", "")));
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("Startzustand /pruefen ohne Verstöße", async ({ page }) => {
  await page.goto("/pruefen");
  expect(await axe(page)).toEqual([]);
});

for (const [name, file] of [
  ["grün", "official/kosit-xrechnung-testsuite/01.02a-INVOICE_ubl.xml"],
  ["rot", "broken/falsche-summe.xml"],
  ["grau", "broken/pdf-ohne-xml.pdf"],
  ["ZUGFeRD", "official/ferd-zugferd-2.2/EN16931_Einfach.pdf"],
] as const) {
  test(`Ergebnis ${name} ohne Verstöße`, async ({ page }) => {
    await pruefe(page, file);
    expect(await axe(page)).toEqual([]);
  });
}

test("Ampel nie nur über Farbe: Text und Symbol vorhanden", async ({ page }) => {
  await pruefe(page, "broken/falsche-summe.xml");
  const box = page.locator("[data-ampel]");
  await expect(box.locator("#ergebnis-titel")).toHaveText("Fehlerhaft");
  await expect(box.locator("svg").first()).toBeAttached();
});

test("Bedienung nur mit Tastatur", async ({ page }) => {
  await page.goto("/pruefen");
  // Tab bis zum Dateifeld; der Button folgt direkt danach.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    if (await page.getByLabel("Rechnungsdatei").evaluate((el) => el === document.activeElement))
      break;
  }
  await expect(page.getByLabel("Rechnungsdatei")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Rechnung prüfen" })).toBeFocused();
});
