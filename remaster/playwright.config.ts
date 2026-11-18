import { defineConfig, devices } from '@playwright/test';

/**
 * Critical journeys against the remaster's static build (dist/), served by
 * scripts/serve.mjs like Workers Static Assets. Separate from the root
 * playwright.config.ts, which keeps testing the current Next.js export.
 *
 *   yarn remaster:build && yarn remaster:test:e2e
 *   BASE_URL=http://127.0.0.1:4410 yarn remaster:test:e2e   # reuse a preview
 *
 * The layout suites (safe areas, widths, forced dark) live in the root
 * playwright.layout.config.ts (T4) and run against any BASE_URL.
 */
const port = 4411;
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // New headless mode uses the GPU; the old headless shell renders WebGL in
    // software, where full-world year files take seconds per frame.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node scripts/serve.mjs dist ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
