import { defineConfig, devices } from '@playwright/test';
import type { Insets } from './e2e/layout/support';

/**
 * Layout acceptance suites (REMASTER_PLAN §9.4–9.6): safe areas, responsive
 * widths and forced dark mode. Kept apart from playwright.config.ts so
 * `yarn test:e2e` stays fast.
 *
 *   yarn test:layout                                   # today's app on :3000
 *   BASE_URL=http://127.0.0.1:4400 yarn test:layout    # the spike or remaster
 *   yarn test:layout --project='safe-area:*'           # one suite
 *
 * Without BASE_URL the config serves the static export in out/ (run
 * `yarn build` first). With BASE_URL nothing is started.
 */
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3000';

// Simulated safe-area insets in CSS px. iPhone values follow Apple's
// published safe areas; Pixel 7 assumes Chrome's edge-to-edge mode with a
// status bar and gesture bar (an assumption, not a measured value).
const IPHONES = [
  {
    name: 'iPhone 15 Pro',
    device: devices['iPhone 15 Pro'],
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'iPhone 15 Pro landscape',
    device: devices['iPhone 15 Pro landscape'],
    insets: { top: 0, right: 59, bottom: 21, left: 59 },
  },
  {
    name: 'iPhone SE',
    device: devices['iPhone SE'],
    insets: { top: 20, right: 0, bottom: 0, left: 0 },
  },
];

// Layout is measured in CSS px, so devices render at 1x: a 3x WebGL map in
// software rendering costs seconds per frame and adds nothing here.
const withoutBrowser = (device: (typeof devices)[string]) => {
  const { defaultBrowserType: _ignored, ...rest } = device;
  return { ...rest, deviceScaleFactor: 1 };
};

// Chromium's new headless mode draws WebGL on the GPU. The default headless
// shell uses SwiftShader, where the remaster's Classic-atlas layers on a full
// year (1492, 500 BC) stall the main thread past the test timeout.
const GPU_CHROMIUM = { launchOptions: { channel: 'chromium' } };

export default defineConfig<{ insets: Insets }>({
  testDir: './e2e/layout',
  outputDir: './test-results/layout',
  fullyParallel: true,
  // Each test loads a full WebGL map page; allow for busy CI machines.
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { open: 'never', outputFolder: 'playwright-report/layout' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/layout' }],
      ],
  use: {
    baseURL,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    // §9.4: iPhones in WebKit (custom-property insets) and in Chromium (real
    // env() insets through CDP), plus Pixel 7.
    ...IPHONES.flatMap(({ name, device, insets }) => [
      {
        name: `safe-area:webkit ${name}`,
        testMatch: /safe-area\.spec\.ts/,
        use: {
          ...withoutBrowser(device),
          browserName: 'webkit' as const,
          insets,
        },
      },
      {
        name: `safe-area:chromium ${name}`,
        testMatch: /safe-area\.spec\.ts/,
        use: {
          ...withoutBrowser(device),
          browserName: 'chromium' as const,
          ...GPU_CHROMIUM,
          insets,
        },
      },
    ]),
    {
      name: 'safe-area:chromium Pixel 7',
      testMatch: /safe-area\.spec\.ts/,
      use: {
        ...withoutBrowser(devices['Pixel 7']),
        browserName: 'chromium',
        ...GPU_CHROMIUM,
        insets: { top: 24, right: 0, bottom: 24, left: 0 },
      },
    },
    // §9.5: every width in both engines (the spec sets viewport and touch).
    {
      name: 'responsive:chromium',
      testMatch: /responsive\.spec\.ts/,
      use: { browserName: 'chromium', ...GPU_CHROMIUM },
    },
    {
      name: 'responsive:webkit',
      testMatch: /responsive\.spec\.ts/,
      use: { browserName: 'webkit' },
    },
    // §9.6: Chromium with force-dark on, WebKit with a dark preference.
    {
      name: 'forced-dark:chromium',
      testMatch: /forced-dark\.spec\.ts/,
      use: {
        browserName: 'chromium',
        colorScheme: 'dark',
        launchOptions: {
          channel: 'chromium',
          args: ['--enable-features=WebContentsForceDark'],
        },
      },
    },
    {
      name: 'forced-dark:webkit',
      testMatch: /forced-dark\.spec\.ts/,
      use: { browserName: 'webkit', colorScheme: 'dark' },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'yarn start -p 3000',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
