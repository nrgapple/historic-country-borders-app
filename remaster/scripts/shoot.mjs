// Screenshots of the remaster for design review against the Direction A mocks.
//   node scripts/shoot.mjs [baseUrl] [outDir]
// Defaults: http://127.0.0.1:4410 and ../docs/product/remaster-shots.
// Needs a running preview (yarn remaster:preview) and Playwright's Chromium
// (PLAYWRIGHT_BROWSERS_PATH on the SSD).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { APP } from './lib.mjs';

const base = process.argv[2] || 'http://127.0.0.1:4410';
const out = path.resolve(process.argv[3] || path.join(APP, '../docs/product/remaster-shots'));
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(out, { recursive: true });

const OTTOMAN = 'place=Ottoman%20Empire';
const SHOTS = [
  // The mock's desktop camera: Europe to the Caspian, the panel on the right.
  { name: '1492-ottoman-1440x900', url: `/year/1492?lng=29.5&lat=44.5&zoom=2.95&${OTTOMAN}`, width: 1440, height: 900 },
  { name: '1492-ottoman-1024x768', url: `/year/1492?lng=32&lat=43&zoom=2.9&${OTTOMAN}`, width: 1024, height: 768, touch: true },
  // Phones frame the selection above the bottom sheet (no camera in the link).
  { name: '1492-ottoman-390x844', url: `/year/1492?${OTTOMAN}`, width: 390, height: 844, touch: true },
  { name: '1914-1440x900', url: '/year/1914?lng=15&lat=47&zoom=3.2', width: 1440, height: 900 },
  { name: '1914-1024x768', url: '/year/1914?lng=15&lat=47&zoom=2.9', width: 1024, height: 768, touch: true },
  { name: '1914-390x844', url: '/year/1914?lng=18&lat=46&zoom=2.6', width: 390, height: 844, touch: true },
  // iPhone 15 Pro with simulated insets (Chromium CDP), like the design's phone-safe shot.
  { name: '1492-ottoman-iphone-insets-393x852', url: `/year/1492?${OTTOMAN}`, width: 393, height: 852, touch: true, insets: { top: 59, bottom: 34 } },
];

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const shot of SHOTS) {
  if (only && !only.test(shot.name)) continue;
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    hasTouch: Boolean(shot.touch),
    isMobile: shot.width < 700,
  });
  const page = await context.newPage();
  // Wikipedia is the only third-party request (on selection); keep shots
  // deterministic and offline with a fixed summary.
  await page.route('https://en.wikipedia.org/**', (route) =>
    route.fulfill({
      json: {
        query: {
          pages: {
            1: {
              title: 'Ottoman Empire',
              extract:
                'The Ottoman Empire controlled much of Southeast Europe, West Asia and North Africa from the 14th to the early 20th century. It was founded at the end of the 13th century in northwestern Anatolia by the Turkoman tribal leader Osman I. After 1354 the Ottomans crossed into Europe, and with the conquest of the Balkans the beylik became a transcontinental empire.',
              fullurl: 'https://en.wikipedia.org/wiki/Ottoman_Empire',
            },
          },
        },
      },
    }),
  );
  if (shot.insets) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: shot.insets.top, bottom: shot.insets.bottom, left: 0, right: 0 },
    });
  }
  await page.goto(`${base}${shot.url}`);
  await page.waitForSelector('[data-testid="map-container"][data-data-state="ready"]', { timeout: 60_000 });
  // Let labels place, relief load and the camera settle.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = window.__atlasMap;
        if (!map) return resolve(undefined);
        const done = () => setTimeout(resolve, 600);
        if (map.loaded() && !map.isMoving()) map.once('idle', done);
        else map.once('idle', done);
        map.triggerRepaint();
      }),
  );
  await page.waitForTimeout(800);
  if (shot.insets) {
    // Draw the Dynamic Island and home indicator, as the design shots do.
    await page.addStyleTag({
      content: `.sim-island{position:fixed;top:11px;left:50%;width:126px;height:37px;margin-left:-63px;border-radius:20px;background:#000;z-index:999}
.sim-home{position:fixed;bottom:8px;left:50%;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:#111;z-index:999}`,
    });
    await page.evaluate(() => {
      for (const c of ['sim-island', 'sim-home']) {
        const el = document.createElement('div');
        el.className = c;
        document.body.append(el);
      }
    });
  }
  const file = path.join(out, `${shot.name}.png`);
  await page.screenshot({ path: file });
  console.log(`${shot.name}: ${path.relative(process.cwd(), file)}`);
  await context.close();
}
await browser.close();
