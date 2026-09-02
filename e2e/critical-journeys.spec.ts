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
    if (route.request().url().includes('/styles/v1/')) {
      return route.fulfill({ json: emptyMapboxStyle });
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
  await expect(map.locator('.mapboxgl-canvas')).toBeVisible();
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
    page.getByRole('button', { name: 'Open settings' }),
  ).toBeVisible();

  await page.goto('/year/-100');
  await expect(page).toHaveURL(/\/year\/-100$/);
  await expectReadyMap(page.getByTestId('map-container'));
  expect(apiRequests).toEqual([]);
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
  await page.getByText('Feedback', { exact: true }).click();
  await page.getByText('Good', { exact: true }).click();
  const submit = page.getByRole('button', { name: 'Send Feedback' });
  await expect(submit).toBeEnabled();
  const alert = new Promise<string>((resolve) =>
    page.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.accept();
    }),
  );
  await submit.click();
  await expect(alert).resolves.toContain(
    'Feedback is unavailable in local static preview',
  );
});

test('Pennsylvania school districts load usable district data for cold and returning users', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');

  await expectReadyMap(page.getByTestId('pa-school-districts-map-container'));
  await expect(
    page.getByRole('button', { name: 'Open settings' }),
  ).toBeVisible();
  await expect(page.getByText(/District boundaries: 2025-10/)).toBeVisible();
  await page.reload();
  await expectReadyMap(page.getByTestId('pa-school-districts-map-container'));
});
