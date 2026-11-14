// Rendert alle SVGs zu PNG (Druckdateien transparent, 300 dpi) und PDF (Vektor) – node render.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'svg'), out = path.join(__dirname, 'druckdateien'), mock = path.join(__dirname, 'mockups');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(mock, { recursive: true });
const cm = { 'pulli-brust-10x10cm': [10, 10], 'pulli-ruecken-30x40cm': [30, 40], 'tshirt-vorne-30x30cm': [30, 30], 'tasche-30x30cm': [30, 30] };
(async () => {
  const b = await chromium.launch();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
    const name = f.replace('.svg', ''), svg = fs.readFileSync(path.join(dir, f), 'utf8');
    const [vw, vh] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
    const isMock = name.startsWith('mockup');
    const pxW = isMock ? vw * 2 : Math.round(cm[name][0] / 2.54 * 300), pxH = Math.round(pxW * vh / vw);
    const p = await b.newPage({ viewport: { width: pxW, height: pxH } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${pxW}" height="${pxH}"`)}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(isMock ? mock : out, name + '.png'), omitBackground: !isMock });
    if (!isMock) {
      await p.setContent(`<html><body style="margin:0">${svg.replace(/width="\d+" height="\d+"/, `width="${cm[name][0]}cm" height="${cm[name][1]}cm"`)}</body></html>`);
      await p.pdf({ path: path.join(out, name + '.pdf'), width: cm[name][0] + 'cm', height: cm[name][1] + 'cm', printBackground: true, pageRanges: '1' });
    }
    await p.close(); console.log('✓', name, pxW + 'x' + pxH);
  }
  await b.close();
})();
