import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
    css: false,
  },
  resolve: {
    alias: { '@repo': fileURLToPath(new URL('..', import.meta.url)) },
  },
  oxc: { jsx: { runtime: 'automatic' } },
});
