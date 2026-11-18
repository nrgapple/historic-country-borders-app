# Historic Borders remaster (Astro 7, Direction A)

The historical atlas rebuilt as static Astro 7 pages with one React 19 island and MapLibre GL JS 6, in the owner-approved Direction A, "Classic atlas". See [`docs/product/REMASTER_PLAN.md`](../docs/product/REMASTER_PLAN.md) and [`design/living-atlas/README.md`](../design/living-atlas/README.md).

**In production** since the P4 cutover (2026-11-18). This app builds into `remaster/dist/`, which `wrangler.toml` serves with the existing `/api/feedback` Worker. CI's `deploy` job ships the `remaster` job's tested build (artifact `remaster-dist`) as soon as that job and `validate` pass, then runs the production smoke test; the layout suite runs against the same build as a report and does not gate the deploy. The Deploy workflow is a manual, rebuild-from-source redeploy. Roll back by reverting the cutover commit on `main`.

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

- **T6 in place.** Vite and TypeScript read T6's module with this app's `tsconfig.json` (Vite's `tsconfig` option and `paths` for `maplibre-gl`). When the module moves into `remaster/` (P6), only the import path in `mapStyle.ts` changes. T6's own suite (59 tests) runs in its workspace (`cd remaster-spike && yarn test`); `src/adapters/mapStyle.test.ts` checks how this app drives it, including T3's `checkStyleFontstacks`.
- **Low power.** T6's heuristic decides at map mount; `?lowPower=1` or `?lowPower=0` overrides it.
- **Fonts.** `atlas.css` loads on every page, `map-aliases.css` on year pages, and `projector.css` only while Projector text is on (a head script restores it before first paint).

## Map key and label priority (T7, P3)

- **Map key** (`src/components/MapKeySlot.tsx`, `MapKey.css`): A's cartouche merged with B's key. Title ("The World in 1914"), a 64 px locator globe (`src/lib/globe.ts`, Natural Earth 110m land from `GLOBE_LAND_URL`, fetched the first time the key is open), a legend from `legendEntries(drawnClasses(map))` (only classes on screen, read on `idle`), the alternating scale bar (`src/lib/scaleBar.ts`) and a north arrow. The scale bar and the globe follow the camera on `moveend` only (`src/atlas/mapKey.ts`). The bar is solved from the haversine distance at the centre latitude, so it is exact by construction; unit and e2e tests check it against the live map at z2–8.
- **Collapse.** A "Key" toggle shrinks it to the scale bar and north arrow. Phones and screens under 600 px tall start collapsed; on wider screens the visitor's choice is kept in `localStorage` (`hb:map-key-open`). On phones it sits bottom left and moves to the top while the place sheet is open, so the two never overlap.
- **Labels never hide under the key.** Panels over the map carry `data-map-obstacle` (the key, the place panel, "What changed"). After each settled move the controller runs T6's `viewportAnchors`: a state name whose label points are all off screen, clipped at an edge, or under a panel gets one anchor at the deepest point of its visible area, and its own points are hidden. A name under a panel with too little visible area for an anchor is hidden rather than drawn half under the panel. See `remaster-spike/src/atlas/classic/viewportLabels.ts` for why this beats extra build-time label points.
- **State names beat city names.** Every state-name layer sits above the city and capital layers (MapLibre places top-down), larger territories sort first, and a colliding name may move one line up or down (`text-variable-anchor: center, bottom, top`) before it is dropped. City dots stay non-optional: a dot never appears without its name.
- The controller's handle (`MapHandle`) gives the key the map, the low-power flag and `refreshLabels()`; `window.__atlasMap` remains only as a test and screenshot hook.

## First-visit welcome

`src/components/Welcome.tsx` is the one-time "Historic Borders is back" card: six release notes, then a five-card tour with inline SVG vignettes (`WelcomeArt.tsx`). It is non-modal: a corner card on the map from 700 px, a bottom sheet above the home indicator on phones, so T4's suites run with it open.

- **When it shows** (`src/lib/welcome.ts`, `src/atlas/useWelcome.ts`): on a first visit, once dismissal is remembered in `localStorage` under `historic-borders-welcome:<WELCOME_VERSION>`. Bump `WELCOME_VERSION` and the notes to show a later release. If the browser cannot store the dismissal, it never opens by itself.
- **When it waits or closes:** never in focus mode; a shared `?place=` link keeps its first view until the visitor interacts and the panel closes. Selecting a place, opening another overlay or entering focus mode closes it, and every close counts as dismissal.
- **Reopening:** About → "Take the tour" or "read what’s new" (`actions.openWelcome`).

## Left for later milestones

- **PA school districts (P5).** Ported: `/pa/school-districts` is an Astro page over the same store and chrome, with T8's street basemap and a district tile tree (docs/PA_BASEMAP.md, docs/PA_SCHOOL_DISTRICTS.md "Remaster data format"). The PA page uses T7's map key with a "Commonwealth of Pennsylvania" plate. Its "Colour districts by" setting (`src/pa/colourBy.ts`: football class, PIAA district or enrollment, shared as `?colour=`) passes the key a legend through `MapKeySlot`'s `legend` prop; see docs/PA_SCHOOL_DISTRICTS.md "High-school sports". A legend for the default washes, streets and county lines is still to do. Check budgets with `yarn size:check --remaster`.
- **React Compiler.** Not enabled yet; the ported components keep their hand-written memo hooks.
