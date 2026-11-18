// Screenshots of the Classic-atlas style on the review page (/review/<year>).
// Usage: node scripts/style-review.mjs [baseUrl] [outDir] [--only=name,name]
// Expects `yarn build` output served by `node scripts/serve.mjs dist 4400`.
import path from 'node:path';
import { chromium } from '@playwright/test';
import { REPO } from './lib.mjs';

const base =
  process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : 'http://127.0.0.1:4400';
const out =
  process.argv[3] && !process.argv[3].startsWith('--')
    ? process.argv[3]
    : path.join(REPO, 'docs/product/style-review');
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const PHONE = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const q = (o) => new URLSearchParams(o).toString();
export const SHOTS = [
  // Same framing as the design mocks (a-classic-atlas-desktop/phone.png).
  {
    name: '1492-desktop',
    year: 1492,
    viewport: DESKTOP,
    query: {
      place: 'Ottoman Empire',
      fit: '-33,28,54,58',
      pad: '24,450,40,24',
    },
  },
  {
    name: '1492-phone',
    year: 1492,
    viewport: PHONE,
    query: { place: 'Ottoman Empire', fit: '20,35,44,45', pad: '70,12,12,12' },
  },
  // 1914: British, French, Italian, German, Belgian and Portuguese dependencies tinted from their rulers.
  {
    name: '1914-desktop',
    year: 1914,
    viewport: DESKTOP,
    query: { fit: '-22,-36,58,62', pad: '24,24,24,24' },
  },
  {
    name: '1914-phone',
    year: 1914,
    viewport: PHONE,
    query: { fit: '-18,-35,52,37', pad: '24,12,12,12' },
  },
  // Selecting an overlord lightly emphasises its dependencies.
  {
    name: '1914-desktop-uk-selected',
    year: 1914,
    viewport: DESKTOP,
    query: {
      place: 'United Kingdom of Great Britain and Ireland',
      fit: '-22,-36,58,62',
      pad: '24,24,24,24',
    },
  },
  {
    name: '1914-desktop-france-selected',
    year: 1914,
    viewport: DESKTOP,
    query: { place: 'France', fit: '-22,-36,58,62', pad: '24,24,24,24' },
  },
  // Capital zoom review: the same Europe view at three zooms.
  ...[3.5, 4, 4.5].map((zoom) => ({
    name: `capitals-1914-z${zoom}`,
    year: 1914,
    viewport: DESKTOP,
    query: { lng: '15', lat: '48', zoom: String(zoom) },
  })),
  // Plan §9.2 P3 acceptance: at z5 over the Aegean, coast strokes without waterline rings.
  {
    name: 'aegean-phone-z5',
    year: 1492,
    viewport: PHONE,
    query: { lng: '25.5', lat: '38.2', zoom: '5' },
  },
  {
    name: 'aegean-phone-z4',
    year: 1492,
    viewport: PHONE,
    query: { lng: '25.5', lat: '38.2', zoom: '4.2' },
  },
  // Settings and modes.
  {
    name: '1492-desktop-lowpower',
    year: 1492,
    viewport: DESKTOP,
    query: {
      place: 'Ottoman Empire',
      fit: '-33,28,54,58',
      pad: '24,450,40,24',
      lowPower: '1',
    },
  },
  {
    name: '1492-desktop-projector',
    year: 1492,
    viewport: DESKTOP,
    query: {
      place: 'Ottoman Empire',
      fit: '-33,28,54,58',
      pad: '24,450,40,24',
      projector: '1',
      text: 'large',
    },
  },
  {
    name: '1914-desktop-settings',
    year: 1914,
    viewport: DESKTOP,
    query: {
      fit: '-22,-36,58,62',
      pad: '24,24,24,24',
      case: 'upper',
      opacity: '0.4',
      border: '4',
    },
  },
];

// Full Chromium (new headless) on the host GPU; the headless shell's SwiftShader hangs on this host.
const browser = await chromium.launch({ channel: 'chromium' });
for (const shot of SHOTS) {
  if (only && !only.includes(shot.name)) continue;
  const ctx = await browser.newContext({
    viewport: { width: shot.viewport.width, height: shot.viewport.height },
    ...shot.viewport,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(
    `${base}/review/${shot.year}?${q({ lowPower: '0', ...shot.query })}`,
  );
  await page.waitForFunction(() => !!window.__review, null, { timeout: 30000 });
  // Wait for borders, relief and glyphs: two consecutive idle events with relief present.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = window.__review.handle.map;
        const check = () =>
          map.getLayer('relief') && map.loaded()
            ? resolve()
            : map.once('idle', check);
        map.once('idle', check);
        setTimeout(resolve, 25000);
      }),
  );
  await page.waitForTimeout(600);
  const file = path.join(out, `${shot.name}.png`);
  await page.screenshot({ path: file });
  const zoom = await page.evaluate(() =>
    window.__review.handle.map.getZoom().toFixed(2),
  );
  console.log(
    `${shot.name}: z${zoom} -> ${path.relative(REPO, file)}${errors.length ? ` errors: ${errors.join('; ')}` : ''}`,
  );
  await ctx.close();
}
await browser.close();
