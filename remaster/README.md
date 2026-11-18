# Historic Borders remaster (Astro 7, Direction A)

The historical atlas rebuilt as static Astro 7 pages with one React 19 island and MapLibre GL JS 6, in the owner-approved Direction A, "Classic atlas". See [`docs/product/REMASTER_PLAN.md`](../docs/product/REMASTER_PLAN.md) and [`design/living-atlas/README.md`](../design/living-atlas/README.md).

**Not in production.** The current Next.js app, `wrangler.toml` and `out/` are untouched. This app builds into `remaster/dist/` and replaces `out/` only at the P4 cutover. Nothing here is deployed.

## Commands

From the repository root (Node 22.23.5 per `.nvmrc`; Yarn Classic; one root `yarn.lock`):

```bash
source ~/.nvm/nvm.sh && nvm use
export YARN_CACHE_FOLDER="/Volumes/External SSD/Developer/Caches/yarn"
export PLAYWRIGHT_BROWSERS_PATH="/Volumes/External SSD/Developer/Caches/ms-playwright"
yarn install --frozen-lockfile

yarn remaster:build        # data + tokens check + astro build -> remaster/dist (56 pages)
yarn remaster:preview      # Workers-like server on http://127.0.0.1:4410
yarn remaster:test         # Vitest (jsdom), React 19
yarn remaster:test:e2e     # Playwright critical journeys against dist/ (port 4411)
yarn remaster:type-check
yarn remaster:dev          # astro dev on :4321

# Layout acceptance (T4: safe areas §9.4, widths §9.5, forced dark §9.6):
BASE_URL=http://127.0.0.1:4410 yarn test:layout
# Design-review screenshots -> docs/product/remaster-shots/
node remaster/scripts/shoot.mjs
```

`remaster/` is a Yarn workspace with `nohoist`, so its React 19, Astro, MapLibre and Vitest 5 never collide with the Next app's React 18 and Vitest 3. Root `tsc`, ESLint and Vitest exclude `remaster/`; root Prettier formats it.

## Architecture

| Path                                                     | Purpose                                                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/year/[year].astro`                            | Prerendered year page: SEO head, preloads of the year's files, the island, and a crawlable territory list (also the no-JS / no-WebGL fallback)     |
| `src/pages/index.astro`                                  | Inline random-year redirect plus a crawlable list of all years                                                                                     |
| `src/pages/pa/school-districts.astro`                    | Prerendered PA page: the PA island and a crawlable list of all 500 districts by county (also the no-JS / no-WebGL fallback)                        |
| `src/pa/*`                                               | PA island (`SchoolDistrictsAtlas.tsx`), its MapLibre controller and `pa-tiles://` protocol (`paMap.ts`), style (`paStyle.ts`) and district helpers |
| `src/pages/404.astro`, `sitemap.xml.ts`, `robots.txt.ts` | Static 404, sitemap (same shape as `scripts/generate-sitemap.js`), robots from the repository's `public/robots.txt`                                |
| `src/atlas/store.ts`                                     | The single store and URL contract (below)                                                                                                          |
| `src/atlas/mapController.ts`                             | Imperative MapLibre controller; subscribes to the store, so camera moves never re-render React                                                     |
| `src/atlas/Atlas.tsx`                                    | The island: header, map stage, panel, dialogs                                                                                                      |
| `src/adapters/*`                                         | One module per sibling track (below)                                                                                                               |
| `src/components/*`                                       | Ported components with per-component CSS, restyled to Direction A                                                                                  |
| `src/styles/tokens.ts`                                   | The one token file. `tokens.css` is generated from it (`yarn --cwd remaster tokens`) and checked at build; the map style imports the same values   |

### Store and URL contract

`/year/<year>?lng=<lng>&lat=<lat>&zoom=<zoom>&place=<name>`

- A year change **pushes** a history entry; Back and Forward step through years (`popstate` restores year and place).
- The camera is written with `replaceState` after `moveend`, with no React render.
- `place` is mirrored with `replaceState`. A shared place stays in the link until the year's index proves it exists; a missing one is dropped. A shared place without a camera is framed.
- Settings persist in `localStorage` under the current app's key; overlays and focus mode are per visit. `<html data-era>` sets the era accent, `<html data-text="projector">` the Projector-text font.

## Adapters: sibling tracks

Each dependency is read through one module, and every track is integrated:

| Track                  | Adapter                                              | Integrated from                                                                                            |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| T1 historical data     | `src/adapters/yearData.ts`, `scripts/build-data.mjs` | `t3/historical-data-pipeline` @ `91812f5`: split files, capitals, `dep`/`ov`/`oc`, `k: city\|site`         |
| T2 basemap             | `src/adapters/basemap.ts`, `scripts/sync-public.mjs` | `t3/build-static-vector-basemap` @ `e63a4c4`: `data/basemap-manifest.json`, build `ne-5.1.2-r1`            |
| T3 fonts and glyphs    | `src/adapters/glyphs.ts`, `scripts/sync-public.mjs`  | `t3/self-host-fonts-glyphs` @ `5db4b01`: `data/map-fonts.json`, `/fonts/{atlas,map-aliases,projector}.css` |
| T4 layout suites       | root `playwright.layout.config.ts`                   | `t3/layout-test-harness` @ `5d394e7`; the year heading carries `data-year-heading`                         |
| T6 Classic-atlas style | `src/adapters/mapStyle.ts`                           | `t3/classic-atlas-map-style` @ `4dab0b1`: imported in place from `remaster-spike/src/atlas/classic/`       |
| T8 PA street basemap   | `src/data/pa.json`, `scripts/build-pa.mjs`           | `data/pa-basemap-manifest.json` (build `pm-20260811-r1`, docs/PA_BASEMAP.md); district tiles built here    |

Notes:

- **T6 in place.** Vite and TypeScript read T6's module with this app's `tsconfig.json` (Vite's `tsconfig` option and `paths` for `maplibre-gl`). When the module moves into `remaster/` (P6), only the import path in `mapStyle.ts` changes. T6's own 38-test suite runs in its workspace (`cd remaster-spike && yarn test`); `src/adapters/mapStyle.test.ts` checks how this app drives it, including T3's `checkStyleFontstacks`.
- **Low power.** T6's heuristic decides at map mount; `?lowPower=1` or `?lowPower=0` overrides it.
- **Fonts.** `atlas.css` loads on every page, `map-aliases.css` on year pages, and `projector.css` only while Projector text is on (a head script restores it before first paint).

## Left for T7 and later milestones

- **Map key (P3, T7).** `src/components/MapKeySlot.tsx` holds the bottom-left slot, its safe-area clearance and phone rules, and prints only the plate title. Build the key from `legendEntries(drawnClasses(map))` (re-exported by `mapStyle.ts`, called on `moveend`/`idle`), the scale bar from the live camera, and the locator globe from `GLOBE_LAND_URL` in `basemap.ts`. The map instance is `window.__atlasMap` today; T7 should get it from the controller's handle instead.
- **PA school districts (P5).** Ported: `/pa/school-districts` is an Astro page over the same store and chrome, with T8's street basemap and a district tile tree (docs/PA_BASEMAP.md, docs/PA_SCHOOL_DISTRICTS.md "Remaster data format"). The map key slot shows a PA plate title until T7's `MapKey` lands; give it a PA form (scale bar, legend of washes, streets and county lines). Check budgets with `yarn size:check --remaster`.
- **React Compiler.** Not enabled yet; the ported components keep their hand-written memo hooks.
