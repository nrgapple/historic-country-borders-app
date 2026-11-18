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

yarn remaster:build        # data + tokens check + astro build -> remaster/dist (55 pages)
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

| Path | Purpose |
| --- | --- |
| `src/pages/year/[year].astro` | Prerendered year page: SEO head, preloads of the year's files, the island, and a crawlable territory list (also the no-JS / no-WebGL fallback) |
| `src/pages/index.astro` | Inline random-year redirect plus a crawlable list of all years |
| `src/pages/404.astro`, `sitemap.xml.ts`, `robots.txt.ts` | Static 404, sitemap (same shape as `scripts/generate-sitemap.js`), robots from the repository's `public/robots.txt` |
| `src/atlas/store.ts` | The single store and URL contract (below) |
| `src/atlas/mapController.ts` | Imperative MapLibre controller; subscribes to the store, so camera moves never re-render React |
| `src/atlas/Atlas.tsx` | The island: header, map stage, panel, dialogs |
| `src/adapters/*` | One module per sibling track (below) |
| `src/components/*` | Ported components with per-component CSS, restyled to Direction A |
| `src/styles/tokens.ts` | The one token file. `tokens.css` is generated from it (`yarn --cwd remaster tokens`) and checked at build; the map style imports the same values |

### Store and URL contract

`/year/<year>?lng=<lng>&lat=<lat>&zoom=<zoom>&place=<name>`

- A year change **pushes** a history entry; Back and Forward step through years (`popstate` restores year and place).
- The camera is written with `replaceState` after `moveend`, with no React render.
- `place` is mirrored with `replaceState`. A shared place stays in the link until the year's index proves it exists; a missing one is dropped. A shared place without a camera is framed.
- Settings persist in `localStorage` under the current app's key; overlays and focus mode are per visit. `<html data-era>` sets the era accent, `<html data-text="projector">` the Projector-text font.

## Adapters: sibling tracks

Each dependency is read through one module. Status at the time of writing:

| Track | Adapter | Status | Switch |
| --- | --- | --- | --- |
| T1 historical data | `src/adapters/yearData.ts`, `scripts/build-data.mjs` | **Integrated** (split files, capitals, `dep`/`ov`/`oc`, `k: city\|site`) | – |
| T2 basemap | `src/adapters/basemap.ts`, `scripts/sync-public.mjs` | **Integrated** (`data/basemap-manifest.json`, build `ne-5.1.2-r1`) | – |
| T3 fonts and glyphs | `src/adapters/glyphs.ts`; UI fonts in `src/styles/fonts.css` + `scripts/sync-public.mjs` | **Stand-in**: glyph PBFs extracted from the design spike's bundles (`scripts/build-standins.mjs`) into `/glyphs-standin/`; UI WOFF2s copied from `@fontsource` | Set `GLYPHS_URL` to T3's `/glyphs/{fontstack}/{range}.pbf`; point `sync-public.mjs` `FONTS` at T3's font directory (or keep `@fontsource`, which T3 also uses); delete the glyph part of `build-standins.mjs` |
| T4 layout suites | root `playwright.layout.config.ts` | **Integrated**; the year heading carries `data-year-heading` | – |
| T6 Classic-atlas style | `src/adapters/mapStyle.ts` | **Stand-in**: a port of the A mock's layers | Re-export T6's module from `mapStyle.ts` keeping `createStyle`, `applyDynamic`, `addRelief`, `addMarkerImage`, `SOURCE`, `LAYER`, `FEATURE_STATE`, `INTERACTIVE_LAYERS`, `LEGEND`, `MARKER` (or adapt T6's names in that one file) |

## Left for T7 and later milestones

- **Map key (P3, T7).** `src/components/MapKeySlot.tsx` holds the bottom-left slot, its safe-area clearance and phone rules, and prints only the plate title. `LEGEND` in `mapStyle.ts` lists the drawn classes; `GLOBE_LAND_URL` in `basemap.ts` points at T2's 110m land.
- **Degree-ladder neatline, graticule labels and paper-grain overlay (P3).** The frame is the double rule; the grain sits only in paper surfaces.
- **PA school districts (P5).** `/pa/school-districts` is still the current app; the sitemap lists it, and T4's PA layout cases fail against this build until the port.
- **React Compiler.** Not enabled yet; the ported components keep their hand-written memo hooks.
