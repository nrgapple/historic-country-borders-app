/**
 * Forced-dark-mode acceptance check, REMASTER_PLAN §9.6.
 *
 * The atlas palette is light-only. Browsers that auto-darken pages (Chrome's
 * "Auto Dark Mode for Web Contents", Samsung Internet) must leave it alone,
 * and a dark system preference must not switch to an unreviewed theme.
 *
 * Force-dark recolours pixels without changing computed styles, so Chromium
 * also compares a top-bar screenshot against the same crop from a browser
 * without force-dark. The map canvas is excluded; its colours come from the
 * map style, not CSS.
 */
import {
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { interceptThirdParty, settle } from './support';

const PAGES = [
  { name: 'year 1492', path: '/year/1492' },
  {
    name: 'year 1914 with place panel',
    path: '/year/1914?place=Austro-Hungarian%20Empire',
    panel: true,
  },
  { name: 'PA school districts', path: '/pa/school-districts' },
];

const TOP_BAR = 'header, [role="banner"]';

const keywords = (value: string | null) =>
  (value ?? '').trim().split(/\s+/).filter(Boolean).sort();

const computedColors = (page: Page) =>
  page.evaluate((topBarSelector) => {
    const bg = (el: Element | null) =>
      el ? getComputedStyle(el).backgroundColor : null;
    return {
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      meta:
        document
          .querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
          ?.content.trim() ?? null,
      body: bg(document.body),
      topBar: bg(document.querySelector(topBarSelector)),
      panel: bg(document.querySelector('aside, [role="complementary"]')),
      text: getComputedStyle(document.body).color,
    };
  }, TOP_BAR);

const open = async (
  browser: Browser,
  baseURL: string,
  path: string,
  colorScheme: 'light' | 'dark',
) => {
  const context = await browser.newContext({
    baseURL,
    colorScheme,
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  await interceptThirdParty(context, baseURL);
  const page = await context.newPage();
  await page.goto(path);
  await settle(page);
  return page;
};

/** Share of pixels whose channels differ by more than 16 (0–1). */
const pixelDiff = async (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(
    async ([first, second]) => {
      const load = async (base64: string) => {
        const blob = await (
          await fetch(`data:image/png;base64,${base64}`)
        ).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [x, y] = await Promise.all([load(first), load(second)]);
      if (x.width !== y.width || x.height !== y.height) return 1;
      let differing = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        if (
          Math.abs(x.data[i] - y.data[i]) > 16 ||
          Math.abs(x.data[i + 1] - y.data[i + 1]) > 16 ||
          Math.abs(x.data[i + 2] - y.data[i + 2]) > 16
        )
          differing += 1;
      }
      return differing / (x.width * x.height);
    },
    [a.toString('base64'), b.toString('base64')],
  );

const attach = (testInfo: TestInfo, name: string, body: Buffer) =>
  testInfo.attach(name, { body, contentType: 'image/png' });

test('the harness really forces dark mode (Chromium)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Force-dark is a Chromium feature.');
  await page.setContent(
    '<body style="margin:0;background:#ffffff"><div style="height:200px"></div></body>',
  );
  const shot = await page.screenshot({
    clip: { x: 0, y: 0, width: 50, height: 50 },
  });
  // A plain white page with no color-scheme must come out dark; otherwise
  // the pixel comparison below proves nothing.
  const share = await pixelDiff(
    page,
    shot,
    await (async () => {
      await page.setContent(
        '<meta name="color-scheme" content="light only"><body style="margin:0;background:#ffffff"><div style="height:200px"></div></body>',
      );
      return page.screenshot({ clip: { x: 0, y: 0, width: 50, height: 50 } });
    })(),
  );
  expect(share, 'force-dark changed an unprotected white page').toBeGreaterThan(
    0.9,
  );
});

for (const target of PAGES) {
  test(`${target.name} stays light under a dark preference`, async ({
    browser,
    browserName,
    baseURL,
    playwright,
  }, testInfo) => {
    const dark = await open(browser, baseURL!, target.path, 'dark');
    // Chromium's force-dark flag applies to the whole browser, so the light
    // reference comes from a second browser launched without it.
    const referenceBrowser =
      browserName === 'chromium'
        ? await playwright.chromium.launch({
            ...testInfo.project.use.launchOptions,
            args: [],
          })
        : browser;
    try {
      const light = await open(
        referenceBrowser,
        baseURL!,
        target.path,
        'light',
      );
      const darkColors = await computedColors(dark);
      const lightColors = await computedColors(light);

      // The order of `light only` is free; the keywords are compared sorted.
      expect(keywords(darkColors.meta), '<meta name="color-scheme">').toEqual([
        'light',
        'only',
      ]);
      expect(keywords(darkColors.colorScheme), ':root color-scheme').toEqual([
        'light',
        'only',
      ]);
      expect(darkColors.topBar, 'top bar is present').not.toBeNull();
      if (target.panel) {
        expect(darkColors.panel, 'place panel is open').not.toBeNull();
      }
      // Dark preference must not change the reviewed light tokens.
      expect(darkColors).toEqual(lightColors);

      const darkShot = await dark.locator(TOP_BAR).first().screenshot();
      const lightShot = await light.locator(TOP_BAR).first().screenshot();
      await attach(testInfo, 'top bar, dark preference', darkShot);
      await attach(testInfo, 'top bar, light reference', lightShot);
      expect(
        await pixelDiff(light, darkShot, lightShot),
        'share of top-bar pixels recoloured',
      ).toBeLessThanOrEqual(0.01);
      await light.context().close();
    } finally {
      await dark.context().close();
      if (referenceBrowser !== browser) await referenceBrowser.close();
    }
  });
}
