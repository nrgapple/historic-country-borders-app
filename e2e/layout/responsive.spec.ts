/**
 * Responsive acceptance check, REMASTER_PLAN §9.5. Guards the iPad top-bar
 * regression (§2.3): at every width, nothing overflows horizontally, no two
 * visible controls overlap, overlay surfaces do not cover the top bar, and
 * the year stays fully visible.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  attachScreenshot,
  formatBox,
  intersection,
  interceptThirdParty,
  LAYOUT_PAGES,
  measure,
  settle,
  type LayoutPage,
} from './support';

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 744, height: 1024 },
  { width: 820, height: 1024 },
  { width: 1024, height: 1024 },
  { width: 1180, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

type State = {
  name: string;
  appliesTo: (target: LayoutPage) => boolean;
  enter: (page: Page) => Promise<void>;
};

const isMapPage = (target: LayoutPage) => target.kind !== 'static';

const revealMapTools = async (page: Page) => {
  const more = page.getByRole('button', { name: 'More map tools' });
  if (await more.isVisible()) await more.click();
};

const openSettings = async (page: Page) => {
  await revealMapTools(page);
  await page.getByRole('button', { name: 'Map settings' }).click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
};

const expandFinder = async (page: Page) => {
  const field = page.getByRole('combobox', { name: /find a/i }).first();
  if (!(await field.isVisible())) {
    await page
      .getByRole('button', { name: /find a/i })
      .first()
      .click();
  }
  await expect(field).toBeVisible();
  await field.fill('a');
  await expect(page.getByRole('listbox').first()).toBeVisible();
};

const STATES: State[] = [
  { name: 'default', appliesTo: () => true, enter: async () => undefined },
  {
    name: 'projector mode',
    appliesTo: isMapPage,
    enter: async (page) => {
      await revealMapTools(page);
      await page
        .getByRole('button', { name: /hide controls|projector|focus/i })
        .first()
        .click();
      await expect(
        page.getByRole('button', { name: /show controls/i }).first(),
      ).toBeVisible();
    },
  },
  {
    name: 'settings open',
    appliesTo: isMapPage,
    enter: openSettings,
  },
  {
    name: 'place finder expanded',
    appliesTo: isMapPage,
    enter: expandFinder,
  },
];

const layoutProblems = async (page: Page, target: Pick<LayoutPage, 'kind'>) => {
  const m = await measure(page);
  const { width } = m.viewport;
  const problems: string[] = [];

  // 1. No horizontal overflow.
  if (m.docScrollWidth > width)
    problems.push(`document scrollWidth ${m.docScrollWidth} > ${width}`);
  if (m.bodyScrollWidth > width)
    problems.push(`body scrollWidth ${m.bodyScrollWidth} > ${width}`);

  const modalOpen = m.items.some((item) => item.modal);
  const controls = m.items.filter(
    (item) => (item.interactive || item.year) && (!modalOpen || item.modal),
  );
  for (const c of controls) {
    if (c.interactive && (c.clipped.left < -1 || c.clipped.right > width + 1)) {
      problems.push(`${c.label} ${formatBox(c.clipped)} leaves [0, ${width}]`);
    }
  }

  // 2. No overlapping controls. Controls hidden under another layer at their
  // centre (an expanded search field over its row, a popover) are covered
  // on purpose; the surface check below decides whether that is allowed.
  const indexOf = new Map(m.items.map((item, i) => [item, i]));
  const related = (
    a: (typeof controls)[number],
    b: (typeof controls)[number],
  ) =>
    a.ancestors.includes(indexOf.get(b)!) ||
    b.ancestors.includes(indexOf.get(a)!);
  const overlaps = (
    a: (typeof controls)[number],
    b: (typeof controls)[number],
  ) => {
    const x =
      Math.min(a.visible.right, b.visible.right) -
      Math.max(a.visible.left, b.visible.left);
    const y =
      Math.min(a.visible.bottom, b.visible.bottom) -
      Math.max(a.visible.top, b.visible.top);
    return x > 1 && y > 1;
  };
  const fullyContains = (
    outer: (typeof controls)[number],
    inner: (typeof controls)[number],
  ) =>
    outer.visible.left <= inner.visible.left + 1 &&
    outer.visible.top <= inner.visible.top + 1 &&
    outer.visible.right >= inner.visible.right - 1 &&
    outer.visible.bottom >= inner.visible.bottom - 1;
  const comparable = controls.filter((c) => c.hittable || c.year);
  for (let i = 0; i < comparable.length; i += 1) {
    for (let j = i + 1; j < comparable.length; j += 1) {
      const a = comparable[i];
      const b = comparable[j];
      if (related(a, b) || !overlaps(a, b)) continue;
      // A transparent hit target laid over the year (today's year <select>)
      // is one control, not a collision.
      if ((a.year && fullyContains(b, a)) || (b.year && fullyContains(a, b)))
        continue;
      if (a.year && b.year) continue;
      problems.push(
        `${a.label} ${formatBox(a.visible)} overlaps ${b.label} ${formatBox(b.visible)}`,
      );
    }
  }

  // Overlay surfaces may cover the map and map controls, not the top bar.
  for (const surface of m.surfaces.filter((s) => !s.modal)) {
    for (const c of controls) {
      if (c.inSurface || c.mapControl) continue;
      const area = intersection(surface.box, c.visible);
      if (area > 1) {
        problems.push(
          `${surface.label} ${formatBox(surface.box)} covers ${c.label} ${formatBox(c.visible)}`,
        );
      }
    }
  }

  // 3. The year stays fully visible.
  const years = m.items.filter((item) => item.year);
  if (target.kind === 'year' && !years.length)
    problems.push('no visible year heading ([data-year-heading])');
  for (const y of years) {
    if (y.yearClipped)
      problems.push(`${y.label} ${formatBox(y.box)} is clipped`);
  }
  return problems;
};

for (const size of WIDTHS) {
  test.describe(`${size.width}×${size.height}`, () => {
    const touch = size.width <= 1180;
    test.use({
      viewport: size,
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: 1,
    });

    test.beforeEach(async ({ context, baseURL }) => {
      await interceptThirdParty(context, baseURL!);
    });

    for (const target of LAYOUT_PAGES) {
      for (const state of STATES.filter((s) => s.appliesTo(target))) {
        test(`${target.name}, ${state.name}`, async ({ page }, testInfo) => {
          await page.goto(target.path);
          await settle(page);
          await state.enter(page);
          await settle(page);
          await attachScreenshot(
            page,
            testInfo,
            `${size.width}-${target.name}-${state.name}`,
          );
          expect(await layoutProblems(page, target)).toEqual([]);
        });
      }
    }
  });
}

const DUO_VIEWPORTS = [
  { width: 382, height: 580 },
  { width: 382, height: 618 },
  { width: 594, height: 368 },
  { width: 385, height: 571 },
];

for (const size of DUO_VIEWPORTS) {
  test.describe(`Duo ${size.width}×${size.height}`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true });

    test('keeps the year, search and map tools reachable', async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      await interceptThirdParty(context, baseURL!);
      const target = { path: '/year/1783', kind: 'year' } as const;
      await page.goto(target.path);
      await settle(page);
      const year = page.getByRole('combobox', { name: 'Choose a year' });
      const previous = page.getByRole('button', { name: /^Previous year:/ });
      const next = page.getByRole('button', { name: /^Next year:/ });
      const search = page.getByRole('button', { name: /find a place/i });
      const more = page.getByRole('button', { name: 'More map tools' });
      for (const control of [year, previous, next, search, more]) {
        await expect(control).toBeVisible();
        const box = (await control.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const map = await page.getByRole('main').boundingBox();
      expect(map!.height).toBeGreaterThanOrEqual(size.height - 110);
      expect(await layoutProblems(page, target)).toEqual([]);
      await attachScreenshot(page, testInfo, 'compact-timeline');

      await more.click();
      await expect(
        page.getByRole('button', { name: 'About this map' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'About this map' }),
      ).toBeHidden();
      await openSettings(page);
      await expect(
        page.getByRole('button', { name: 'Key', exact: true }),
      ).toBeHidden();
      expect(await layoutProblems(page, target)).toEqual([]);
      await page.getByRole('button', { name: 'Close map settings' }).click();
      await expandFinder(page);
      expect(await layoutProblems(page, target)).toEqual([]);
    });
  });
}

test('retains the selected place and camera when the Duo viewport changes', async ({
  page,
  context,
  baseURL,
}) => {
  await interceptThirdParty(context, baseURL!);
  const target = LAYOUT_PAGES[2];
  await page.setViewportSize(DUO_VIEWPORTS[0]);
  await page.goto(`${target.path}&lng=16.3700&lat=48.2100&zoom=4.00`);
  await settle(page);
  const title = page.getByRole('heading', { name: 'Austro-Hungarian Empire' });
  await expect(title).toBeInViewport();
  const initial = page.url();
  const more = page.getByRole('button', { name: 'More map tools' });
  const about = page.getByRole('button', { name: 'About this map' });
  await more.click();
  await expect(about).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(about).toBeHidden();
  await expect(title).toBeInViewport();
  await more.click();
  await page.setViewportSize({ width: 669, height: 867 });
  await expect(more).toBeHidden();
  await expect(title).toBeInViewport();
  await page.setViewportSize(DUO_VIEWPORTS[0]);
  await expect(more).toBeVisible();
  await expect(about).toBeHidden();
  await expect(title).toBeInViewport();
  await expect(
    page.getByRole('combobox', { name: 'Choose a year' }),
  ).toHaveValue('1914');
  await expect(page).toHaveURL(initial);
});
