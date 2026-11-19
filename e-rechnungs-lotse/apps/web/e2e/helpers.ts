import { expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

export const fixture = (p: string) =>
  fileURLToPath(new URL(`../../../packages/core/fixtures/${p}`, import.meta.url));

/** Datei auf /pruefen hochladen und auf das Ergebnis warten. */
export async function pruefe(page: Page, path: string) {
  await page.goto("/pruefen");
  await page.getByLabel("Rechnungsdatei").setInputFiles(fixture(path));
  await page.getByRole("button", { name: "Rechnung prüfen" }).click();
  const titel = page.locator("#ergebnis-titel");
  await expect(titel).toBeVisible({ timeout: 30_000 });
  return titel;
}
