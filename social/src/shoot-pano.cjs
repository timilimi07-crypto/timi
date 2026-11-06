// Exports a 5400x1350 panorama page as five seamless 1080x1350 slides.
// Usage: node shoot-pano.cjs <html> <outDir> <prefix> [query]
const { chromium } = require('playwright');
const path = require('node:path');
(async () => {
  const [html, outDir, prefix, query = ''] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 5400, height: 1350 } });
  await page.goto('file://' + path.resolve(html) + query);
  await page.evaluate(() => window.ready);
  for (let i = 0; i < 5; i++) await page.screenshot({ path: path.join(outDir, `${prefix}-${i + 1}.png`), clip: { x: i * 1080, y: 0, width: 1080, height: 1350 } });
  await page.screenshot({ path: path.join(outDir, `${prefix}-panorama.png`) });
  await browser.close();
  console.log(`wrote ${prefix}-1..5`);
})();
