# Remaster spike (measurement harness)

This is a throwaway prototype of the historical map page on the stack recommended in [`docs/product/REMASTER_PLAN.md`](../docs/product/REMASTER_PLAN.md):

- **Astro 7** static pages;
- one **React 19** island;
- **MapLibre GL JS 6**;
- a first-party **Natural Earth** basemap;
- self-hosted label fonts;
- per-year GeoJSON parsed in MapLibre's worker.

**Its UI is not a design proposal.** The bottom slider, `<select>`, and header only exist to exercise the renderer, data path, and URL state. The remaster keeps the current top timeline and ports the existing components. Visual direction comes from the separate design track under `design/living-atlas/`. See §2 of the plan.

Not deployed. No Mapbox token. On the historical map, every request goes to the app's own origin.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use 22.23.5          # Astro 7 requires Node >= 22.23.4
export YARN_CACHE_FOLDER="/Volumes/External SSD/Developer/Caches/yarn"
export PLAYWRIGHT_BROWSERS_PATH="/Volumes/External SSD/Developer/Caches/ms-playwright"
yarn install --frozen-lockfile
yarn data          # year files from ../public/data (offline), Natural Earth tiles, fonts
yarn build         # dist/: 55 static pages + assets
yarn preview       # Cloudflare-like local server on http://127.0.0.1:4400 (Brotli, no Range)
yarn data:formats  # GeoJSON vs geobuf vs FlatGeobuf vs TopoJSON vs MVT -> results/formats.json
yarn measure       # throttled browser comparison -> results/browser.json + shots/
node scripts/check-safe-areas.mjs http://127.0.0.1:4400   # iPhone safe-area check prototype
node scripts/measure-glyphs.mjs     # map label glyphs: PBF vs font-faces vs local -> results/glyphs.json (uses ../public/glyphs, ../public/fonts)
```

Downloads are cached under `~/LargeFiles/historic-borders-remaster/`, which is on the SSD. They come from:

- Natural Earth v5.1.2 GeoJSON;
- Noto Sans fallback glyph ranges from `protomaps/basemaps-assets`.

Generated outputs are gitignored: `public/data`, `public/basemap`, `public/glyphs`, `public/fonts`, and `src/data/years.json`.

`yarn measure` expects the current app's `yarn build` output on port 4300, served with `node scripts/serve.mjs ../out 4300`. That build needs one uncommitted measurement line in `components/map/MapCanvas.tsx` (`attachMap`):

```ts
(window as unknown as { __map: unknown }).__map = ref.getMap();
```

## Layout

| Path                         | Purpose                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/pages/year/[year].astro` | Prerendered year page: SEO head, preloads, the island, and a crawlable or no-WebGL list of territories     |
| `src/atlas/store.ts`         | The external store (`useSyncExternalStore`). The URL is the source of truth: path holds the year; query holds camera and `place` |
| `src/atlas/map.ts`           | Imperative MapLibre controller; subscribes to the store, so camera moves cause no React renders            |
| `src/atlas/style.ts`         | First-party style: basemap, borders, labels, and `font-faces`                                              |
| `src/atlas/Atlas.tsx`        | The island (throwaway UI)                                                                                  |
| `scripts/build-*.mjs`        | Offline data, basemap, and font builds                                                                     |
| `scripts/serve.mjs`          | Imitates Workers Static Assets for measurement                                                             |
| `scripts/measure*.mjs`       | Measurements behind the plan's tables                                                                      |
