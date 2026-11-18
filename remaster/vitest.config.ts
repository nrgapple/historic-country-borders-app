import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // T6's own style suite stays in its workspace (cd remaster-spike && yarn
    // test); src/adapters/mapStyle.test.ts checks how this app drives it.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
    css: false,
    // UI tests can exceed 5 s on a loaded machine (observed on T1's runner).
    testTimeout: 30_000,
  },
  resolve: {
    alias: { '@repo': fileURLToPath(new URL('..', import.meta.url)) },
  },
  // One tsconfig for every file, including T6's style module under
  // remaster-spike/ (whose own tsconfig extends an Astro preset not installed there).
  tsconfig: './tsconfig.json',
  oxc: { jsx: { runtime: 'automatic' } },
});
