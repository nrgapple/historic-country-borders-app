import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';
import { welcomeKey } from '../src/lib/welcome';

/**
 * The timeline on touch screens (iPhone and iPad Safari): a drag anywhere on
 * the ruler previews years under the finger and loads the map once, on
 * release; a tap on an era band, the track or a printed year jumps there.
 *
 * Chromium drives real touch input through CDP (Input.dispatchTouchEvent),
 * so touch-action and the browser's own gesture handling take part. WebKit
 * here is desktop WebKit with touch emulation: Playwright can only tap with
 * it, so its drags are dispatched pointer events. Firefox has no mobile
 * emulation. Year data is a one-territory fixture; third parties are blocked.
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

/** Year tokens of the polygon files requested, in order. */
let yearRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  yearRequests = [];
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, new Date(0).toISOString());
    } catch {
      // Storage blocked: the welcome then never opens by itself.
    }
  }, welcomeKey());
  // The year's own files are a one-territory fixture (full-world files are
  // slow to draw in CI); the per-year context is the build's own.
  await page.route('**/data/historical/*.json', (route) => {
    const url = route.request().url();
    const token = new URL(url).pathname.split('/').pop()!.split('.')[0];
    const year = token.startsWith('bc')
      ? -Number(token.slice(2))
      : Number(token);
    if (url.includes('.polygons.')) {
      yearRequests.push(token);
      return route.fulfill({
        json: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', id: 0, properties: { c: 1 }, geometry: square },
          ],
        },
      });
    }
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
          year,
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

const THEMES = ['classic', 'textbook'] as const;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
];

const slider = (page: Page) => page.getByRole('slider', { name: 'Map year' });
const heading = (page: Page) => page.locator('[data-year-heading]');

const open = async (page: Page, theme: (typeof THEMES)[number]) => {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('historic-borders-theme', value);
    } catch {
      // Storage blocked: Classic stays.
    }
  }, theme);
  await page.goto('/year/1914');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(slider(page)).toHaveAttribute('aria-valuetext', '1914 AD');
  // Hydrated: the ruler has been measured and printed years chosen.
  await expect(page.locator('.timeline__label').first()).toBeVisible();
};

/** The published years in order, from the native year select. */
const yearList = (page: Page) =>
  page
    .getByRole('combobox', { name: 'Choose a year' })
    .locator('option')
    .evaluateAll((options) =>
      options.map((option) => Number((option as HTMLOptionElement).value)),
    );

/** The year the ruler maps a viewport x to (one equal slot per year). */
const yearAt = async (page: Page, x: number) => {
  const years = await yearList(page);
  const track = (await slider(page).boundingBox())!;
  const index = Math.floor(((x - track.x) / track.width) * years.length);
  return years[Math.min(years.length - 1, Math.max(0, index))];
};

const centre = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const urlYear = (page: Page) =>
  Number(new URL(page.url()).pathname.split('/').pop());

const touch = (
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x = 0,
  y = 0,
) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });

/** Dispatched pointer events where real touch moves are unavailable. */
const pointer = (
  target: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
) =>
  target.dispatchEvent(type, {
    pointerId: 11,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });

test.use({ hasTouch: true, isMobile: true });

for (const theme of THEMES) {
  test.describe(`${theme} map style`, () => {
    test.skip(
      ({ browserName }) => browserName === 'firefox',
      'Firefox has no mobile touch emulation in Playwright.',
    );

    test('a touch drag previews years and loads the map once, on release', async ({
      page,
      browserName,
      context,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, theme);
      // Start on the era band moving down first, as a thumb often does,
      // then sweep left. With touch-action: pan-y Chromium hands this
      // gesture to scrolling and cancels it; it must stay with the timeline.
      const eras = (await page.locator('.timeline__eras').boundingBox())!;
      const start = { x: eras.x + eras.width * 0.85, y: eras.y + 8 };
      const end = { x: eras.x + eras.width * 0.25, y: eras.y + 34 };
      const path = [
        { x: start.x, y: start.y + 6 },
        { x: start.x - 2, y: start.y + 12 },
        { x: start.x - 6, y: start.y + 16 },
        ...Array.from({ length: 10 }, (_, i) => ({
          x: start.x - 6 + ((end.x - start.x + 6) * (i + 1)) / 10,
          y: start.y + 16 + ((end.y - start.y - 16) * (i + 1)) / 10,
        })),
      ];
      const target = await yearAt(page, end.x);
      const historyBefore = await page.evaluate(() => history.length);
      const requestsBefore = yearRequests.length;

      const cdp =
        browserName === 'chromium' ? await context.newCDPSession(page) : null;
      const ruler = page.locator('.timeline__ruler');
      if (cdp) await touch(cdp, 'touchStart', start.x, start.y);
      else await pointer(slider(page), 'pointerdown', start.x, start.y);
      for (const [i, { x, y }] of path.entries()) {
        if (cdp) await touch(cdp, 'touchMove', x, y);
        else await pointer(ruler, 'pointermove', x, y);
        if (i === 8) {
          // Mid-drag: the big year follows the finger, the map does not.
          await expect(page.locator('.timeline')).toHaveAttribute(
            'data-dragging',
            'true',
          );
          await expect(heading(page)).not.toHaveText('1914');
          await expect(slider(page)).toHaveAttribute(
            'aria-valuetext',
            '1914 AD',
          );
          await page.screenshot({
            path: test.info().outputPath(`mid-drag-${theme}.png`),
          });
        }
      }
      expect(yearRequests.length).toBe(requestsBefore);
      expect(urlYear(page)).toBe(1914);

      if (cdp) await touch(cdp, 'touchEnd');
      else await pointer(ruler, 'pointerup', end.x, end.y);

      await expect(page).toHaveURL(new RegExp(`/year/${target}$`));
      await expect(slider(page)).not.toHaveAttribute(
        'aria-valuetext',
        '1914 AD',
      );
      await expect(page.locator('.timeline')).not.toHaveAttribute(
        'data-dragging',
      );
      // One history entry for the whole drag, and the first year loaded
      // after it is the year released on (neighbours are prefetched later).
      expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
      await expect
        .poll(() => yearRequests[requestsBefore])
        .toBe(target < 0 ? `bc${-target}` : String(target));
      await expect(page.getByText('Map data could not be loaded.')).toHaveCount(
        0,
      );
    });

    test('a drag the browser cancels keeps the year it reached', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, theme);
      const track = (await slider(page).boundingBox())!;
      const y = track.y + track.height / 2;
      const ruler = page.locator('.timeline__ruler');
      const endX = track.x + track.width * 0.4;
      const target = await yearAt(page, endX);
      await pointer(
        slider(page),
        'pointerdown',
        track.x + track.width * 0.9,
        y,
      );
      await pointer(ruler, 'pointermove', endX, y);
      await pointer(ruler, 'pointercancel', endX, y);
      await expect(page).toHaveURL(new RegExp(`/year/${target}$`));
    });

    for (const viewport of VIEWPORTS) {
      test(`taps jump to an era, a track slot or a printed year at ${viewport.width}×${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await open(page, theme);

        // The whole ruler is one hit area, at least 44 px tall, and nothing
        // covers it.
        const ruler = page.locator('.timeline__ruler');
        const rulerBox = (await ruler.boundingBox())!;
        expect(rulerBox.height).toBeGreaterThanOrEqual(44);
        for (const fy of [0.05, 0.3, 0.5, 0.75, 0.95])
          for (const fx of [0.02, 0.5, 0.98]) {
            const covered = await page.evaluate(
              ([x, y]) =>
                !document.elementFromPoint(x, y)?.closest('.timeline__ruler'),
              [
                rulerBox.x + rulerBox.width * fx,
                rulerBox.y + rulerBox.height * fy,
              ],
            );
            expect(covered, `ruler covered at ${fx}, ${fy}`).toBe(false);
          }

        // An era band (its middle).
        const medieval = await centre(
          page.locator('.timeline__era[data-era="medieval"]'),
        );
        const eraYear = await yearAt(page, medieval.x);
        await page.touchscreen.tap(medieval.x, medieval.y);
        await expect(page).toHaveURL(new RegExp(`/year/${eraYear}$`));

        // The ladder track.
        const track = (await slider(page).boundingBox())!;
        const trackPoint = {
          x: track.x + track.width * 0.15,
          y: track.y + track.height / 2,
        };
        const trackYear = await yearAt(page, trackPoint.x);
        await page.touchscreen.tap(trackPoint.x, trackPoint.y);
        await expect(page).toHaveURL(new RegExp(`/year/${trackYear}$`));

        // A printed year: the last one, which is never the current year here.
        const label = page.locator('.timeline__label[data-edge="end"]');
        const labelText = (await label.textContent())!;
        const labelPoint = await centre(label);
        await page.touchscreen.tap(labelPoint.x, labelPoint.y);
        await expect(slider(page)).toHaveAttribute(
          'aria-valuetext',
          new RegExp(`^${labelText}`),
        );
      });
    }
  });
}
