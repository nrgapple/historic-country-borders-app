import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Critical journeys, ported from the current app's e2e/critical-journeys.spec.ts
 * to the Astro build. Year data is intercepted with one fixture territory in
 * T1's split format; the basemap, glyphs and fonts are served from the
 * build itself (first-party), and every third-party request is blocked.
 * The Pennsylvania journeys are in pa-school-districts.spec.ts (P5).
 */

const yearOf = (url: string) => {
  const token = new URL(url).pathname.split('/').pop()!.split('.')[0];
  return token.startsWith('bc') ? -Number(token.slice(2)) : Number(token);
};

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

const fixtures = {
  polygons: () => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 0, properties: { c: 1 }, geometry: square },
    ],
  }),
  labels: () => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 0,
        properties: { n: 'Fixture Country', a: 12_000 },
        geometry: { type: 'Point', coordinates: [0.5, 0.5] },
      },
    ],
  }),
  index: (year: number) => ({
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
  }),
  capitals: () => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Fixture City', t: 0, qid: 'Q2' },
        geometry: { type: 'Point', coordinates: [0.4, 0.6] },
      },
    ],
  }),
  // Per-year Wikidata context; the year comes from the requested file name.
  context: (year: number) => ({
    schemaVersion: 1,
    year,
    source: {
      name: 'Wikidata',
      license: 'CC0-1.0',
      retrievedAt: '2026-11-17T00:00:00.000Z',
    },
    places: {
      'Fixture Country': {
        qid: 'Q1',
        existed: { start: 1900, end: 2000 },
        capital: [{ qid: 'Q2', label: 'Fixture City' }],
      },
    },
    changes: {
      previousYear: year - 1,
      appeared: ['Fixture Country'],
      disappeared: ['Former Fixture'],
      changed: [],
    },
  }),
};

test.beforeEach(async ({ page }) => {
  await page.route('**/data/historical/*.json', (route) => {
    const url = route.request().url();
    if (url.includes('.polygons.'))
      return route.fulfill({ json: fixtures.polygons() });
    if (url.includes('.labels.'))
      return route.fulfill({ json: fixtures.labels() });
    if (url.includes('.index.'))
      return route.fulfill({ json: fixtures.index(yearOf(url)) });
    return route.continue();
  });
  await page.route('**/data/context/*.json', (route) => {
    const url = route.request().url();
    return route.fulfill({
      json: url.includes('.capitals.')
        ? fixtures.capitals()
        : fixtures.context(yearOf(url)),
    });
  });
  // The historical map makes no third-party requests; Wikipedia (on
  // selection) is blocked so the panel must degrade gracefully.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const expectReadyMap = async (map: Locator) => {
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-data-state', 'ready', {
    timeout: 30_000,
  });
  await expect(map).toHaveAttribute('data-feature-count', '1');

  // Without WebGL 2 (some CI browsers, locked-down school devices) the app
  // must explain itself and offer the prerendered list instead.
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
    await expect(
      map.page().getByRole('heading', { name: /^Territories on the/ }),
    ).toBeAttached();
    test.skip(true, 'No WebGL 2 here; the fallback message was verified.');
  }

  await expect(map.locator('.maplibregl-canvas')).toBeVisible();
  // The year's layers (and therefore clicks) are ready once the data has drawn.
  await expect(map.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 30_000,
  });
};

const mapOf = (page: Page) => page.getByTestId('map-container');

test('root resolves to an available historical year', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/year\/-?\d+$/);
  await expectReadyMap(mapOf(page));
});

test('historical deep links load static AD and BC border data without an API route', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiRequests.push(request.url());
  });

  await page.goto('/year/1994');
  await expect(page).toHaveURL(/\/year\/1994$/);
  await expectReadyMap(mapOf(page));
  await expect(
    page.getByRole('button', { name: 'Map settings' }),
  ).toBeVisible();

  await page.goto('/year/-100');
  await expect(page).toHaveURL(/\/year\/-100$/);
  await expectReadyMap(mapOf(page));
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
  await expectReadyMap(mapOf(page));

  await page.getByRole('button', { name: 'Next year: 1500 AD' }).click();
  await expect(page).toHaveURL(
    /\/year\/1500\?lng=10\.0000&lat=45\.0000&zoom=4\.00$/,
  );
  await expect(page).toHaveTitle(/World borders in 1500 AD/);
  await expectReadyMap(mapOf(page));

  await page.getByRole('slider', { name: 'Map year' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/year\/1492\?/);

  // Back and Forward step through the years visited.
  await page.goBack();
  await expect(page).toHaveURL(/\/year\/1500\?/);
  await expect(page.getByRole('slider', { name: 'Map year' })).toHaveAttribute(
    'aria-valuetext',
    '1500 AD',
  );
  await page.goForward();
  await expect(page.getByRole('slider', { name: 'Map year' })).toHaveAttribute(
    'aria-valuetext',
    '1492 AD',
  );
});

test('a student can pick a year by name or by its printed label', async ({
  page,
}) => {
  await page.goto('/year/1492?lng=10.0000&lat=45.0000&zoom=4.00');
  await expectReadyMap(mapOf(page));

  await page
    .getByRole('combobox', { name: 'Choose a year' })
    .selectOption({ label: '1815 AD' });
  await expect(page).toHaveURL(/\/year\/1815\?lng=10\.0000/);
  await expectReadyMap(mapOf(page));

  // The printed ruler labels are click targets, not just the ticks.
  await page.locator('.timeline__labels').getByText('2010').click();
  await expect(page).toHaveURL(/\/year\/2010\?/);
  await expect(page.getByRole('slider', { name: 'Map year' })).toHaveAttribute(
    'aria-valuetext',
    '2010 AD',
  );
});

test('selecting a territory shows its gazetteer page with a safe Wikipedia fallback', async ({
  page,
}) => {
  await page.goto('/year/1994?lng=0.5000&lat=0.5000&zoom=7.00');
  const map = mapOf(page);
  await expectReadyMap(map);

  const box = await map.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const panel = page.getByRole('complementary');
  await expect(
    panel.getByRole('heading', { name: 'Fixture Country' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]place=Fixture\+Country/);
  // Wikipedia is blocked in tests, so the panel must degrade gracefully.
  await expect(
    panel.getByText('Wikipedia is unavailable right now.'),
  ).toBeVisible();
  // Year-specific facts come from the static context file and link to Wikidata.
  await expect(
    panel.getByRole('link', { name: 'Fixture City' }),
  ).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q1#P36');
  await expect(panel.getByText('1900–2000 AD')).toBeVisible();
  await expect(
    panel.getByText(
      'Facts from Wikidata (CC0) and Historical Basemaps (GPL-3.0).',
    ),
  ).toBeVisible();
  // Key dates: the lifespan bar marks this map's year.
  await expect(panel.getByRole('heading', { name: 'Key dates' })).toBeVisible();
  await expect(panel.getByText('This map', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).not.toHaveURL(/place=/);
});

test('a teacher finds a territory by name and shares the selection', async ({
  page,
}) => {
  await page.goto('/year/1994');
  const map = mapOf(page);
  await expectReadyMap(map);

  const finder = page.getByRole('combobox', { name: 'Find a place' });
  await finder.fill('fixture');
  await page.getByRole('option', { name: 'Fixture Country' }).click();

  const panel = page.getByRole('complementary');
  await expect(
    panel.getByRole('heading', { name: 'Fixture Country' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]place=Fixture\+Country/);
  await expect(panel.getByRole('button', { name: 'Copy link' })).toBeVisible();

  await page.reload();
  await expectReadyMap(map);
  await expect(
    page
      .getByRole('complementary')
      .getByRole('heading', { name: 'Fixture Country' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]place=Fixture\+Country/);
});

test('a shared place that does not exist in the year is dropped from the link', async ({
  page,
}) => {
  await page.goto('/year/1994?place=Atlantis');
  await expectReadyMap(mapOf(page));
  await expect(page).not.toHaveURL(/place=/);
  await expect(page.getByRole('complementary')).toBeHidden();
});

test('the year summary lists what changed and opens from the keyboard', async ({
  page,
}) => {
  await page.goto('/year/1994');
  await expectReadyMap(mapOf(page));

  const toggle = page.getByText('What changed since 1993');
  await expect(toggle).toBeVisible();
  await expect(page.getByText('Former Fixture')).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: /Gone from the map/ }),
  ).toBeVisible();
  await expect(page.getByText('Former Fixture')).toBeVisible();
});

test('projector text loads Atkinson only when chosen, applies everywhere and persists', async ({
  page,
}) => {
  const atkinson: string[] = [];
  page.on('request', (request) => {
    if (/atkinson/i.test(decodeURIComponent(request.url())))
      atkinson.push(request.url());
  });
  await page.goto('/year/1994?lng=0.5&lat=0.5&zoom=5');
  await expectReadyMap(mapOf(page));
  expect(atkinson).toEqual([]);

  await page.getByRole('button', { name: 'Map settings' }).click();
  await page.getByRole('switch', { name: 'Projector text' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'projector');
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily))
    .toContain('Atkinson Hyperlegible Next');
  // Map labels switch to the Atkinson glyph stacks.
  await expect
    .poll(() => atkinson.some((url) => url.includes('/glyphs')))
    .toBe(true);
  await expect
    .poll(() => atkinson.some((url) => url.endsWith('.woff2')))
    .toBe(true);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'projector');
});

test('focus mode keeps the year and place on screen for a projector', async ({
  page,
}) => {
  await page.goto('/year/1994?place=Fixture%20Country');
  await expectReadyMap(mapOf(page));
  await page.getByRole('button', { name: 'Present to class' }).click();
  const caption = page.getByTestId('projector-caption');
  await expect(caption).toContainText('1994 AD');
  await expect(caption).toContainText('Fixture Country');
  await expect(page.getByRole('slider', { name: 'Map year' })).toBeHidden();
  await page.getByRole('button', { name: 'Show controls' }).click();
  await expect(page.getByRole('slider', { name: 'Map year' })).toBeVisible();
});

test('unknown years use the useful static 404', async ({ page }) => {
  const response = await page.goto('/year/9999');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'That map is not available' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open a random year' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'See the world in 1914' }),
  ).toHaveAttribute('href', '/year/1914');
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
  const submit = dialog.getByRole('button', {
    name: 'Send feedback',
    exact: true,
  });
  await expect(submit).toBeDisabled();
  // A message alone is enough; the rating is optional.
  await dialog
    .getByLabel('What did you notice on this map?')
    .fill('A border looks wrong');
  // The fingerprint (abuse control) is generated locally once the dialog opens.
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Feedback is unavailable in local static preview',
  );
});

test('pages are static, light-only and safe-area ready', async ({
  request,
}) => {
  for (const path of ['/', '/year/1492', '/year/-500', '/year/9999']) {
    const html = await (await request.get(path)).text();
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('<meta name="color-scheme" content="only light">');
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://historicborders.app/year/1492</loc>');
  expect(sitemap.match(/<url>/g)).toHaveLength(55);
  expect(await (await request.get('/robots.txt')).text()).toContain(
    'Sitemap: https://historicborders.app/sitemap.xml',
  );
});
