import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Two projects, one `yarn test`:
 * - app: the Astro site's components, hooks, stores and map styles (jsdom);
 * - data: the data scripts, the feedback Worker and the production smoke
 *   check (node; tests/).
 */
export default defineConfig({
  resolve: { alias: { '@repo': root } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true,
    // UI tests can exceed 5 s on a loaded machine (observed on T1's runner).
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'data',
          environment: 'node',
          include: ['tests/**/*.test.{ts,mjs}'],
        },
      },
    ],
  },
});
