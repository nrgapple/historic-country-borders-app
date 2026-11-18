import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Pennsylvania school-district journeys (P5), ported from the current app's
 * e2e/critical-journeys.spec.ts. The district index is intercepted with a
 * one-district fixture where a journey needs determinism; the basemap,
 * district tiles, glyphs and fonts come from the build itself (first-party),
 * and every third-party request is blocked.
 */

const fixtureIndex = {
  schemaVersion: 2,
  source: {
    title: 'Fixture districts',
    publisher: 'Fixture publisher',
    vintage: '2025-10',
    sourceUrl: 'https://example.com/source',
    metadataUrl: 'https://example.com/metadata',
    accessConstraints: 'None',
    license: 'Fixture terms',
    disclaimer: 'Fixture disclaimer.',
    retrievedAt: '2026-09-02T00:00:00Z',
    sha256: 'fixture',
  },
  validation: {
    districtCount: 1,
    geometryCounts: { Polygon: 1, MultiPolygon: 0 },
    requiredProperties: ['SCHOOL_NAM'],
  },
  districts: [
    {
      id: 0,
      NAME: 'Fixture School District',
      SCHOOL_NAM: 'Fixture School District',
      SCHOOL_DIS: 'Fixture SD',
      CTY_NAME: 'CENTRE',
      IU_NAME: 'CENTRAL IU 10',
      IU_NUM: '10',
      AUN_NUM: '100000000',
      AVTS: 'NULL',
      km2: 100,
      bbox: [-77.7, 40.9, -77.5, 41.1],
      label: [-77.6, 41],
    },
  ],
};

const INDEX = '**/data/pa/districts.*.json';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const mapOf = (page: Page) =>
  page.getByTestId('pa-school-districts-map-container');

const expectReadyMap = async (map: Locator, count = '1') => {
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-data-state', 'ready', {
    timeout: 30_000,
  });
  await expect(map).toHaveAttribute('data-feature-count', count);

  const hasWebGL2 = await map
    .page()
    .evaluate(() =>
      Boolean(document.createElement('canvas').getContext('webgl2')),
    );
  if (!hasWebGL2) {
    await expect(
      map
        .getByRole('alert')
        .filter({ hasText: 'can’t draw the interactive map' }),
    ).toBeVisible();
    test.skip(true, 'No WebGL 2 here; the fallback message was verified.');
  }

  await expect(map.locator('.maplibregl-canvas')).toBeVisible();
  await expect(map.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 30_000,
  });
};

test('Pennsylvania school districts load usable district data for cold and returning users', async ({
  page,
}) => {
  await page.route(INDEX, (route) => route.fulfill({ json: fixtureIndex }));
  await page.goto('/pa/school-districts');

  await expectReadyMap(mapOf(page));
  await expect(
    page.getByRole('button', { name: 'Map settings' }),
  ).toBeVisible();
  await expect(page.getByText(/Boundaries October 2025/)).toBeVisible();
  await page.reload();
  await expectReadyMap(mapOf(page));
});

test('Pennsylvania shows a visible loading message and keeps its title on phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(INDEX, async (route) => {
    await released;
    await route.fulfill({ json: fixtureIndex });
  });

  await page.goto('/pa/school-districts');
  await expect(page.getByTestId('map-loading')).toHaveText(
    'Loading 500 district boundaries…',
  );
  await expect(page.getByText('PA school districts')).toBeVisible();

  release();
  await expectReadyMap(mapOf(page));
  await expect(page.getByTestId('map-loading')).toBeHidden();
  await expect(page.getByText('Boundaries Oct 2025')).toBeVisible();
});

test('a parent finds a district by keyboard and shares it, with its source and caveats', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');
  await expectReadyMap(mapOf(page), '500');

  const finder = page.getByRole('combobox', { name: /find a district/i });
  if (!(await finder.isVisible()))
    await page.getByRole('button', { name: /find a district/i }).click();
  await finder.fill('pen argyl');
  await expect(
    page.getByRole('option', { name: /Pen Argyl Area School District/ }),
  ).toBeVisible();
  await finder.press('Enter');

  const panel = page.getByRole('complementary');
  await expect(
    panel.getByRole('heading', { name: 'Pen Argyl Area School District' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]place=Pen\+Argyl\+Area/);
  for (const [label, value] of [
    ['County', 'Northampton'],
    ['Intermediate unit', 'Colonial IU 20'],
    ['Career & technical school', 'Career Institute of Technology'],
  ])
    await expect(
      panel.locator('.place-panel__fact', { hasText: label }),
    ).toContainText(value);
  await expect(panel).toContainText('October 2025');
  await expect(
    panel.getByRole('link', { name: 'PASDA' }).first(),
  ).toHaveAttribute('href', /pasda\.psu\.edu/);
  await expect(panel).toContainText(/contact the school district/);
  await expect(panel).toContainText(/contact PennDOT/);

  // The shared link opens the same district for the next visitor.
  const shared = page.url();
  await page.goto(shared);
  await expect(
    page
      .getByRole('complementary')
      .getByRole('heading', { name: 'Pen Argyl Area School District' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toBeHidden();
  await expect(page).not.toHaveURL(/place=/);
});

test('a county in the finder frames its districts without opening a panel', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');
  await expectReadyMap(mapOf(page), '500');
  const finder = page.getByRole('combobox', { name: /find a district/i });
  if (!(await finder.isVisible()))
    await page.getByRole('button', { name: /find a district/i }).click();
  await finder.fill('Northampton County');
  await page.getByRole('option', { name: /^Northampton County/ }).click();
  await expect
    .poll(() => page.evaluate(() => window.location.search), {
      timeout: 15_000,
    })
    .toMatch(/zoom=(9|1\d)/);
  await expect(page.getByRole('complementary')).toBeHidden();
});

test('the street basemap credits OpenStreetMap (ODbL) and every map file is first-party', async ({
  page,
}) => {
  const offOrigin: string[] = [];
  const failures: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') offOrigin.push(url.href);
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/pa/school-districts?lng=-76.9200&lat=40.2400&zoom=14.00');
  await expectReadyMap(mapOf(page), '500');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(
    'OpenStreetMap',
  );
  await expect(page.locator('.credit')).toContainText('ODbL');
  expect(offOrigin).toEqual([]);
  // Tiles outside the published coverage are never requested.
  expect(failures).toEqual([]);
});

test('no page requests mapbox.com', async ({ page }) => {
  const mapbox: string[] = [];
  page.on('request', (request) => {
    if (/mapbox\.com/.test(new URL(request.url()).hostname))
      mapbox.push(request.url());
  });
  for (const path of [
    '/pa/school-districts',
    '/year/1492',
    '/',
    '/year/9999',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
  }
  expect(mapbox).toEqual([]);
});

test('without WebGL 2 the page explains itself and lists every district', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl2') return null;
      return (original as (...a: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
  await page.goto('/pa/school-districts');
  await expect(
    mapOf(page)
      .getByRole('alert')
      .filter({ hasText: 'can’t draw the interactive map' }),
  ).toBeVisible();
  const list = page.getByRole('heading', {
    name: /500 school districts, by county/,
  });
  await expect(list).toBeAttached();
  await page.getByRole('link', { name: /list of all 500 districts/ }).click();
  await expect(list).toBeInViewport();
  await expect(page.getByText('Pen Argyl Area School District')).toBeVisible();
});
