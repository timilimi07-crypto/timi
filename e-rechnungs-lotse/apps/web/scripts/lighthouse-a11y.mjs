// Lighthouse-Accessibility-Messung für /pruefen. Bricht ab, wenn der Wert unter der Schwelle liegt.
//   node scripts/lighthouse-a11y.mjs [URL] [Schwelle 0..1]
// Chrome: CHROME_PATH oder der Chromium von Playwright.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000/pruefen";
const threshold = Number(process.argv[3] ?? 0.9);
const require = createRequire(import.meta.url);
const chrome = process.env.CHROME_PATH ?? require("@playwright/test").chromium.executablePath();
const out = join(mkdtempSync(join(tmpdir(), "lh-")), "report.json");

execFileSync(
  process.execPath,
  [
    require.resolve("lighthouse/cli/index.js"),
    url,
    "--only-categories=accessibility",
    "--output=json",
    `--output-path=${out}`,
    "--chrome-flags=--headless=new --no-sandbox",
    "--quiet",
  ],
  { stdio: "inherit", env: { ...process.env, CHROME_PATH: chrome } },
);

const report = JSON.parse(readFileSync(out, "utf8"));
const score = report.categories.accessibility.score;
const failed = Object.values(report.audits)
  .filter((a) => a.scoreDisplayMode === "binary" && a.score === 0)
  .map((a) => a.id);
console.log(
  `Lighthouse Accessibility ${url}: ${Math.round(score * 100)} (Schwelle ${threshold * 100})`,
);
if (failed.length) console.log(`Nicht bestanden: ${failed.join(", ")}`);
if (score < threshold) process.exit(1);
