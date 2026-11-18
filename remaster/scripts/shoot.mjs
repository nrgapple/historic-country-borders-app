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
const out = path.resolve(
  process.argv[3] || path.join(APP, '../docs/product/remaster-shots'),
);
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(out, { recursive: true });

const OTTOMAN = 'place=Ottoman%20Empire';
const STATE_COLLEGE = 'place=State%20College%20Area';
const WIKI = {
  'Ottoman Empire':
    'The Ottoman Empire controlled much of Southeast Europe, West Asia and North Africa from the 14th to the early 20th century. It was founded at the end of the 13th century in northwestern Anatolia by the Turkoman tribal leader Osman I. After 1354 the Ottomans crossed into Europe, and with the conquest of the Balkans the beylik became a transcontinental empire.',
  'State College Area School District':
    'The State College Area School District is a public school district in Centre County, Pennsylvania. It serves the borough of State College and the surrounding townships of College, Ferguson, Halfmoon, Harris and Patton. (Design-review fixture text, not fetched from Wikipedia.)',
  'Pittsburgh Public Schools':
    'Pittsburgh Public Schools is the public school district serving the city of Pittsburgh, Pennsylvania. (Design-review fixture text, not fetched from Wikipedia.)',
  'Carlisle Area School District':
    'The Carlisle Area School District is a public school district in Cumberland County, Pennsylvania. (Design-review fixture text, not fetched from Wikipedia.)',
  'Camp Hill School District':
    'The Camp Hill School District is a small public school district in Cumberland County, Pennsylvania, serving the borough of Camp Hill. (Design-review fixture text, not fetched from Wikipedia.)',
};
const SHOTS = [
  // The mock's desktop camera: Europe to the Caspian, the panel on the right.
  {
    name: '1492-ottoman-1440x900',
    url: `/year/1492?lng=29.5&lat=44.5&zoom=2.95&${OTTOMAN}`,
    width: 1440,
    height: 900,
  },
  {
    name: '1492-ottoman-1024x768',
    url: `/year/1492?lng=32&lat=43&zoom=2.9&${OTTOMAN}`,
    width: 1024,
    height: 768,
    touch: true,
  },
  // Phones frame the selection above the bottom sheet (no camera in the link).
  {
    name: '1492-ottoman-390x844',
    url: `/year/1492?${OTTOMAN}`,
    width: 390,
    height: 844,
    touch: true,
  },
  // T7 map key, open and closed, at the three review widths (1914, no selection).
  ...[
    [1440, 900, '/year/1914?lng=15&lat=47&zoom=3.2'],
    [1024, 768, '/year/1914?lng=15&lat=47&zoom=2.9'],
    [390, 844, '/year/1914?lng=18&lat=46&zoom=2.6'],
  ].flatMap(([width, height, url]) =>
    ['open', 'closed'].map((key) => ({
      name: `1914-${width}x${height}-key-${key}`,
      url,
      width,
      height,
      touch: width < 1100,
      key,
    })),
  ),
  // Label priority (T7): state names over cities, viewport anchors for
  // territories whose label point is off screen or under the key.
  {
    name: '1914-europe-z2.6-1440x900',
    url: '/year/1914?lng=15&lat=47&zoom=2.6',
    width: 1440,
    height: 900,
  },
  {
    name: '1815-europe-1440x900',
    url: '/year/1815?lng=12&lat=49&zoom=3.4',
    width: 1440,
    height: 900,
  },
  {
    name: '1492-world-1440x900',
    url: '/year/1492',
    width: 1440,
    height: 900,
  },
  // iPhone 15 Pro with simulated insets (Chromium CDP), like the design's phone-safe shot.
  {
    name: '1492-ottoman-iphone-insets-393x852',
    url: `/year/1492?${OTTOMAN}`,
    width: 393,
    height: 852,
    touch: true,
    insets: { top: 59, bottom: 34 },
  },
  // Pennsylvania (P5): a district selected, framed by the app (no camera in
  // the link), at the three review sizes; the phone with iPhone insets.
  {
    name: 'pa-state-college-1440x900',
    url: `/pa/school-districts?${STATE_COLLEGE}`,
    width: 1440,
    height: 900,
    wiki: 'State College Area School District',
  },
  {
    name: 'pa-state-college-1024x768',
    url: `/pa/school-districts?${STATE_COLLEGE}`,
    width: 1024,
    height: 768,
    touch: true,
    wiki: 'State College Area School District',
  },
  {
    name: 'pa-state-college-insets-390x844',
    url: `/pa/school-districts?${STATE_COLLEGE}`,
    width: 390,
    height: 844,
    touch: true,
    insets: { top: 47, bottom: 34 },
    wiki: 'State College Area School District',
  },
  // Street level (T8's z14 streets on z12 tiles), a district selected.
  {
    name: 'pa-camp-hill-streets-1440x900',
    url: '/pa/school-districts?lng=-76.9050&lat=40.2420&zoom=14.60&place=Camp%20Hill',
    width: 1440,
    height: 900,
    wiki: 'Camp Hill School District',
  },
  // The whole state, nothing selected.
  {
    name: 'pa-state-1440x900',
    url: '/pa/school-districts',
    width: 1440,
    height: 900,
  },
  // "Colour districts by" (src/pa/colourBy.ts), with the key open: the whole
  // state on desktop and phone, then a multi-school district selected.
  ...['football', 'piaa', 'enrollment'].flatMap((colour) =>
    [
      [1440, 900],
      [390, 844],
    ].map(([width, height]) => ({
      name: `pa-colour-${colour}-${width}x${height}`,
      url: `/pa/school-districts?colour=${colour}`,
      width,
      height,
      touch: width < 1100,
      key: 'open',
    })),
  ),
  {
    name: 'pa-colour-football-pittsburgh-1440x900',
    url: '/pa/school-districts?colour=football&place=Pittsburgh',
    width: 1440,
    height: 900,
    key: 'open',
    wiki: 'Pittsburgh Public Schools',
  },
  {
    name: 'pa-colour-football-carlisle-390x844',
    url: '/pa/school-districts?colour=football&place=Carlisle%20Area',
    width: 390,
    height: 844,
    touch: true,
    wiki: 'Carlisle Area School District',
  },
];

const browser = await chromium.launch({ channel: 'chromium' });
for (const shot of SHOTS) {
  if (only && !only.test(shot.name)) continue;
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    hasTouch: Boolean(shot.touch),
    isMobile: shot.width < 700,
  });
  // These shots review the map; the first-visit welcome has its own
  // (scripts/shoot-welcome.mjs), so mark it as already seen.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('historic-borders-welcome:2026-remaster', 'shot');
    } catch {}
  });
  const page = await context.newPage();
  // Wikipedia is the only third-party request (on selection); keep shots
  // deterministic and offline with a fixed summary.
  const title = shot.wiki ?? 'Ottoman Empire';
  await page.route('https://en.wikipedia.org/**', (route) =>
    route.fulfill({
      json: {
        query: {
          pages: {
            1: {
              title,
              extract: WIKI[title],
              fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
            },
          },
        },
      },
    }),
  );
  if (shot.insets) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: {
        top: shot.insets.top,
        bottom: shot.insets.bottom,
        left: 0,
        right: 0,
      },
    });
  }
  await page.goto(`${base}${shot.url}`);
  await page.waitForSelector('main[data-data-state="ready"]', {
    timeout: 60_000,
  });
  await page
    .waitForSelector('.map-canvas[data-loaded]', { timeout: 60_000 })
    .catch(() => undefined);
  // Let labels place, relief load and the camera settle.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = window.__atlasMap;
        if (!map) return resolve(undefined);
        const done = () => setTimeout(resolve, 600);
        map.once('idle', done);
        map.triggerRepaint();
      }),
  );
  await page.waitForTimeout(800);
  if (shot.key) {
    // The key starts open on wide screens and closed on phones.
    const toggle = page.getByRole('button', { name: 'Key', exact: true });
    const open = (await toggle.getAttribute('aria-expanded')) === 'true';
    if (open !== (shot.key === 'open')) {
      await toggle.click();
      // Labels re-check the area the key now covers once the map is idle.
      await page.waitForTimeout(1200);
    }
  }
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
