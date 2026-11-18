import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["E2E_PORT"] ?? 3000);
const baseURL = process.env["E2E_BASE_URL"] ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: { baseURL, trace: "off", locale: "de-DE" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env["E2E_BASE_URL"]
    ? undefined
    : {
        command: `pnpm start --port ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env["CI"],
        timeout: 120_000,
      },
});
