'use strict';

const { chromium } = require('@playwright/test');

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const runs = Number(process.env.RUNS || 3);
const deterministic = process.env.DETERMINISTIC === '1';
const journeys = [
  { name: 'historical', path: '/year/1994', testId: 'map-container' },
  {
    name: 'school',
    path: '/pa/school-districts',
    testId: 'pa-school-districts-map-container',
  },
];
const emptyMapboxStyle = {
  version: 8,
  name: 'Performance fixture',
  sources: {},
  layers: [],
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = {
    measuredAt: new Date().toISOString(),
    baseUrl,
    runs,
    journeys: {},
  };
  for (const journey of journeys) {
    const samples = [];
    for (let run = 0; run < runs; run += 1) {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        window.__longTasks = [];
        new PerformanceObserver((list) => {
          window.__longTasks.push(
            ...list.getEntries().map((entry) => entry.duration),
          );
        }).observe({ type: 'longtask', buffered: true });
      });
      if (deterministic) {
        await page.route('https://api.mapbox.com/**', (route) =>
          route.request().url().includes('/styles/v1/')
            ? route.fulfill({ json: emptyMapboxStyle })
            : route.abort(),
        );
        await page.route(/^https:\/\/(?!api\.mapbox\.com\/).*/, (route) =>
          route.abort(),
        );
      }
      const startedAt = Date.now();
      const response = await page.goto(`${baseUrl}${journey.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 120_000,
      });
      await page.waitForFunction(
        (testId) =>
          document
            .querySelector(`[data-testid="${testId}"]`)
            ?.getAttribute('data-data-state') === 'ready',
        journey.testId,
        { timeout: 120_000 },
      );
      const canvas = page.locator('.mapboxgl-canvas');
      await canvas.waitFor({ state: 'visible', timeout: 120_000 });
      const mapReadyMs = Date.now() - startedAt;
      const box = await canvas.boundingBox();
      const interactionStartedAt = Date.now();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2 + 40,
          box.y + box.height / 2,
        );
        await page.mouse.up();
        await page.waitForFunction(
          () => new URL(location.href).searchParams.has('lng'),
          null,
          {
            timeout: 5_000,
          },
        );
      }
      const interactionMs = Date.now() - interactionStartedAt;
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paints = Object.fromEntries(
          performance
            .getEntriesByType('paint')
            .map((entry) => [entry.name, Math.round(entry.startTime)]),
        );
        const dataResource = performance
          .getEntriesByType('resource')
          .find((entry) => entry.name.includes('/data/'));
        return {
          ttfbMs: Math.round(navigation.responseStart),
          domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
          firstContentfulPaintMs: paints['first-contentful-paint'],
          data: dataResource && {
            name: dataResource.name.split('/').pop(),
            durationMs: Math.round(dataResource.duration),
            transferBytes: dataResource.transferSize,
            decodedBytes: dataResource.decodedBodySize,
          },
          longTaskCount: window.__longTasks.length,
          longTaskTotalMs: Math.round(
            window.__longTasks.reduce((sum, duration) => sum + duration, 0),
          ),
          longestTaskMs: Math.round(Math.max(0, ...window.__longTasks)),
        };
      });
      samples.push({
        status: response.status(),
        mapReadyMs,
        interactionMs,
        ...metrics,
      });
      await page.close();
    }
    report.journeys[journey.name] = {
      medians: {
        mapReadyMs: median(samples.map((sample) => sample.mapReadyMs)),
        interactionMs: median(samples.map((sample) => sample.interactionMs)),
        firstContentfulPaintMs: median(
          samples.map((sample) => sample.firstContentfulPaintMs),
        ),
        dataDurationMs: median(samples.map((sample) => sample.data.durationMs)),
        longTaskTotalMs: median(
          samples.map((sample) => sample.longTaskTotalMs),
        ),
        longestTaskMs: median(samples.map((sample) => sample.longestTaskMs)),
      },
      samples,
    };
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
