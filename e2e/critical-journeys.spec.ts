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
        SCHOOL_NAM: 'Fixture School District',
        SCHOOL_DIS: 'Fixture',
        CTY_NAME: 'Fixture County',
      },
    },
  ],
};

const emptyMapboxStyle = {
  version: 8,
  name: 'Deterministic test style',
  sources: {},
  layers: [],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/borders/**', (route) =>
    route.fulfill({ json: historicalMapResponse }),
  );
  await page.route('**/api/pa-school-districts', (route) =>
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

test('a historical year loads deterministic border data', async ({ page }) => {
  await page.goto('/year/1994');

  await expect(page).toHaveURL(/\/year\/1994$/);
  await expectReadyMap(page.getByTestId('map-container'));
  await expect(
    page.getByRole('button', { name: 'Open settings' }),
  ).toBeVisible();
});

test('Pennsylvania school districts load usable district data', async ({
  page,
}) => {
  await page.goto('/pa/school-districts');

  await expectReadyMap(page.getByTestId('pa-school-districts-map-container'));
  await expect(
    page.getByRole('button', { name: 'Open settings' }),
  ).toBeVisible();
});
