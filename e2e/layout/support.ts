/**
 * Shared helpers for the layout acceptance suites (REMASTER_PLAN §9.4–9.6).
 *
 * The suites are app-agnostic: they run against today's Next.js export, the
 * remaster spike, or the Astro remaster through BASE_URL. They therefore rely
 * on roles, standard elements, and a short list of documented hooks
 * (`[data-year-heading]`, plus today's class names as fallbacks) instead of
 * component internals.
 *
 * Map data on the app's own origin is static and is served as-is, so layouts
 * are measured with real place names and panel content. Third-party requests
 * are intercepted: Mapbox gets an empty style (no token, no metered loads),
 * Wikipedia gets a fixed summary, and everything else off-origin is aborted.
 */
import type { BrowserContext, Page, TestInfo } from '@playwright/test';

export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type Box = { left: number; top: number; right: number; bottom: number };

/** Pages from §9.4/§9.5. `panel` pages open the place panel from the URL. */
export const LAYOUT_PAGES = [
  { name: 'year 1492', path: '/year/1492', kind: 'year' },
  { name: 'year 500 BC', path: '/year/-500', kind: 'year' },
  {
    name: 'year 1914 with place panel',
    path: '/year/1914?place=Austro-Hungarian%20Empire',
    kind: 'year',
    panel: true,
  },
  { name: 'PA school districts', path: '/pa/school-districts', kind: 'map' },
  { name: '404 page', path: '/year/9999', kind: 'static' },
] as const;
export type LayoutPage = (typeof LAYOUT_PAGES)[number];

/** Everything a visitor can press, type into, or drag. */
export const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="slider"], [role="combobox"], [role="button"], [tabindex]:not([tabindex="-1"])';
/** The visible year. The remaster should mark it with data-year-heading. */
export const YEAR_HEADING =
  '[data-year-heading], .timeline__current-value, .projector-caption__title';
/** Map attribution, which must stay readable and out of the insets. */
export const ATTRIBUTION =
  '.mapboxgl-ctrl-attrib, .maplibregl-ctrl-attrib, [data-attribution]';
/** Readable text that counts as content for the safe-area check. */
export const TEXT = 'h1, h2, h3, p, li, dt, dd, label, figcaption, small';

const LONG_EXTRACT = Array.from(
  { length: 6 },
  () =>
    'This fixture paragraph stands in for a Wikipedia summary so the place panel has realistic height in layout tests.',
).join(' ');

/** Intercepts third-party traffic so layouts are deterministic and free. */
export async function interceptThirdParty(
  context: BrowserContext,
  baseURL: string,
) {
  const origin = new URL(baseURL).origin;
  await context.route(
    (url) => url.origin !== origin,
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'api.mapbox.com') {
        if (url.pathname.includes('/styles/v1/')) {
          return route.fulfill({
            json: { version: 8, name: 'Layout test', sources: {}, layers: [] },
          });
        }
        if (/\/v4\/[^/]+\.json$/.test(url.pathname)) {
          return route.fulfill({
            json: {
              tilejson: '2.2.0',
              tiles: ['https://api.mapbox.com/v4/empty/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
            },
          });
        }
      }
      if (
        url.hostname === 'en.wikipedia.org' &&
        url.pathname === '/w/api.php'
      ) {
        const title = url.searchParams.get('gsrsearch') || 'Fixture';
        return route.fulfill({
          json: {
            query: {
              pages: {
                1: {
                  title,
                  extract: LONG_EXTRACT,
                  fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
                },
              },
            },
          },
        });
      }
      return route.abort();
    },
  );
}

/**
 * WebKit cannot inject env(safe-area-inset-*) values, so WebKit projects use
 * test-only custom properties. Pages that follow §2.2 read them through
 * `max(env(...), var(--test-inset-*, 0px))`. Pages that only use env() are
 * rewritten on the fly to the same expression, so the check also measures
 * apps that have not adopted the hook yet. Production CSS is never changed.
 */
export async function simulateInsetsWithCustomProperties(
  context: BrowserContext,
  baseURL: string,
  insets: Insets,
) {
  const origin = new URL(baseURL).origin;
  await context.addInitScript((values: Insets) => {
    const apply = () => {
      for (const [side, px] of Object.entries(values)) {
        document.documentElement.style.setProperty(
          `--test-inset-${side}`,
          `${px}px`,
        );
      }
    };
    if (document.documentElement) apply();
    document.addEventListener('DOMContentLoaded', apply);
  }, insets);
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const type = route.request().resourceType();
      if (type !== 'stylesheet' && type !== 'document') return route.fallback();
      const response = await route.fetch();
      const contentType = response.headers()['content-type'] || '';
      if (!/text\/(css|html)/.test(contentType)) {
        return route.fulfill({ response });
      }
      const body = (await response.text()).replace(
        /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g,
        (_match, side: string, fallback = '') =>
          `max(env(safe-area-inset-${side}${fallback}), var(--test-inset-${side}, 0px))`,
      );
      return route.fulfill({ response, body });
    },
  );
}

/** Real env() insets in Chromium through CDP. Returns false if unsupported. */
export async function simulateInsetsWithCdp(page: Page, insets: Insets) {
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send(
      'Emulation.setSafeAreaInsetsOverride' as never,
      {
        insets: {
          ...insets,
          topMax: insets.top,
          rightMax: insets.right,
          bottomMax: insets.bottom,
          leftMax: insets.left,
        },
      } as never,
    );
    return true;
  } catch {
    return false;
  }
}

/** Waits until fonts, the map controls (if any) and the layout settle. */
export async function settle(page: Page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts?.ready.then(() => undefined));
  const hasMap = await page
    .locator('.mapboxgl-map, .maplibregl-map, canvas')
    .first()
    .isVisible()
    .catch(() => false);
  if (hasMap) {
    await page
      .locator(
        `${ATTRIBUTION}, .mapboxgl-ctrl-zoom-in, .maplibregl-ctrl-zoom-in`,
      )
      .first()
      .waitFor({ state: 'attached', timeout: 10_000 })
      .catch(() => undefined);
  }
  // Wait until control positions stop changing (late fetches, fonts,
  // ResizeObserver). Polling layout avoids waiting on animation frames,
  // which the WebGL map can hold for seconds in software rendering.
  let previous = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(150);
    const current = await page.evaluate(
      (selector) =>
        Array.from(document.querySelectorAll(selector))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${r.left | 0},${r.top | 0},${r.width | 0},${r.height | 0}`;
          })
          .join(';'),
      `${INTERACTIVE}, ${YEAR_HEADING}, [role="complementary"], [role="dialog"]`,
    );
    if (current === previous) return;
    previous = current;
  }
}

export type Measured = {
  label: string;
  box: Box;
  /** The box after clipping by overflow ancestors (not by the viewport). */
  clipped: Box;
  /** The clipped box, further clipped to the viewport. */
  visible: Box;
  /** True when it lives in fixed/sticky chrome rather than page flow. */
  fixedChrome: boolean;
  interactive: boolean;
  /** True when a hit test at the visible center lands on the element. */
  hittable: boolean;
  inSurface: string | null;
  mapControl: boolean;
  modal: boolean;
  year: boolean;
  /** For year headings: the text is cut off or scrolls inside its box. */
  yearClipped: boolean;
  /** Indices (into items) of other measured elements that contain this one. */
  ancestors: number[];
};

/**
 * Measures every visible control, text block, year heading and attribution
 * in the page. Runs in the browser; the selectors are passed in.
 */
export async function measure(page: Page): Promise<{
  items: Measured[];
  surfaces: { label: string; box: Box; modal: boolean }[];
  viewport: { width: number; height: number };
  docScrollWidth: number;
  bodyScrollWidth: number;
  docScrollable: boolean;
}> {
  return page.evaluate(
    ({ interactive, text, year, attribution }) => {
      const MAP_CONTROL =
        '.mapboxgl-ctrl, .maplibregl-ctrl, .mapboxgl-control-container, .maplibregl-control-container';
      // The map canvas is focusable but is the map, not a control.
      const EXCLUDED =
        'canvas, .mapboxgl-canvas-container, .maplibregl-canvas-container, dialog';
      // Overlay surfaces: covering the map is their job, covering the top bar
      // is not. Map controls (such as compact attribution) are not surfaces.
      const SURFACE =
        'dialog[open], [role="dialog"], aside, [role="complementary"], details:not(.mapboxgl-ctrl):not(.maplibregl-ctrl)';
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const docScrollable =
        document.documentElement.scrollHeight > vh + 1 ||
        document.body.scrollHeight > vh + 1;

      const label = (el: Element) => {
        const name =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          (el.textContent || '').trim().replace(/\s+/g, ' ');
        const cls =
          typeof (el as HTMLElement).className === 'string' &&
          (el as HTMLElement).className
            ? `.${(el as HTMLElement).className.trim().split(/\s+/)[0]}`
            : '';
        return `${el.tagName.toLowerCase()}${cls} "${name.slice(0, 32)}"`;
      };
      const toBox = (r: DOMRect) => ({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      });
      const isModal = (el: Element) => {
        const dialog = el.closest('dialog');
        try {
          return Boolean(dialog && dialog.matches(':modal'));
        } catch {
          return false;
        }
      };
      const clippedBox = (el: Element) => {
        let r = toBox(el.getBoundingClientRect());
        for (
          let node = el.parentElement;
          node && node !== document.documentElement;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (
            style.overflowX !== 'visible' ||
            style.overflowY !== 'visible' ||
            style.clip !== 'auto'
          ) {
            const c = node.getBoundingClientRect();
            r = {
              left: Math.max(r.left, c.left),
              top: Math.max(r.top, c.top),
              right: Math.min(r.right, c.right),
              bottom: Math.min(r.bottom, c.bottom),
            };
          }
          if (style.position === 'fixed') break;
        }
        return r;
      };
      const toViewport = (r: Box) => ({
        left: Math.max(r.left, 0),
        top: Math.max(r.top, 0),
        right: Math.min(r.right, vw),
        bottom: Math.min(r.bottom, vh),
      });
      const fixedChrome = (el: Element) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const position = getComputedStyle(node).position;
          if (position === 'fixed' || position === 'sticky') return true;
        }
        return false;
      };
      const shown = (el: Element) => {
        const check = (el as HTMLElement).checkVisibility;
        if (
          check &&
          !check.call(el, { visibilityProperty: true, opacityProperty: false })
        )
          return false;
        // aria-hidden only hides from assistive tech; it still draws.
        if (el.closest('[hidden]')) return false;
        return true;
      };

      const selector = [interactive, text, year, attribution].join(', ');
      const items: Measured[] = [];
      const elements: Element[] = [];
      const seen = new Set<Element>();
      document.querySelectorAll(selector).forEach((el) => {
        if (seen.has(el) || !shown(el) || el.matches(EXCLUDED)) return;
        seen.add(el);
        const box = toBox(el.getBoundingClientRect());
        const clipped = clippedBox(el);
        const visible = toViewport(clipped);
        if (
          visible.right - visible.left < 2 ||
          visible.bottom - visible.top < 2
        )
          return;
        const isInteractive =
          el.matches(interactive) &&
          !(el as HTMLButtonElement).disabled &&
          el.getAttribute('aria-disabled') !== 'true';
        const cx = (visible.left + visible.right) / 2;
        const cy = (visible.top + visible.bottom) / 2;
        const hit = document.elementFromPoint(cx, cy);
        // A <label> wrapping or naming a control counts as a hit on it.
        const hittable = Boolean(
          hit &&
          (el.contains(hit) ||
            (hit instanceof HTMLLabelElement && hit.control === el)),
        );
        const surface = el.closest(SURFACE);
        const isYear = el.matches(year);
        const html = el as HTMLElement;
        const yearClipped =
          isYear &&
          ((getComputedStyle(el).display !== 'inline' &&
            html.scrollWidth > html.clientWidth + 1) ||
            clipped.left > box.left + 0.5 ||
            clipped.right < box.right - 0.5 ||
            box.left < -0.5 ||
            box.right > vw + 0.5);
        elements.push(el);
        items.push({
          label: label(el),
          box,
          clipped,
          visible,
          fixedChrome: fixedChrome(el),
          interactive: isInteractive,
          hittable,
          inSurface: surface ? label(surface) : null,
          mapControl: Boolean(el.closest(MAP_CONTROL)),
          modal: isModal(el),
          year: isYear,
          yearClipped,
          ancestors: [],
        });
      });
      items.forEach((item, i) => {
        item.ancestors = elements.flatMap((other, j) =>
          j !== i && other.contains(elements[i]) ? [j] : [],
        );
      });

      const surfaces = Array.from(document.querySelectorAll(SURFACE))
        .filter((el) => shown(el) && el.getBoundingClientRect().width > 1)
        .map((el) => ({
          label: label(el),
          box: toBox(el.getBoundingClientRect()),
          modal: isModal(el),
        }));

      return {
        items,
        surfaces,
        viewport: { width: vw, height: vh },
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        docScrollable,
      };
    },
    {
      interactive: INTERACTIVE,
      text: TEXT,
      year: YEAR_HEADING,
      attribution: ATTRIBUTION,
    },
  );
}

export const intersection = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

export const contains = (outer: Box, inner: Box, tolerance = 1) =>
  inner.left >= outer.left - tolerance &&
  inner.top >= outer.top - tolerance &&
  inner.right <= outer.right + tolerance &&
  inner.bottom <= outer.bottom + tolerance;

export const formatBox = (b: Box) =>
  `[${Math.round(b.left)},${Math.round(b.top)} → ${Math.round(b.right)},${Math.round(b.bottom)}]`;

export async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  await testInfo.attach(name, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}
