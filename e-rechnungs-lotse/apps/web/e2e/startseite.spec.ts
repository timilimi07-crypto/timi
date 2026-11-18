import { expect, test } from "@playwright/test";

test("Startseite zeigt den Produktnamen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("E-Rechnungs-Lotse");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E-Rechnungs-Lotse");
  await expect(page.getByRole("heading", { name: "Prüfen" })).toBeVisible();
});

test("Health-Endpunkt antwortet", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
