# Historic Borders

[Historic Borders](https://historicborders.app/) is an interactive map for exploring selected political-border snapshots from 123,000 BC through 2010. Select a place to read a source-backed Wikipedia summary, move through the timeline, or explore the Pennsylvania school-district map.

It is designed to work like a textbook atlas for classrooms: readable on a projector, simple on a Chromebook or phone, and every view is shareable by URL (see [docs/QUERY_PARAMS.md](docs/QUERY_PARAMS.md)). Keyboard: ← / → change year.

Historical and administrative boundaries are third-party data and may be approximate, disputed, or incomplete. Follow the in-app source links and consult original sources for academic or legal use.

## Requirements

- Node.js 22 (see `.nvmrc`)
- Yarn Classic 1.22.22 (one root `yarn.lock`; never npm or pnpm)

No map token is needed: maps are MapLibre GL JS over self-hosted vector tiles, fonts and glyphs.

## Local setup

```bash
git clone https://github.com/nrgapple/historic-country-borders-app.git
cd historic-country-borders-app
nvm use
yarn install --frozen-lockfile
yarn dev
```

Open <http://127.0.0.1:4321>. The app is Astro 7 static pages with one React 19 island per page and MapLibre GL JS 6, in the owner-approved Direction A, "Classic atlas", with Direction B, "Modern textbook", as a second map style (Settings → Map style; the Pennsylvania map's default). See [docs/product/REMASTER_PLAN.md](docs/product/REMASTER_PLAN.md) and [design/living-atlas/README.md](design/living-atlas/README.md).

### Environment variables

| Variable         | Exposure | Purpose                     |
| ---------------- | -------- | --------------------------- |
| `PUBLIC_GA_FOUR` | Browser  | Optional GA4 measurement ID |

Feedback secrets are configured only on the isolated Cloudflare Worker, never in the static build. A variable prefixed with `PUBLIC_` is baked into the browser bundle and must never contain a secret. See [docs/FEEDBACK_SETUP.md](docs/FEEDBACK_SETUP.md) and [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md).

## Commands

```bash
yarn dev                      # astro dev on :4321 (runs yarn data first)
yarn build                    # data + tokens check + astro build -> dist/ (56 pages)
yarn preview                  # Workers-like static server for dist/ on :4410
yarn validate                 # complete local quality gate (quality + browser journeys)
yarn quality                  # format, type-check, unit tests, data validation, build, dist/Cloudflare/size checks
yarn type-check               # TypeScript
yarn test                     # Vitest: app (jsdom) and data-script/Worker (node) projects
yarn test:e2e                 # Playwright critical journeys against dist/ (port 4411)
yarn test:layout              # safe-area, width and forced-dark suites (e2e/layout/, port 4410)
yarn dist:validate            # required pages, Cloudflare Free limits, Worker-first route
yarn cloudflare:check         # Wrangler dry-run of the production Worker and assets
yarn size:check               # file-count and payload budgets for dist/
yarn tokens                   # regenerate src/styles/tokens.css from tokens.ts
yarn data                     # stage shipped static files into build/public/, write src/data/
yarn data:validate            # validate all committed map data offline
yarn data:refresh             # explicitly refresh pinned upstream datasets
yarn data:reconcile:context   # explicitly map territory names to Wikidata items
yarn data:refresh:context     # explicitly refresh per-year Wikidata facts
node scripts/shoot.mjs        # design-review screenshots -> docs/product/remaster-shots/
```

Layout suites against an already running server: `BASE_URL=http://127.0.0.1:4410 yarn test:layout` with `yarn preview` running.

Tests use fixtures and do not require production credentials or live third-party APIs.

## Architecture and data

The app prerenders static HTML and ships committed, content-hashed map assets on Cloudflare Workers Static Assets. Normal pages and map assets invoke no Worker code; only the exactly routed, bounded `/api/feedback` Worker path is dynamic. Wikipedia uses direct browser CORS access. Data refreshes are explicit and reviewable rather than occurring during builds or ordinary traffic.

- Historical map data: [source, pin, validation, and uncertainty](docs/HISTORICAL_DATA.md)
- Year facts and "What changed": [Wikidata reconciliation and publication](docs/HISTORICAL_CONTEXT.md)
- Country descriptions: [Wikipedia](https://www.wikipedia.org/)
- Pennsylvania districts: PASDA (source, vintage, and limitations are documented in [docs/PA_SCHOOL_DISTRICTS.md](docs/PA_SCHOOL_DISTRICTS.md))
- Maps: [MapLibre GL JS](https://maplibre.org/) over a self-hosted Natural Earth basemap without modern borders ([docs/BASEMAP.md](docs/BASEMAP.md)) and a self-hosted Pennsylvania street basemap ([docs/PA_BASEMAP.md](docs/PA_BASEMAP.md)); fonts and glyphs in [docs/FONTS.md](docs/FONTS.md)
- Product audit and design rationale: [docs/product/REVAMP_AUDIT.md](docs/product/REVAMP_AUDIT.md), [docs/product/REMASTER_PLAN.md](docs/product/REMASTER_PLAN.md)

See [PRODUCT.md](PRODUCT.md), [docs/UPGRADE_HARNESS_PLAN.md](docs/UPGRADE_HARNESS_PLAN.md), and [docs/product/DECISIONS.md](docs/product/DECISIONS.md) for product and architecture constraints. The original Next.js app was removed on 2026-11-18; it remains in the git history.

## App architecture

| Path                                                     | Purpose                                                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/year/[year].astro`                            | Prerendered year page: SEO head, preloads of the year's files, the island, and a crawlable territory list (also the no-JS / no-WebGL fallback)     |
| `src/pages/index.astro`                                  | Inline random-year redirect plus a crawlable list of all years                                                                                     |
| `src/pages/pa/school-districts.astro`                    | Prerendered PA page: the PA island and a crawlable list of all 500 districts by county (also the no-JS / no-WebGL fallback)                        |
| `src/pa/*`                                               | PA island (`SchoolDistrictsAtlas.tsx`), its MapLibre controller and `pa-tiles://` protocol (`paMap.ts`), style (`paStyle.ts`) and district helpers |
| `src/pages/404.astro`, `sitemap.xml.ts`, `robots.txt.ts` | Static 404, sitemap, robots from `public/robots.txt`                                                                                               |
| `src/atlas/store.ts`                                     | The single store and URL contract (below)                                                                                                          |
| `src/atlas/mapController.ts`                             | Imperative MapLibre controller; subscribes to the store, so camera moves never re-render React                                                     |
| `src/atlas/transition/*`                                 | Border-change animation on year pages (below), lazy-loaded on the first animated year change                                                       |
| `src/atlas/Atlas.tsx`                                    | The island: header, map stage, panel, dialogs                                                                                                      |
| `src/adapters/*`                                         | One module per sibling track (below)                                                                                                               |
| `src/components/*`                                       | Ported components with per-component CSS, restyled to Direction A                                                                                  |
| `src/styles/tokens.ts`                                   | The one token file. `tokens.css` is generated from it (`yarn tokens`) and checked at build; the map style imports the same values                  |

Static files: `public/` holds the committed, validated sources (favicons, manifest, `robots.txt`, `_headers`, basemap tiles, fonts, glyphs, year data). It also holds data that must not ship (combined year payloads, the PASDA source artifact), so it is not Astro's publicDir: `yarn data` (`scripts/build-data.mjs`, `scripts/sync-public.mjs`, `scripts/build-pa.mjs`) copies what ships, plus the generated PA district tiles, into `build/public/` (gitignored), and Astro serves that.

### Store and URL contract

`/year/<year>?lng=<lng>&lat=<lat>&zoom=<zoom>&place=<name>`

- A year change **pushes** a history entry; Back and Forward step through years (`popstate` restores year and place).
- The camera is written with `replaceState` after `moveend`, with no React render.
- `place` is mirrored with `replaceState`. A shared place stays in the link until the year's index proves it exists; a missing one is dropped. A shared place without a camera is framed.
- Settings persist in `localStorage` under the current app's key; overlays and focus mode are per visit. `<html data-era>` sets the era accent, `<html data-text="projector">` the Projector-text font, `<html data-theme>` the map style (below).
- The map style is not in the URL: like the other settings it is a per-viewer preference.

## Map styles (themes)

Settings → **Map style** switches between **Classic atlas** (Direction A) and **Modern textbook** (Direction B, `design/living-atlas/b-modern-textbook.html`).

- **Defaults and memory** (`src/atlas/theme.ts`): year pages default to Classic, `/pa/school-districts` to Modern textbook (a present-day street map, not a historical plate). Each page family remembers its own choice in `localStorage` (`historic-borders-theme`, `historic-borders-theme:pa`), so the PA choice never changes the atlas. "Reset to defaults" restores the page family's default.
- **No flash**: the layout renders the page family's default on `<html data-theme>` and an inline head script swaps in a stored choice and adds B's font CSS (`projector.css` for Atkinson, `textbook.css` for Literata) before first paint.
- **Chrome**: `tokens.ts` holds B's tokens (`TEXTBOOK_*`; `tokens.test.ts` checks AA for every B pair). `tokens.css` switches the same custom properties under `:root[data-theme='textbook']`, so components are not forked; `src/styles/textbook.css` adds B's shapes (chapter strip, pills, solid panel header, 2×2 fact grid, rounded key).
- **Map**: `src/adapters/textbookStyle.ts` builds B from T6's Classic layer stack: same ids, sources and filters, B paint and layout, A's edge bands and waterlines hidden, and three B layers (selection hatch, white border casing, coastal shelf) that the Classic style carries hidden. A switch is therefore only `setPaintProperty`/`setLayoutProperty` (`src/lib/styleDiff.ts`): camera, sources, feature-state selection and viewport labels survive, and nothing reloads. The PA style (`src/pa/paStyle.ts`) works the same way; district fills come from `src/pa/palette.ts`.
- **Low power** in B hides the dependency hatch and the shelf; the selection hatch and outline stay.
- **Screenshots**: `THEME=textbook node scripts/shoot.mjs …`; layout suites: `LAYOUT_THEME=textbook BASE_URL=… yarn test:layout`.

## Adapters: sibling tracks

Each dependency is read through one module, and every track is integrated:

| Track                  | Adapter                                              | Integrated from                                                                                            |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| T1 historical data     | `src/adapters/yearData.ts`, `scripts/build-data.mjs` | `t3/historical-data-pipeline` @ `91812f5`: split files, capitals, `dep`/`ov`/`oc`, `k: city\|site`         |
| T2 basemap             | `src/adapters/basemap.ts`, `scripts/sync-public.mjs` | `t3/build-static-vector-basemap` @ `e63a4c4`: `data/basemap-manifest.json`, build `ne-5.1.2-r1`            |
| T3 fonts and glyphs    | `src/adapters/glyphs.ts`, `scripts/sync-public.mjs`  | `t3/self-host-fonts-glyphs` @ `5db4b01`: `data/map-fonts.json`, `/fonts/{atlas,map-aliases,projector}.css` |
| T4 layout suites       | root `playwright.layout.config.ts`                   | `t3/layout-test-harness` @ `5d394e7`; the year heading carries `data-year-heading`                         |
| T6 Classic-atlas style | `src/adapters/mapStyle.ts`                           | `t3/classic-atlas-map-style` @ `4dab0b1`: the module lives in `src/atlas/classic/`                         |
| T8 PA street basemap   | `src/data/pa.json`, `scripts/build-pa.mjs`           | `data/pa-basemap-manifest.json` (build `pm-20260811-r1`, docs/PA_BASEMAP.md); district tiles built here    |

Notes:

- **T6 in the app.** The Classic-atlas module, first built in the design spike, lives in `src/atlas/classic/` with its own suite (`style.test.ts`, `viewportLabels.test.ts`); `src/adapters/mapStyle.test.ts` checks how the app drives it, including T3's `checkStyleFontstacks`. The spike itself (`remaster-spike/`) was removed on 2026-11-18 and is in the git history.
- **Low power.** T6's heuristic decides at map mount; `?lowPower=1` or `?lowPower=0` overrides it.
- **Fonts.** `atlas.css` loads on every page, `map-aliases.css` on year pages, and `projector.css` only while Projector text is on (a head script restores it before first paint).

## Border-change animation

On year pages a year change (step buttons, timeline drag release or tap, keyboard, year select, Back/Forward) makes the borders flow from the old year to the new one in about 1.2 s: land a territory gains is pushed in from its old border, land it loses is eaten from the far side, a brand-new territory swells out from points deep inside it, and land that becomes unclaimed recedes from the nearest unclaimed land or sea. About says the animation shows where borders ended up, not the order of events.

- **Technique** (`src/atlas/transition/`): a MapLibre custom layer in the map's own WebGL 2 context, just above the territory fills (relief, water, coasts and labels stay on top). Its first frame rasterizes both years' triangulated polygons (earcut, in a worker: `geometry.ts`, `geometry.worker.ts`) with the map's camera into an `RGBA16UI` id texture, runs a jump-flood distance transform at a capped field resolution, and stores a switch time `d1 / (d1 + d2)` per changing pixel (`plan.ts` `switchTime`, mirrored in `gl.ts`): `d1` to the nearest pixel the new owner held, `d2` to the nearest pixel that is the new owner's in neither year, so every region finishes together. Each frame is one full-screen pass (no allocation): owner by eased progress, fill, border, Classic's inner edge band and Modern textbook's white casing. Territories are matched across years by name only; shapes are never matched.
- **Colours** come from the live style (`paint.ts` evaluates the layers' own expressions), so both map styles, fill opacity, border width and the selection look as the vector layers do. An expression it cannot evaluate skips the animation.
- **Lifecycle** (`index.ts`, state machine in `plan.ts` `reduce`): the map keeps the old year while the geometry and shaders prepare (the usual loading bar), the overlay fades in as the vector border lines and labels fade out (paint transitions), the borders source takes the new year under the opaque overlay, and once its tiles are drawn the overlay fades out as the lines and the new labels fade in; then the layer and its textures are removed. `.map-canvas[data-border-transition]` is set while the overlay is on screen. Pan, zoom, resize, a hidden tab, a theme or settings change, or a lost context snaps to the new year; a year change mid-animation snaps and starts from there (never a backlog).
- **Skipped** (instant swap, as before) for `prefers-reduced-motion: reduce`, low power (`?lowPower=1`), no WebGL 2, a non-Mercator projection, the first load, a reload, a moving camera, or Settings → **Animate border changes** off (persisted in `historic-borders-settings` as `animateBorders`, default on). The Pennsylvania map has one vintage and no such setting.
- **Cost**: no new requests in production (the worker reads the same immutable polygon URL MapLibre reads; neighbour years are prefetched anyway), no runtime service. The 24 KB module and 9.5 KB worker load on the first animated change. The critical journeys run with reduced motion (`playwright.config.ts`); `e2e/border-transition.spec.ts` turns motion back on.

## Map key and label priority (T7, P3)

- **Map key** (`src/components/MapKeySlot.tsx`, `MapKey.css`): A's cartouche merged with B's key. Title ("The World in 1914"), a 64 px locator globe (`src/lib/globe.ts`, Natural Earth 110m land from `GLOBE_LAND_URL`, fetched the first time the key is open), a legend from `legendEntries(drawnClasses(map))` (only classes on screen, read on `idle`), the alternating scale bar (`src/lib/scaleBar.ts`) and a north arrow. The scale bar and the globe follow the camera on `moveend` only (`src/atlas/mapKey.ts`). The bar is solved from the haversine distance at the centre latitude, so it is exact by construction; unit and e2e tests check it against the live map at z2–8.
- **Collapse.** A "Key" toggle shrinks it to the scale bar and north arrow. Phones and screens under 600 px tall start collapsed; on wider screens the visitor's choice is kept in `localStorage` (`hb:map-key-open`). On phones it sits bottom left and moves to the top while the place sheet is open, so the two never overlap.
- **Labels never hide under the key.** Panels over the map carry `data-map-obstacle` (the key, the place panel, "What changed"). After each settled move the controller runs T6's `viewportAnchors`: a state name whose label points are all off screen, clipped at an edge, or under a panel gets one anchor at the deepest point of its visible area, and its own points are hidden. A name under a panel with too little visible area for an anchor is hidden rather than drawn half under the panel. See `src/atlas/classic/viewportLabels.ts` for why this beats extra build-time label points.
- **State names beat city names.** Every state-name layer sits above the city and capital layers (MapLibre places top-down), larger territories sort first, and a colliding name may move one line up or down (`text-variable-anchor: center, bottom, top`) before it is dropped. City dots stay non-optional: a dot never appears without its name.
- The controller's handle (`MapHandle`) gives the key the map, the low-power flag and `refreshLabels()`; `window.__atlasMap` remains only as a test and screenshot hook.

## First-visit welcome

`src/components/Welcome.tsx` is the one-time "Historic Borders is back" card: six release notes, then a five-card tour with inline SVG vignettes (`WelcomeArt.tsx`). It is non-modal: a corner card on the map from 700 px, a bottom sheet above the home indicator on phones, so T4's suites run with it open.

- **When it shows** (`src/lib/welcome.ts`, `src/atlas/useWelcome.ts`): on a first visit, once dismissal is remembered in `localStorage` under `historic-borders-welcome:<WELCOME_VERSION>`. Bump `WELCOME_VERSION` and the notes to show a later release. If the browser cannot store the dismissal, it never opens by itself.
- **When it waits or closes:** never in focus mode; a shared `?place=` link keeps its first view until the visitor interacts and the panel closes. Selecting a place, opening another overlay or entering focus mode closes it, and every close counts as dismissal.
- **Reopening:** About → "Take the tour" or "read what’s new" (`actions.openWelcome`).

## Left for later milestones

- **PA school districts (P5).** Ported: `/pa/school-districts` is an Astro page over the same store and chrome, with T8's street basemap and a district tile tree (docs/PA_BASEMAP.md, docs/PA_SCHOOL_DISTRICTS.md "Site data format"). The PA page uses T7's map key with a "Commonwealth of Pennsylvania" plate. Its "Colour districts by" setting (`src/pa/colourBy.ts`: football class, PIAA district or enrollment, shared as `?colour=`) passes the key a legend through `MapKeySlot`'s `legend` prop; see docs/PA_SCHOOL_DISTRICTS.md "High-school sports". A legend for the default washes, streets and county lines is still to do. Check budgets with `yarn size:check`.
- **React Compiler.** Not enabled yet; the ported components keep their hand-written memo hooks.

## Deployment

**In production** since the P4 cutover (2026-11-18). The app builds into `dist/`, which `wrangler.toml` serves with the `/api/feedback` Worker. Every change ships through a pull request with auto-merge: the PR runs the whole gate in parallel (`checks`, `app`, one browser-test job per engine), and the merge to `main` only builds, deploys and smoke-tests (see [docs/RELEASE.md](docs/RELEASE.md)). The Deploy workflow is a manual, rebuild-from-source redeploy. Roll back with a Cloudflare Worker-version rollback, then revert the commit on `main` (docs/CLOUDFLARE_DEPLOYMENT.md).

## Contributing

1. Create a focused branch.
2. Add or update tests with behavior changes.
3. Open a pull request with auto-merge on; CI runs the full gate (docs/RELEASE.md). Locally, run only the checks you need.
4. Submit a pull request with data provenance and uncertainty changes called out explicitly.

## License

See [LICENSE](LICENSE).
