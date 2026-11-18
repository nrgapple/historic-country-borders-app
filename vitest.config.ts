import { defineConfig } from 'vitest/config';

// Node tests for the data scripts (scripts/), the feedback Worker (worker/)
// and the production smoke check. The remaster has its own Vitest config:
// yarn remaster:test.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
