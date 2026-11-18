// Design-review screenshots of the first-visit welcome and two tour cards.
//   node scripts/shoot-welcome.mjs [baseUrl] [outDir]
// Defaults: http://127.0.0.1:4410 and docs/product/remaster-shots/.
// Needs a running preview (yarn preview) and Playwright's Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT } from './lib/app.mjs';

const base = process.argv[2] || 'http://127.0.0.1:4410';
const out = path.resolve(
  process.argv[3] || path.join(ROOT, 'docs/product/remaster-shots'),
);
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(out, { recursive: true });

const SIZES = [
  {
    id: '1440x900',
    width: 1440,
    height: 900,
    url: '/year/1914?lng=15&lat=47&zoom=3.2',
  },
  {
    id: '390x844',
    width: 390,
    height: 844,
    url: '/year/1914?lng=18&lat=46&zoom=2.6',
    touch: true,
  },
];
// What each shot shows: the release notes, then tour cards 1 and 5.
const STATES = [
  { id: 'notes', cards: 0 },
  { id: 'tour-share', cards: 1 },
  { id: 'tour-symbols', cards: 5 },
];

const browser = await chromium.launch({ channel: 'chromium' });
for (const size of SIZES) {
  for (const state of STATES) {
    const name = `welcome-${state.id}-${size.id}`;
    if (only && !only.test(name)) continue;
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
      hasTouch: Boolean(size.touch),
      isMobile: size.width < 700,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${base}${size.url}`);
    await page.waitForSelector(
      '[data-testid="map-container"][data-data-state="ready"]',
      { timeout: 60_000 },
    );
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const map = window.__atlasMap;
          if (!map) return resolve(undefined);
          map.once('idle', () => setTimeout(resolve, 600));
          map.triggerRepaint();
        }),
    );
    const welcome = page.getByRole('dialog', {
      name: /Historic Borders is back/,
    });
    await welcome.waitFor();
    if (state.cards) {
      await page.getByRole('button', { name: 'Take a quick tour' }).click();
      for (let i = 1; i < state.cards; i += 1)
        await page.getByRole('button', { name: 'Next', exact: true }).click();
      // The heading takes focus when the page changes; screenshots show the
      // card at rest, as a mouse visitor sees it.
      await page.evaluate(() => document.activeElement?.blur());
    }
    await page.waitForTimeout(500);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${name}: ${path.relative(process.cwd(), file)}`);
    await context.close();
  }
}
await browser.close();
