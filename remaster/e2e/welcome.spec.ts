import { expect, test, type Page } from '@playwright/test';

/**
 * The one-time "Historic Borders is back" welcome and its quick tour.
 * Real static map data from the build; every third-party request is blocked.
 */

const WELCOME = /^Historic Borders is back$/;

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

const mapReady = (page: Page) =>
  expect(page.getByTestId('map-container')).toHaveAttribute(
    'data-data-state',
    /ready|unavailable/,
    { timeout: 45_000 },
  );

test('a first visit shows the welcome and tour once, then never again', async ({
  page,
}) => {
  await page.goto('/year/1914');
  const welcome = page.getByRole('dialog', { name: WELCOME });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole('listitem')).toHaveCount(6);
  // The welcome does not take focus by itself.
  await expect(
    welcome.getByRole('heading', { name: WELCOME }),
  ).not.toBeFocused();

  await welcome.getByRole('button', { name: 'Take a quick tour' }).click();
  const tour = page.getByRole('group', { name: 'Quick tour' });
  await expect(tour.getByText('Card 1 of 5')).toBeVisible();
  await expect(
    tour.getByRole('heading', { name: 'Share a place link' }),
  ).toBeVisible();

  // Arrow keys move the tour, not the map year.
  const next = tour.getByRole('button', { name: 'Next', exact: true });
  await next.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tour.getByText('Card 2 of 5')).toBeVisible();
  await expect(page).toHaveURL(/\/year\/1914(\?|$)/);
  await page.keyboard.press('ArrowLeft');
  await expect(tour.getByText('Card 1 of 5')).toBeVisible();

  for (let card = 2; card <= 5; card += 1) {
    await next.click();
    await expect(tour.getByText(`Card ${card} of 5`)).toBeVisible();
  }
  await expect(
    tour.getByRole('heading', { name: 'Reading the map' }),
  ).toBeVisible();
  await tour.getByRole('button', { name: 'Start exploring' }).click();
  await expect(
    page.getByRole('dialog', { name: /Things to try/ }),
  ).toBeHidden();

  const stored = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      k.startsWith('historic-borders-welcome:'),
    ),
  );
  expect(stored).toHaveLength(1);

  await page.reload();
  await mapReady(page);
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: WELCOME })).toHaveCount(0);

  // About still offers the tour, and it opens on the first card with focus.
  await page.getByRole('button', { name: 'About this map' }).click();
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(page.getByText('Card 1 of 5')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Things to try in class' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Card 1 of 5')).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'About this map' }),
  ).toBeFocused();
});

test('a shared place link keeps its first view until the visitor moves on', async ({
  page,
}) => {
  await page.goto('/year/1914?place=Austro-Hungarian%20Empire');
  await mapReady(page);
  const panel = page.getByRole('complementary');
  await expect(panel).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: WELCOME })).toHaveCount(0);

  await panel
    .getByRole('button', { name: /Close details for Austro-Hungarian Empire/ })
    .click();
  await expect(page.getByRole('dialog', { name: WELCOME })).toBeVisible();
});

test('projector mode hides the welcome and never brings it back by itself', async ({
  page,
}) => {
  await page.goto('/year/1914');
  await expect(page.getByRole('dialog', { name: WELCOME })).toBeVisible();
  await page.getByRole('button', { name: 'Present to class' }).click();
  await expect(page.getByRole('dialog', { name: WELCOME })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show controls' }).click();
  await expect(page.getByRole('dialog', { name: WELCOME })).toHaveCount(0);
});

test('blocked storage never shows the welcome on its own', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await page.goto('/year/1914');
  await mapReady(page);
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: WELCOME })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
});
