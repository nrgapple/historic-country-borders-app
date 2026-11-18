import { expect, test, type Locator } from '@playwright/test';

const historicalMapResponse = {
  data: {
    labels: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0.5, 0.5] },
          properties: { NAME: 'Fixture Country', AREA: 1 },
        },
      ],
    },
    borders: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
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
          },
          properties: { NAME: 'Fixture Country', COLOR: '#4ECDC4' },
        },
      ],
    },
  },
  places: { type: 'FeatureCollection', features: [] },
};

const schoolDistrictResponse = {
  schemaVersion: 1,
  source: {
    title: 'Fixture districts',
    publisher: 'Fixture publisher',
    vintage: '2025-10',
    sourceUrl: 'https://example.com/source',
    metadataUrl: 'https://example.com/metadata',
    accessConstraints: 'None',
    license: 'Fixture terms',
    disclaimer: 'Fixture disclaimer',
    retrievedAt: '2026-09-02T00:00:00Z',
    sha256: 'fixture',
  },
  validation: {
    districtCount: 1,
    geometryCounts: { Polygon: 1, MultiPolygon: 0 },
    requiredProperties: ['SCHOOL_NAM'],
  },
  data: {
    labels: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-77.6, 41] },
          properties: { NAME: 'Fixture School District' },
        },
      ],
    },
    borders: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-77.7, 40.9],
                [-77.5, 40.9],
                [-77.5, 41.1],
                [-77.7, 41.1],
                [-77.7, 40.9],
              ],
            ],
          },
          properties: {
            NAME: 'Fixture School District',
            SCHOOL_NAM: 'Fixture School District',
            SCHOOL_DIS: 'Fixture SD',
            CTY_NAME: 'Fixture County',
          },
        },
      ],
    },
  },
  places: { type: 'FeatureCollection', features: [] },
};

const emptyMapboxStyle = {
  version: 8,
  name: 'Deterministic test style',
  sources: {},
  layers: [],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/data/historical/*.json', (route) =>
    route.fulfill({ json: historicalMapResponse }),
  );
  await page.route('**/data/pa-school-districts.json', (route) =>
    route.fulfill({ json: schoolDistrictResponse }),
  );
  await page.route('https://api.mapbox.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/styles/v1/')) {
      return route.fulfill({ json: emptyMapboxStyle });
    }
    // The inline historical basemap references Mapbox tilesets. Serve empty
    // TileJSON so the style loads deterministically; tile requests then fail
    // harmlessly below.
    if (/\/v4\/[^/]+\.json/.test(url)) {
      return route.fulfill({
        json: {
          tilejson: '2.2.0',
          tiles: ['https://api.mapbox.com/v4/empty/{z}/{x}/{y}.pbf'],
          minzoom: 0,
          maxzoom: 14,
        },
      });
    }
    return route.abort();
  });
  await page.route(/^https:\/\/(?!api\.mapbox\.com\/).*/, (route) =>
    route.abort(),
  );
});

const expectReadyMap = async (map: Locator) => {
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-data-state', 'ready');
  await expect(map).toHaveAttribute('data-feature-count', '1');

  // Some environments (Linux CI Firefox, locked-down school devices) have no
  // WebGL. There the app must explain itself instead of showing a blank map;
  // verify that fallback, then skip the steps that need a rendered map.
  const hasWebGL = await map.page().evaluate(() => {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  });
  if (!hasWebGL) {
    await expect(
      map.getByRole('alert').filter({
        hasText: 'can’t draw the interactive map',
      }),
    ).toBeVisible();
    test.skip(true, 'No WebGL here; the fallback message was verified.');
  }

  await expect(map.locator('.mapboxgl-canvas')).toBeVisible();
  // Data layers (and therefore clicks) are available once the style loads.
  await expect(map.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 15_000,
  });
};

test('root resolves to an available historical year', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/year\/-?\d+$/);
  await expectReadyMap(page.getByTestId('map-container'));
});

test('historical deep links load static AD and BC border data without an API route', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      apiRequests.push(request.url());
    }
  });

  await page.goto('/year/1994');
  await expect(page).toHaveURL(/\/year\/1994$/);
  await expectReadyMap(page.getByTestId('map-container'));
  await expect(
    page.getByRole('button', { name: 'Map settings' }),
  ).toBeVisible();

  await page.goto('/year/-100');
  await expect(page).toHaveURL(/\/year\/-100$/);
  await expectReadyMap(page.getByTestId('map-container'));
  await expect(page.getByRole('slider', { name: 'Map year' })).toHaveAttribute(
    'aria-valuetext',
    '100 BC',
  );
  expect(apiRequests).toEqual([]);
});

test('the timeline moves through time and keeps the shared map position', async ({
  page,
}) => {
  await page.goto('/year/1492?lng=10.0000&lat=45.0000&zoom=4.00');
  await expectReadyMap(page.getByTestId('map-container'));

  await page.getByRole('button', { name: 'Next year: 1500 AD' }).click();
  await expect(page).toHaveURL(
    /\/year\/1500\?lng=10\.0000&lat=45\.0000&zoom=4\.00$/,
  );
  await expect(page).toHaveTitle(/World borders in 1500 AD/);
  await expectReadyMap(page.getByTestId('map-container'));

  await page.getByRole('slider', { name: 'Map year' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/year\/1492\?/);

  await page.goBack();
  await expect(page).toHaveURL(/\/year\/1500\?/);
});

test('selecting a territory shows its details with a safe Wikipedia fallback', async ({
  page,
}) => {
  await page.goto('/year/1994?lng=0.5000&lat=0.5000&zoom=7.00');
  const map = page.getByTestId('map-container');
  await expectReadyMap(map);

  const box = await map.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const panel = page.getByRole('complementary');
  await expect(
    panel.getByRole('heading', { name: 'Fixture Country' }),
  ).toBeVisible();
  // Wikipedia is blocked in tests, so the panel must degrade gracefully.
  await expect(
    panel.getByText('Wikipedia is unavailable right now.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('unknown years use the useful static 404', async ({ page }) => {
  const response = await page.goto('/year/9999');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'That map is not available' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Explore an available historical year' }),
  ).toBeVisible();
});

test('static preview fails feedback safely without an application server', async ({
  page,
  request,
}) => {
  const response = await request.post('/api/feedback', {
    data: { rate: 'nice', visitorId: 'fixture-visitor' },
  });
  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({
    message: 'Feedback is unavailable in local static preview',
  });

  await page.goto('/year/1994');
  await page.getByRole('button', { name: 'Feedback' }).click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await dialog.getByRole('radio', { name: 'Good' }).check();
  const submit = dialog.getByRole('button', {
    name: 'Send feedback',
    exact: true,
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Feedback is unavailable in local static preview',
  );
});

test('Pennsylvania school districts load usable district data for cold and returning users', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');

  await expectReadyMap(page.getByTestId('pa-school-districts-map-container'));
  await expect(
    page.getByRole('button', { name: 'Map settings' }),
  ).toBeVisible();
  await expect(page.getByText(/District boundaries: 2025-10/)).toBeVisible();
  await page.reload();
  await expectReadyMap(page.getByTestId('pa-school-districts-map-container'));
});
