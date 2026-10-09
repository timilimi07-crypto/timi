// Exports every .slide in carousel.html as a 1080x1350 PNG (Instagram 4:5 / TikTok photo mode).
// Usage: node shoot-carousel.cjs <html> <outDir>
const { chromium } = require('playwright');
const path = require('node:path');
(async () => {
  const [html, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(() => document.fonts.ready);
  const slides = await page.$$('.slide');
  for (const [i, s] of slides.entries()) await s.screenshot({ path: path.join(outDir, `weax-karussell-${i + 1}.png`) });
  await browser.close();
  console.log(`wrote ${slides.length} slides`);
})();
