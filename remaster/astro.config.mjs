import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';

// The repository root: committed manifests (data/*.json) stay the single source.
const repo = fileURLToPath(new URL('..', import.meta.url));

// Static output only: every page is a prerendered file and the atlas is one
// React island. `build.format: 'file'` emits /year/1492.html, which Workers
// Static Assets serves at /year/1492 without a trailing-slash redirect.
export default defineConfig({
  site: 'https://historicborders.app',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  integrations: [react()],
  server: { host: '127.0.0.1', port: 4321 },
  vite: {
    // One tsconfig for every file, including T6's style module under
    // remaster-spike/ (whose own tsconfig extends an Astro preset not installed there).
    tsconfig: './tsconfig.json',
    // Keeps Vite's cache inside this SSD checkout.
    cacheDir: 'node_modules/.vite',
    resolve: { alias: { '@repo': repo } },
    server: { fs: { allow: [repo] } },
    build: { target: 'es2022' },
  },
});
