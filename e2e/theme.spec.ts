import { expect, test, type Page } from '@playwright/test';
import { welcomeKey } from '../src/lib/welcome';

/**
 * Map style (theme) journeys: Settings → "Map style" switches between
 * Classic atlas and Modern textbook. Year pages default to Classic, the
 * Pennsylvania map to Modern textbook, and each page family remembers its
 * own choice (src/atlas/theme.ts). Year data is a one-territory fixture; the
 * PA map uses the build's own first-party data. Third parties are blocked.
 */

const square = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, new Date(0).toISOString());
    } catch {
      // Storage blocked: the welcome then never opens by itself.
    }
    // The theme as it stands before the island's scripts run: set by the
    // server default and the inline boot script, never by React.
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive')
        (
          window as unknown as { __themeBeforeScripts?: string }
        ).__themeBeforeScripts = document.documentElement.dataset.theme;
    });
  }, welcomeKey());
  await page.route('**/data/historical/*.json', (route) => {
    const url = route.request().url();
    if (url.includes('.polygons.'))
      return route.fulfill({
        json: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', id: 0, properties: { c: 1 }, geometry: square },
          ],
        },
      });
    if (url.includes('.labels.'))
      return route.fulfill({
        json: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 0,
              properties: { n: 'Fixture Country', a: 12_000 },
              geometry: { type: 'Point', coordinates: [0.5, 0.5] },
            },
          ],
        },
      });
    if (url.includes('.index.'))
      return route.fulfill({
        json: {
          schemaVersion: 1,
          year: 1914,
          territories: [
            {
              id: 0,
              NAME: 'Fixture Country',
              BORDERPRECISION: 1,
              bbox: [0, 0, 1, 1],
              label: [0.5, 0.5],
            },
          ],
        },
      });
    return route.continue();
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const html = (page: Page) => page.locator('html');
const themeBeforeScripts = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __themeBeforeScripts?: string })
        .__themeBeforeScripts,
  );

const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Map settings' }).click();
  return page.getByRole('radiogroup', { name: 'Map style' });
};

/** The live map's B-only layer visibility, once the map has drawn (null without WebGL 2). */
const textbookLayerVisibility = async (page: Page, layer: string) => {
  const webgl = await page.evaluate(() =>
    Boolean(document.createElement('canvas').getContext('webgl2')),
  );
  if (!webgl) return null;
  await expect(page.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 45_000,
  });
  return page.evaluate((id) => {
    const map = (
      window as unknown as {
        __atlasMap?: { getLayoutProperty(l: string, p: string): unknown };
      }
    ).__atlasMap;
    return map?.getLayoutProperty(id, 'visibility') ?? 'visible';
  }, layer);
};

test('switching the map style on a year page keeps camera and selection, and persists after reload', async ({
  page,
}) => {
  await page.goto(
    '/year/1914?lng=0.5000&lat=0.5000&zoom=5.00&place=Fixture%20Country',
  );
  await expect(html(page)).toHaveAttribute('data-theme', 'classic');
  expect(await themeBeforeScripts(page)).toBe('classic');
  const panel = page.getByRole('complementary', { name: 'Fixture Country' });
  await expect(panel).toBeVisible({ timeout: 30_000 });
  expect(await textbookLayerVisibility(page, 'selected-hatch')).not.toBe(
    'visible',
  );

  const styles = await openSettings(page);
  await expect(
    styles.getByRole('radio', { name: /Classic atlas/ }),
  ).toBeChecked();
  await styles.getByRole('radio', { name: /Modern textbook/ }).check();

  await expect(html(page)).toHaveAttribute('data-theme', 'textbook');
  // B's chrome: white ground and Literata for the year.
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    )
    .toBe('rgb(255, 255, 255)');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          getComputedStyle(document.querySelector('[data-year-heading]')!)
            .fontFamily,
      ),
    )
    .toContain('Literata');
  // The map swapped its style in place: same camera, same selection.
  const hatch = await textbookLayerVisibility(page, 'selected-hatch');
  if (hatch !== null) expect(hatch).toBe('visible');
  await expect(panel).toBeVisible();
  expect(page.url()).toContain('lng=0.5000&lat=0.5000&zoom=5.00');
  expect(page.url()).toContain('place=Fixture');

  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'textbook');
  // Applied before any app script ran: no flash of the Classic style.
  expect(await themeBeforeScripts(page)).toBe('textbook');
  await expect(
    (await openSettings(page)).getByRole('radio', { name: /Modern textbook/ }),
  ).toBeChecked();
});

test('the Pennsylvania map opens in Modern textbook by default', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');
  await expect(html(page)).toHaveAttribute('data-theme', 'textbook');
  expect(await themeBeforeScripts(page)).toBe('textbook');
  const styles = await openSettings(page);
  await expect(
    styles.getByRole('radio', { name: /Modern textbook/ }),
  ).toBeChecked();
  const casing = await textbookLayerVisibility(page, 'district-casing');
  if (casing !== null) expect(casing).toBe('visible');
  // The street basemap is still drawn under B's district washes.
  if (casing !== null)
    expect(
      await page.evaluate(() =>
        (
          window as unknown as {
            __atlasMap: { getLayoutProperty(l: string, p: string): unknown };
          }
        ).__atlasMap.getLayoutProperty('road-major', 'visibility'),
      ),
    ).not.toBe('none');
});

test('switching the style on the Pennsylvania map never changes the year pages', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');
  await (
    await openSettings(page)
  )
    .getByRole('radio', { name: /Classic atlas/ })
    .check();
  await expect(html(page)).toHaveAttribute('data-theme', 'classic');
  const casing = await textbookLayerVisibility(page, 'district-casing');
  if (casing !== null) expect(casing).toBe('none');

  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'classic');

  // The year pages keep their own default...
  await page.goto('/year/1914');
  await expect(html(page)).toHaveAttribute('data-theme', 'classic');
  // ...and choosing Modern textbook there leaves the PA choice alone.
  await (
    await openSettings(page)
  )
    .getByRole('radio', { name: /Modern textbook/ })
    .check();
  await expect(html(page)).toHaveAttribute('data-theme', 'textbook');
  await page.goto('/pa/school-districts');
  await expect(html(page)).toHaveAttribute('data-theme', 'classic');
  expect(
    await page.evaluate(() => ({
      atlas: localStorage.getItem('historic-borders-theme'),
      pa: localStorage.getItem('historic-borders-theme:pa'),
    })),
  ).toEqual({ atlas: 'textbook', pa: 'classic' });
});
