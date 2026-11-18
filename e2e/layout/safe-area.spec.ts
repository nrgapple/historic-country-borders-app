/**
 * Safe-area acceptance check, REMASTER_PLAN §9.4.
 *
 * Each project emulates a phone and simulates its safe-area insets: real
 * env() values through CDP in Chromium, and test-only custom properties in
 * WebKit (see simulateInsetsWithCustomProperties). Every visible control, text
 * block, year heading and map attribution must sit inside the viewport minus
 * the insets, also after Safari-like toolbar resizes of ±80 px.
 */
import { expect, test as base, type Page } from '@playwright/test';
import {
  attachScreenshot,
  formatBox,
  interceptThirdParty,
  LAYOUT_PAGES,
  measure,
  settle,
  simulateInsetsWithCdp,
  simulateInsetsWithCustomProperties,
  YEAR_HEADING,
  type Insets,
} from './support';

type Fixtures = { insets: Insets; insetMode: 'cdp' | 'custom-properties' };

const test = base.extend<Fixtures>({
  insets: [{ top: 0, right: 0, bottom: 0, left: 0 }, { option: true }],
  insetMode: async ({ browserName }, provide) =>
    provide(browserName === 'chromium' ? 'cdp' : 'custom-properties'),
  page: async ({ page, context, baseURL, insets, insetMode }, provide) => {
    await interceptThirdParty(context, baseURL!);
    if (insetMode === 'cdp') {
      if (!(await simulateInsetsWithCdp(page, insets))) {
        throw new Error('Emulation.setSafeAreaInsetsOverride is unavailable');
      }
    } else {
      await simulateInsetsWithCustomProperties(context, baseURL!, insets);
    }
    await provide(page);
  },
});

const insetViolations = async (page: Page, insets: Insets) => {
  const m = await measure(page);
  const { width, height } = m.viewport;
  const zone = {
    left: insets.left,
    top: insets.top,
    right: width - insets.right,
    bottom: height - insets.bottom,
  };
  const problems: string[] = [];
  for (const item of m.items) {
    const b = item.clipped;
    // Page content that scrolls (not fixed chrome) may continue below the
    // fold; only its first screen is checked, and never the bottom inset.
    const scrolls = m.docScrollable && !item.fixedChrome;
    if (b.bottom <= 0 || b.top >= height || b.right <= 0 || b.left >= width) {
      continue;
    }
    const sides = [
      b.left < zone.left - 0.5 && `left ${insets.left}`,
      b.right > zone.right + 0.5 && `right ${insets.right}`,
      b.top < zone.top - 0.5 && `top ${insets.top}`,
      !scrolls && b.bottom > zone.bottom + 0.5 && `bottom ${insets.bottom}`,
    ].filter(Boolean);
    if (sides.length) {
      problems.push(
        `${item.label} ${formatBox(b)} enters the ${sides.join(', ')} px inset`,
      );
    }
  }
  return problems;
};

const yearTop = (page: Page) =>
  page.evaluate((selector) => {
    const el = Array.from(document.querySelectorAll(selector)).find(
      (node) => node.getBoundingClientRect().height > 1,
    );
    return el ? el.getBoundingClientRect().top : null;
  }, YEAR_HEADING);

const fixedBottomProblems = (page: Page, bottomInset: number) =>
  page.evaluate((inset) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || style.visibility === 'hidden')
        continue;
      // Full-screen shells and backdrops hold the map, not controls.
      if (r.width * r.height >= 0.9 * vw * vh) continue;
      if (r.bottom > vh - inset + 0.5 && r.top < vh) {
        out.push(
          `fixed ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} reaches ${Math.round(r.bottom)} > ${vh - inset}`,
        );
      }
    }
    return out;
  }, bottomInset);

const cssSources = (page: Page) =>
  page.evaluate(async () => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const sheets: { source: string; css: string }[] = [];
    for (const style of Array.from(document.querySelectorAll('style'))) {
      sheets.push({ source: 'inline <style>', css: style.textContent || '' });
    }
    for (const link of Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    )) {
      if (new URL(link.href).origin !== location.origin) continue;
      sheets.push({
        source: new URL(link.href).pathname,
        css: await (await fetch(link.href)).text(),
      });
    }
    return {
      viewportFit: /viewport-fit\s*=\s*cover/.test(meta?.content || ''),
      offenders: sheets
        .filter(({ css }) => /(^|[^\d.])100vh\b/.test(css))
        .map(({ source }) => source),
    };
  });

for (const target of LAYOUT_PAGES) {
  test.describe(target.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(target.path);
      await settle(page);
    });

    test('at rest, nothing sits in the insets', async ({
      page,
      insets,
    }, testInfo) => {
      await attachScreenshot(page, testInfo, 'at rest');
      // Step 2: controls, text, the year and attribution.
      expect
        .soft(await insetViolations(page, insets), 'elements in the insets')
        .toEqual([]);
      // Step 4: no fixed element over the home indicator. The phone place
      // panel's paper may run to the screen edge, but its controls end
      // above the home indicator.
      expect
        .soft(
          await fixedBottomProblems(page, insets.bottom),
          'fixed elements over the home indicator',
        )
        .toEqual([]);
      if ('panel' in target && target.panel) {
        const panel = page.getByRole('complementary').first();
        await expect.soft(panel).toBeVisible();
        // Measured against the layout viewport, as the inset checks are.
        const gapUnderControls = await panel.evaluate(
          (element) =>
            window.innerHeight -
            Math.max(
              ...[...element.querySelectorAll('button, a[href]')]
                // Only controls a finger can reach (not scrolled out of view).
                .filter((control) => {
                  const rect = control.getBoundingClientRect();
                  if (rect.width === 0 || rect.height === 0) return false;
                  const hit = document.elementFromPoint(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  );
                  return hit !== null && control.contains(hit);
                })
                // Scrolled content is clipped at the panel's own edge.
                .map((control) =>
                  Math.min(
                    control.getBoundingClientRect().bottom,
                    element.getBoundingClientRect().bottom,
                  ),
                ),
            ),
        );
        expect
          .soft(gapUnderControls, 'gap under the place panel controls (px)')
          .toBeGreaterThanOrEqual(insets.bottom);
      }
      // Step 5: the page opts into the full screen and avoids 100vh.
      const { viewportFit, offenders } = await cssSources(page);
      expect
        .soft(viewportFit, 'viewport meta has viewport-fit=cover')
        .toBe(true);
      expect.soft(offenders, 'stylesheets using 100vh').toEqual([]);
    });

    // Step 3: Safari's toolbars collapse and expand.
    for (const delta of [-80, 80]) {
      test(`after a ${delta > 0 ? '+' : '−'}80 px toolbar resize, nothing sits in the insets and the year holds still`, async ({
        page,
        insets,
      }, testInfo) => {
        const viewport = page.viewportSize()!;
        const before = await yearTop(page);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height + delta,
        });
        await settle(page);
        await attachScreenshot(page, testInfo, `resized ${delta}`);
        expect
          .soft(await insetViolations(page, insets), 'elements in the insets')
          .toEqual([]);
        expect
          .soft(
            await fixedBottomProblems(page, insets.bottom),
            'fixed elements over the home indicator',
          )
          .toEqual([]);
        const after = await yearTop(page);
        if (before !== null && after !== null) {
          expect
            .soft(Math.abs(after - before), 'year heading jump (px)')
            .toBeLessThanOrEqual(4);
        }
      });
    }
  });
}
