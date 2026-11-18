// Safe-area acceptance check (prototype of REMASTER_PLAN §9.4).
//   node scripts/check-safe-areas.mjs http://127.0.0.1:4400 [/year/1492 ...]
// Emulates iPhone viewports in Chromium, injects safe-area insets through CDP
// (Emulation.setSafeAreaInsetsOverride) and, as a WebKit-compatible fallback,
// through --test-inset-* custom properties, then asserts that every visible
// control and the year heading sit inside the viewport minus the insets, also
// after Safari-like toolbar resizes (+/-80 px of height).
import { chromium, devices } from '@playwright/test';

const base = process.argv[2] || 'http://127.0.0.1:4400';
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['/year/1492?lng=32&lat=39&zoom=3', '/year/-500', '/404-check'];
const CASES = [
  { name: 'iPhone 15 Pro portrait', device: devices['iPhone 15 Pro'], insets: { top: 59, right: 0, bottom: 34, left: 0 } },
  { name: 'iPhone 15 Pro landscape', device: devices['iPhone 15 Pro landscape'], insets: { top: 0, right: 59, bottom: 21, left: 59 } },
  { name: 'iPhone SE portrait', device: devices['iPhone SE'], insets: { top: 20, right: 0, bottom: 0, left: 0 } },
];
const SELECTOR = 'a[href], button, input, select, textarea, [role="slider"], h1, .maplibregl-ctrl, .mapboxgl-ctrl';

const browser = await chromium.launch({ channel: 'chromium' });
let failures = 0;
for (const c of CASES) {
  const { defaultBrowserType, ...device } = c.device;
  const context = await browser.newContext(device);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  let cdpInsets = true;
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { ...c.insets, topMax: c.insets.top, rightMax: c.insets.right, bottomMax: c.insets.bottom, leftMax: c.insets.left } }).catch(() => (cdpInsets = false));
  await page.addInitScript((i) => {
    document.addEventListener('DOMContentLoaded', () => {
      for (const [k, v] of Object.entries(i)) document.documentElement.style.setProperty(`--test-inset-${k}`, `${v}px`);
    });
  }, c.insets);
  for (const p of paths) {
    await page.goto(base + p);
    await page.waitForTimeout(2500);
    const viewportFit = await page.evaluate(() => /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]')?.content ?? ''));
    for (const dh of [0, -80, 80]) {
      const vp = { width: device.viewport.width, height: device.viewport.height + dh };
      await page.setViewportSize(vp);
      await page.waitForTimeout(300);
      const bad = await page.evaluate(({ insets, vp, sel }) => {
        const out = [];
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (!r.width || !r.height || cs.visibility === 'hidden' || el.closest('.crawl, .visually-hidden, [hidden]')) continue;
          if (r.bottom <= 0 || r.top >= vp.height) continue; // scrolled content, not chrome
          if (r.left < insets.left - 0.5 || r.right > vp.width - insets.right + 0.5 || r.top < insets.top - 0.5 || r.bottom > vp.height - insets.bottom + 0.5) {
            out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
          }
        }
        return out;
      }, { insets: c.insets, vp, sel: SELECTOR });
      const status = bad.length ? 'FAIL' : 'ok';
      if (bad.length) failures += 1;
      console.log(`${status} ${c.name} ${p} h${dh >= 0 ? '+' : ''}${dh} viewport-fit=${viewportFit} cdpInsets=${cdpInsets}${bad.length ? '\n    ' + bad.slice(0, 6).join('\n    ') : ''}`);
    }
    await page.setViewportSize(device.viewport);
  }
  await context.close();
}
await browser.close();
process.exitCode = failures ? 1 : 0;
