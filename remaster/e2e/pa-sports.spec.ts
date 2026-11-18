import { expect, test, type Page } from '@playwright/test';

/**
 * "Who plays whom": colouring Pennsylvania's districts by PIAA football
 * class, PIAA district or enrollment, and a district's PIAA facts in its
 * panel. Runs on the build's own committed data (data/pa-sports.json); every
 * third-party request is blocked.
 */

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const mapOf = (page: Page) =>
  page.getByTestId('pa-school-districts-map-container');

const openReadyMap = async (page: Page, path = '/pa/school-districts') => {
  await page.goto(path);
  const map = mapOf(page);
  await expect(map).toHaveAttribute('data-data-state', 'ready', {
    timeout: 30_000,
  });
  const hasWebGL2 = await page.evaluate(() =>
    Boolean(document.createElement('canvas').getContext('webgl2')),
  );
  test.skip(!hasWebGL2, 'No WebGL 2 here: the map and its key are not drawn.');
  await expect(map.locator('.map-canvas[data-loaded]')).toBeAttached({
    timeout: 30_000,
  });
};

const legendOf = (page: Page) => page.getByTestId('map-key-legend');

const openKey = async (page: Page) => {
  const toggle = page.getByRole('button', { name: 'Key' });
  if ((await toggle.getAttribute('aria-expanded')) === 'false')
    await toggle.click();
};

const findDistrict = async (page: Page, query: string, option: RegExp) => {
  const finder = page.getByRole('combobox', { name: /find a district/i });
  if (!(await finder.isVisible()))
    await page.getByRole('button', { name: /find a district/i }).click();
  await finder.fill(query);
  await page.getByRole('option', { name: option }).click();
};

test('a fan colours the map by football class, reads the key, and opens a district', async ({
  page,
}) => {
  await openReadyMap(page);
  await expect(legendOf(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Map settings' }).click();
  const colourBy = page.getByRole('radiogroup', {
    name: 'Colour districts by',
  });
  await expect(colourBy).toBeVisible();
  await colourBy.getByRole('radio', { name: 'Football class' }).check();
  await expect(page).toHaveURL(/[?&]colour=football/);
  await page.keyboard.press('Escape');

  await openKey(page);
  const legend = legendOf(page);
  await expect(legend).toContainText('PIAA football class');
  for (const cls of ['6A', '1A', 'No PIAA football'])
    await expect(
      legend.getByRole('listitem').filter({ hasText: cls }),
    ).toBeVisible();
  await expect(
    legend.getByRole('listitem').filter({ hasText: '6A' }),
  ).toContainText(/\d+ districts/);

  // The map draws the class from the tiles.
  const fill = await page.evaluate(() => {
    const map = (window as unknown as { __atlasMap: import('maplibre-gl').Map })
      .__atlasMap;
    return JSON.stringify(map.getPaintProperty('district-fill', 'fill-color'));
  });
  expect(fill).toContain('"f"');

  await findDistrict(page, 'Carlisle Area', /Carlisle Area School District/);
  const panel = page.getByRole('complementary');
  await expect(
    panel.getByRole('heading', { name: 'Carlisle Area School District' }),
  ).toBeVisible();
  await expect(
    panel.locator('.place-panel__fact', { hasText: 'PIAA district' }),
  ).toContainText('District III');
  await expect(
    panel.locator('.place-panel__fact', { hasText: 'Football class' }),
  ).toContainText('6A');
  await expect(
    panel.locator('.place-panel__fact', { hasText: 'grades 9–11' }),
  ).toContainText(/\d/);
  await expect(panel).toContainText('Facts from PIAA');
  await expect(panel.getByRole('link', { name: 'PIAA' })).toHaveAttribute(
    'href',
    /piaa\.org/,
  );

  // The shared link keeps the colouring and the district.
  await openReadyMap(
    page,
    new URL(page.url()).pathname + new URL(page.url()).search,
  );
  await openKey(page);
  await expect(legendOf(page)).toContainText('PIAA football class');
  await expect(
    page.getByRole('heading', { name: 'Carlisle Area School District' }),
  ).toBeVisible();
});

test('a multi-school district lists each high school with its class', async ({
  page,
}) => {
  await openReadyMap(page, '/pa/school-districts?colour=enrollment');
  await openKey(page);
  await expect(legendOf(page)).toContainText('Students in grades 9–11');
  await findDistrict(page, 'Pittsburgh', /^Pittsburgh School District/);
  const schools = page.getByRole('list', { name: 'PIAA high schools' });
  await expect(schools.getByRole('listitem')).not.toHaveCount(1);
  await expect(schools).toContainText(/[1-6]A/);
  await expect(
    page.locator('.place-panel__fact', { hasText: 'Football class' }),
  ).toContainText('Up to');
});

test('the finder frames a PIAA district and colours the map by it', async ({
  page,
}) => {
  await openReadyMap(page);
  await findDistrict(page, 'District III', /^PIAA District III/);
  await expect(page).toHaveURL(/[?&]colour=piaa/);
  await openKey(page);
  await expect(legendOf(page)).toContainText('PIAA district');
  await expect(
    legendOf(page).getByRole('listitem').filter({ hasText: /^XII/ }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.location.search), {
      timeout: 15_000,
    })
    .toMatch(/zoom=/);
});
