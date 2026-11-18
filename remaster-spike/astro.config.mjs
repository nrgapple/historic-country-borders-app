import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static output only: every page is a prerendered file, and the atlas is one
// React island. `build.format: 'file'` emits /year/1492.html, which Workers
// Static Assets serves at /year/1492 without a trailing-slash redirect.
export default defineConfig({
  site: 'https://historicborders.app',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  integrations: [react()],
  vite: { build: { target: 'es2022', cacheDir: 'node_modules/.vite' } },
});
