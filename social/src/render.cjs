// Renders src/reel.html frame by frame and encodes it to an MP4 (1080x1920, 30 fps).
// Usage: node render.cjs <html> <out.mp4> [fps]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

(async () => {
const [html, out, fpsArg] = process.argv.slice(2);
const fps = Number(fpsArg || 30);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + path.resolve(html));
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.render(t), i / fps);
  ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 95 }));
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`wrote ${out} (${frames} frames)`);
})();
