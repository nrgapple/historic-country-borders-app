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
yarn data          # offline: copies T1 split year files + capitals, T2 basemap/relief, T3 glyphs/fonts from ../
yarn build         # dist/: 55 static pages + assets
yarn preview       # Cloudflare-like local server on http://127.0.0.1:4400 (Brotli, no Range)
yarn data:formats  # GeoJSON vs geobuf vs FlatGeobuf vs TopoJSON vs MVT -> results/formats.json
yarn measure       # throttled browser comparison -> results/browser.json + shots/
yarn test --maxWorkers=2   # Classic-atlas style unit tests (Vitest)
node scripts/style-review.mjs http://127.0.0.1:4400    # style screenshots -> ../docs/product/style-review/
node scripts/profile-style.mjs http://127.0.0.1:4400 --cpu=4   # per-decoration cost -> results/style-profile-*
node scripts/check-safe-areas.mjs http://127.0.0.1:4400   # iPhone safe-area check prototype
node scripts/measure-glyphs.mjs     # map label glyphs: PBF vs font-faces vs local -> results/glyphs.json (uses ../public/glyphs, ../public/fonts)
```

`yarn data` reads only the repo's committed, validated outputs: T1's `data/historical-split-assets.json` and `data/historical-capitals.json`, T2's `data/basemap-manifest.json`, and T3's `data/map-fonts.json`. The spike's original `scripts/build-basemap.mjs` and `scripts/build-glyphs.mjs` (Natural Earth and Noto downloads cached under `~/LargeFiles/historic-borders-remaster/`) remain only as the record of the plan §5/§8 measurements, and are no longer part of `yarn data`.

Generated outputs are gitignored: `public/data`, `public/tiles`, `public/basemap`, `public/glyphs`, `public/fonts`, and `src/data/years.json`.

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
| `src/atlas/style.ts`         | Re-exports the Classic-atlas (Direction A) style module                                                    |
| `src/atlas/classic/`         | Classic-atlas style: contract constants, tokens, expressions, layers, low-power rule, tests ([docs](../docs/product/style-review/README.md)) |
| `src/pages/review/[year].astro` | Full-bleed style-review page for 1492 and 1914 (screenshots, profiling)                                |
| `src/atlas/Atlas.tsx`        | The island (throwaway UI)                                                                                  |
| `scripts/build-data.mjs`, `scripts/copy-map-assets.mjs` | `yarn data`: copy T1/T2/T3 outputs into `public/`                              |
| `scripts/build-basemap.mjs`, `scripts/build-glyphs.mjs` | The spike's original basemap and glyph builds (measurement record only)       |
| `scripts/style-review.mjs`, `scripts/profile-style.mjs` | Style screenshots and per-decoration profiling                                |
| `scripts/serve.mjs`          | Imitates Workers Static Assets for measurement                                                             |
| `scripts/measure*.mjs`       | Measurements behind the plan's tables                                                                      |
