import { expect, test, type Page } from '@playwright/test';
import { welcomeKey } from '../src/lib/welcome';

/**
 * The border-change animation (src/atlas/transition/): when the year
 * changes, an overlay draws the borders flowing from the old year to the new
 * one, then hands over to the new year's vector layers.
 *
 * Year data is intercepted with two small fixtures, so the change is real but
 * cheap to draw in software WebGL: in 1914 "Alpha" holds a 2°×1° strip; in
 * every other year Alpha keeps the western half and a new "Beta" takes the
 * eastern half. The other journeys run with reduced motion (playwright.config).
 */
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

const yearOf = (url: string) => {
  const token = new URL(url).pathname.split('/').pop()!.split('.')[0];
  return token.startsWith('bc') ? -Number(token.slice(2)) : Number(token);
};

const box = (x0: number, x1: number) => ({
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [x0, 0],
        [x1, 0],
        [x1, 1],
        [x0, 1],
        [x0, 0],
      ],
    ],
  ],
});

const territories = (year: number) =>
  year === 1914
    ? [{ name: 'Alpha', c: 1, geometry: box(0, 2) }]
    : [
        { name: 'Alpha', c: 1, geometry: box(0, 1) },
        { name: 'Beta', c: 4, geometry: box(1, 2) },
      ];

const fixtures = {
  polygons: (year: number) => ({
    type: 'FeatureCollection',
    features: territories(year).map((t, id) => ({
      type: 'Feature',
      id,
      properties: { c: t.c },
      geometry: t.geometry,
    })),
  }),
  labels: (year: number) => ({
    type: 'FeatureCollection',
    features: territories(year).map((t, id) => ({
      type: 'Feature',
      id,
      properties: { n: t.name, a: 12_000 },
      geometry: { type: 'Point', coordinates: [id + 0.5, 0.5] },
    })),
  }),
  index: (year: number) => ({
    schemaVersion: 1,
    year,
    territories: territories(year).map((t, id) => ({
      id,
      NAME: t.name,
      BORDERPRECISION: 1,
      bbox: [id, 0, id + 1, 1],
      label: [id + 0.5, 0.5],
    })),
  }),
};

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, context }) => {
  const seen: string[] = [];
  errors.set(page, seen);
  page.on('console', (message) => {
    if (message.type() === 'error') seen.push(message.text());
  });
  page.on('pageerror', (error) => seen.push(error.message));
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, new Date(0).toISOString());
    } catch {
      // Storage blocked: the welcome then never opens by itself.
    }
    // Remember whether the overlay ever appeared (it can be brief).
    const watch = () => {
      const canvas = document.querySelector('.map-canvas');
      if (!canvas) return void requestAnimationFrame(watch);
      const mark = () => {
        if ((canvas as HTMLElement).dataset.borderTransition)
          (window as unknown as { __overlaySeen: number }).__overlaySeen =
            ((window as unknown as { __overlaySeen?: number }).__overlaySeen ??
              0) + 1;
      };
      new MutationObserver(mark).observe(canvas, {
        attributes: true,
        attributeFilter: ['data-border-transition'],
      });
    };
    document.addEventListener('DOMContentLoaded', watch);
  }, welcomeKey());
  // Context routes also see the geometry worker's requests.
  await context.route('**/data/historical/*.json', (route) => {
    const url = route.request().url();
    const year = yearOf(url);
    if (url.includes('.polygons.'))
      return route.fulfill({ json: fixtures.polygons(year) });
    if (url.includes('.labels.'))
      return route.fulfill({ json: fixtures.labels(year) });
    if (url.includes('.index.'))
      return route.fulfill({ json: fixtures.index(year) });
    return route.fulfill({
      json: { type: 'FeatureCollection', features: [] },
    });
  });
  await context.route('**/data/context/*.json', (route) => {
    const url = route.request().url();
    if (url.includes('.capitals.'))
      return route.fulfill({
        json: { type: 'FeatureCollection', features: [] },
      });
    const year = yearOf(url);
    return route.fulfill({
      json: {
        schemaVersion: 1,
        year,
        source: {
          name: 'Wikidata',
          license: 'CC0-1.0',
          retrievedAt: '2026-11-17T00:00:00.000Z',
        },
        places: {},
        changes: {
          previousYear: year - 1,
          appeared: [],
          disappeared: [],
          changed: [],
        },
      },
    });
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const mapOf = (page: Page) => page.getByTestId('map-container');

/** Opens 1914 and waits for its borders; skips without WebGL 2. */
async function openReady(page: Page) {
  await page.goto('/year/1914?lng=1.0000&lat=0.5000&zoom=7.00');
  const map = mapOf(page);
  await expect(map).toHaveAttribute('data-data-state', 'ready', {
    timeout: 30_000,
  });
  const hasWebGL2 = await page.evaluate(() =>
    Boolean(document.createElement('canvas').getContext('webgl2')),
  );
  test.skip(!hasWebGL2, 'No WebGL 2 here: there is no map to animate.');
  await expect(map.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(map).toHaveAttribute('data-feature-count', '1');
}

/** The year's territories as the vector map draws them (test hook). */
const drawnTerritories = (page: Page) =>
  page.evaluate(() => {
    const map = (
      window as unknown as {
        __atlasMap?: {
          querySourceFeatures(source: string): Array<{ id?: unknown }>;
          getLayer(id: string): unknown;
        };
      }
    ).__atlasMap;
    if (!map) return null;
    return {
      ids: [
        ...new Set(map.querySourceFeatures('borders').map((f) => f.id)),
      ].sort(),
      overlay: Boolean(map.getLayer('border-transition')),
    };
  });

const overlaySeen = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __overlaySeen?: number }).__overlaySeen ?? 0,
  );

/** Waits for the new year to be fully on screen. */
async function expectYearShown(page: Page, label: string, features: string) {
  const map = mapOf(page);
  await expect(page.getByRole('slider', { name: 'Map year' })).toHaveAttribute(
    'aria-valuetext',
    label,
  );
  // Software WebGL in CI is slow: poll generously for the hand-over.
  await expect(map.locator('.map-canvas[data-border-transition]')).toHaveCount(
    0,
    { timeout: 30_000 },
  );
  await expect(map.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(map).toHaveAttribute('data-data-state', 'ready');
  await expect(map).toHaveAttribute('data-feature-count', features);
}

test('changing the year animates the borders, then shows the new year', async ({
  page,
}) => {
  await openReady(page);
  await page.getByRole('button', { name: 'Next year: 1920 AD' }).click();
  await expect
    .poll(() => overlaySeen(page), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expectYearShown(page, '1920 AD', '2');
  await expect
    .poll(() => drawnTerritories(page), { timeout: 30_000 })
    .toEqual({ ids: [0, 1], overlay: false });
  expect(errors.get(page)).toEqual([]);
});

test('a year change mid-animation finishes on the latest year', async ({
  page,
}) => {
  await openReady(page);
  await page.getByRole('button', { name: 'Next year: 1920 AD' }).click();
  await expect
    .poll(() => overlaySeen(page), { timeout: 30_000 })
    .toBeGreaterThan(0);
  // While 1914 → 1920 runs (or prepares), ask for 1930.
  await page.getByRole('button', { name: 'Next year: 1930 AD' }).click();
  await expectYearShown(page, '1930 AD', '2');
  await expect
    .poll(() => drawnTerritories(page), { timeout: 30_000 })
    .toEqual({ ids: [0, 1], overlay: false });
  expect(errors.get(page)).toEqual([]);
});

test('panning during the animation snaps to the new year', async ({ page }) => {
  await openReady(page);
  await page.getByRole('button', { name: 'Next year: 1920 AD' }).click();
  await expect(mapOf(page).locator('.map-canvas[data-border-transition]'))
    .toBeAttached({ timeout: 30_000 })
    .catch(() => undefined);
  const box = await mapOf(page).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2);
  await page.mouse.up();
  await expectYearShown(page, '1920 AD', '2');
  expect(errors.get(page)).toEqual([]);
});

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the year changes at once, without the overlay', async ({ page }) => {
    await openReady(page);
    await page.getByRole('button', { name: 'Next year: 1920 AD' }).click();
    await expectYearShown(page, '1920 AD', '2');
    expect(await overlaySeen(page)).toBe(0);
    expect(errors.get(page)).toEqual([]);
  });
});

test('Settings → Animate border changes turns it off and is remembered', async ({
  page,
}) => {
  await openReady(page);
  await page.getByRole('button', { name: 'Map settings' }).click();
  const toggle = page.getByRole('switch', { name: 'Animate border changes' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Next year: 1920 AD' }).click();
  await expectYearShown(page, '1920 AD', '2');
  expect(await overlaySeen(page)).toBe(0);

  await page.reload();
  await expect(mapOf(page).locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Map settings' }).click();
  await expect(
    page.getByRole('switch', { name: 'Animate border changes' }),
  ).not.toBeChecked();
  expect(errors.get(page)).toEqual([]);
});
