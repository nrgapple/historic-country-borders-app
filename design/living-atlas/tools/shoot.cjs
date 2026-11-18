/**
 * Captures every direction at desktop and phone sizes.
 *   node tools/shoot.cjs [a|b|c ...]
 * Phone: 390×844 (no insets) and 393×852 with simulated iPhone safe areas
 * (top 59 px, bottom 34 px) drawn as an island and home indicator.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT_NM = process.env.ROOT_NODE_MODULES || '/Volumes/External SSD/Developer/Projects/borders/node_modules';
const { chromium } = require(path.join(ROOT_NM, 'playwright'));
const sharp = require(path.join(ROOT_NM, 'sharp'));
const here = path.resolve(__dirname, '..');
const PAGES = { a: 'a-classic-atlas', b: 'b-modern-textbook', c: 'c-museum-exhibit' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const file = path.join(here, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(here) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAGES);
  const shots = [
    { suffix: 'desktop', viewport: { width: 1440, height: 900 }, scale: 1, mobile: false, query: '' },
    { suffix: 'phone', viewport: { width: 390, height: 844 }, scale: 2, mobile: true, query: '' },
    { suffix: 'phone-safe', viewport: { width: 393, height: 852 }, scale: 2, mobile: true, query: '?safe=59,34' },
  ];
  for (const key of which) {
    for (const s of shots) {
      const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.scale, isMobile: s.mobile, hasTouch: s.mobile });
      const page = await ctx.newPage();
      page.on('console', (m) => m.type() === 'error' && console.log(`[${key}-${s.suffix}]`, m.text()));
      page.on('pageerror', (e) => console.log(`[${key}-${s.suffix}] pageerror`, e.message));
      await page.goto(`${base}/${PAGES[key]}.html${s.query}`);
      await page.waitForSelector('html[data-map-ready]', { state: 'attached', timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const name = path.join(here, 'shots', `${PAGES[key]}-${s.suffix}.png`);
      // Palette PNG keeps the committed screenshots small without visible banding.
      const png = await page.screenshot();
      await sharp(png).png({ palette: true, quality: 96, effort: 7, dither: 0.6 }).toFile(name);
      console.log(name);
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
})();
