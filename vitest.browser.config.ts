/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig } from 'vitest/config';

/**
 * Vitest Browser Mode (REMASTER_PLAN §7.2) for component tests that need
 * real layout: the timeline ruler, the bottom sheet, safe areas, and later
 * the map controller. Pure logic stays in jsdom (vitest.config.ts).
 *
 *   yarn test:browser
 *
 * Name files `*.browser.test.tsx`; the jsdom run skips them.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  // Pre-bundle so Vite does not reload the page mid-run.
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      '@testing-library/react',
    ],
  },
  test: {
    include: ['**/*.browser.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'remaster-spike/**', 'design/**'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
});
