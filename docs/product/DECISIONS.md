# Product and Architecture Decisions

## Accepted

### Static-first Cloudflare deployment

Normal pages and map assets will not invoke request-time compute. Cloudflare is the target because its static asset delivery fits the free-only constraint and its bot controls address crawler amplification. Dynamic compute is restricted to justified, bounded endpoints.

### Wikipedia-only country information

Generated country descriptions, country comparisons, their UI, analytics, history, caching service, and provider-specific dependencies were removed in M1. Wikipedia is the sole information source.

### Exactly one dynamic feedback route

The static app has no Next API routes. Workers Static Assets uses `run_worker_first = ["/api/feedback"]`, so only that exact path executes Worker code. A per-client SQLite Durable Object strictly limits 20 attempts/minute; schema/body/origin/method checks, destination timeouts, and safe failures provide the remaining bounds. Historical maps and school maps are direct static assets. Wikipedia uses direct browser CORS access. See `docs/RUNTIME_SURFACE.md`.

### Pennsylvania school districts as a committed static artifact

The browser consumes a committed, validated artifact generated only by `yarn data:refresh:schools`. Normal builds and page traffic do not contact PASDA. Committing the measured 19.4 MiB artifact keeps deployment deterministic, portable, and free-tier compatible while preserving a reviewable upstream diff.

### Historical maps as committed immutable artifacts

M3 measured 53 processed historical payloads at 55,615,413 bytes total (53 MiB), with the largest individual asset below Cloudflare's 25 MiB static-asset limit. Committing content-hashed payloads plus source/output hashes keeps builds offline, portable, reviewable, and independent of an object-storage service or request-time GitHub access. Old hashes remain available for deployment rollback until no active deployment references them.

### Workers Static Assets instead of Pages Functions

Cloudflare Pages rejected the required native rate-limit binding during the first preview attempt. Workers Static Assets provides the same free/unlimited direct asset path while allowing exact `run_worker_first` routing. Production checks then showed the native Rate Limiting binding was permissive enough not to enforce the required test threshold, so feedback now uses a strict SQLite Durable Object available within Workers Free allocations. This keeps all compute behind only `/api/feedback`; a live tail proved ordinary assets do not invoke Worker code.

### Sub-meter school coordinate publication

M4 measurements identified the PA school artifact as the dominant transfer bottleneck. Publishing coordinates to six decimal places retains sub-meter precision, source provenance, every coordinate pair/district/property, and geometry validation while reducing the artifact 41% raw and approximately 64% Brotli. Geometry simplification remains rejected until topology and visual acceptance tests justify changing source shapes.

### Five-decimal historical coordinate publication

Observed: the 53 historical payloads carried ~15-significant-digit coordinates (55,615,413 bytes raw, ~14.2 MB Brotli), while the upstream borders are hand-drawn approximations with roughly kilometre-level accuracy. Decision: the historical pipeline publishes border, label, and place coordinates at five decimal places (~1.1 m), drops consecutive duplicate positions created by rounding, and keeps a ring's original coordinates only when rounding would collapse it below four positions (208 rings at the pinned commit). This reduced total payloads 33% raw and 49% Brotli, without removing features, names, colors, or source properties, and without changing the pinned source. Area and label placement still use source geometry, so zero-area anomaly reporting is unchanged. Five rather than six decimals (the school standard) is justified by the much coarser source accuracy. Geometry simplification remains rejected for the same reason as for school districts.

### Optional fingerprinting only after feedback intent

FingerprintJS is an abuse-control input for the optional feedback endpoint, not a prerequisite for map browsing. It is dynamically loaded only after a visitor opens feedback, reducing ordinary startup code/CPU and privacy surface without weakening the feedback rate limit.

### Classroom-first interface (2026-11 revamp)

The primary audience is high-school teachers projecting the map and students using Chromebooks or phones. The interface follows a "textbook atlas" style: a large, readable year; era-grouped timeline; source-linked facts; no marketing toasts or emoji; projector-friendly contrast; and a focus mode that hides controls. See `docs/product/REVAMP_AUDIT.md`.

### Physical basemap without modern borders

Historical maps use a minimal inline Mapbox style (`lib/basemap.ts`): land, water, major rivers, and soft relief. Modern country borders, roads, and names are anachronistic under historical borders and confused readers; Mapbox Standard was also the heaviest startup cost on low-end GPUs. The school-district map keeps Mapbox Light because modern streets help people locate districts.

### Bounded client data caches

Map payloads are held in small LRU caches (two historical years, one school artifact, sixty Wikipedia summaries), superseded downloads are aborted, and adjacent years are only prefetched into the HTTP cache at idle, never under Save-Data or slow connections. Immutable, content-hashed static assets plus the browser HTTP cache are the long-term cache; no IndexedDB or service-worker cache is used.

### Render-time atlas palette

The pipelines' legacy 30-color assignments are remapped to a muted atlas palette by a Mapbox `match` expression. This keeps published data hashes stable while allowing visual-theme changes without a data refresh.

### Static Wikidata facts and "What changed" per year (2026-11)

Observed: the place panel showed only border-source properties and a Wikipedia summary, so students could not see who ruled a territory or where its capital was in the selected year. Wikidata holds dated capital, head-of-state, and lifespan statements under CC0, but its coverage is uneven and its names do not always match the source maps.

Decision: an explicit, network-using refresh (`yarn data:reconcile:context`, `yarn data:refresh:context`) maps territory NAMEs to Wikidata items. It is conservative: exact name or Wikipedia title, polity type, and date checks; ambiguous or unmatched names get no facts. It then pins each entity's revision in a committed snapshot and publishes one small immutable context file per year. A file holds only facts definitely valid in that year, plus a "What changed" summary computed from our own border payloads. The browser bundles only a year → URL manifest and fetches one static file per year. Builds, page views, and crawlers never contact Wikidata, and `yarn data:validate:context` rebuilds every file from the snapshot offline. Each fact links to its Wikidata source, and the panel credits "Facts: Wikidata". This amends "Wikipedia-only country information": Wikipedia remains the only prose source; Wikidata adds short structured facts and nothing is generated. See `docs/HISTORICAL_CONTEXT.md`.

### Split historical year files for the remaster (2026-11, T1)

Observed: the remaster hands map data to MapLibre's worker by URL (`docs/product/REMASTER_PLAN.md` §6). The combined per-year payload mixes polygons, labels and places with every source property. Direction A needs inward line offsets, which require RFC 7946 winding. Six source borders had an empty or whitespace-only `NAME` that passed validation. Upstream places have no type, so ruins were drawn as living cities.

Decision:

- **Split files.** Each year also publishes three content-hashed files, recorded in `data/historical-split-assets.json`:
  - polygons with only a territory `id`, the atlas wash `c` (legacy slot mod 12, as in the approved mock) and dependency fields `dep`/`ov`/`oc`, rewound to RFC 7946;
  - labels (`n`, `a` in km²) and places (`p`, `k` city/site);
  - a territory index (`NAME`, `PARTOF`, `SUBJECTO`, `BORDERPRECISION`, an antimeridian-aware `bbox`, the label point).
- **Offline rebuild.** The split files are a pure function of the committed combined payloads and a reviewed place-class file, so `yarn data:validate` rebuilds them offline and requires byte-for-byte equality.
- **Combined files kept.** The combined files keep their shape for production until P4. They change only by removing blank names and trimming padded ones (15 files).
- **Blank names.** A blank NAME is never published. The split files fall back to the source's own `ABBREVN` (recorded as `nameFrom`). Otherwise the polygon stays on the map without an id or label. No name is invented, so the 1994–2010 Swiss polygon stays unnamed until a reviewed override exists.
- **Archaeological sites.** They come from `data/historical-place-classes.json`, a sourced, reviewed list checked against upstream on refresh like the end-date overrides: 11 places, some with a `from` year.
- **Capital points.** Capital points per year combine Wikidata P625 (pinned in the context snapshot, fetched by the explicit refresh) with the split polygons. They are published only when inside or within 50 km of the territory, and every rejection is listed for review.
- **Budgets.** `yarn size:check` budgets split files at Brotli-5 and encodes the plan's vector-tile trigger: at most five polygon years above 300 KiB.

Rejected alternatives:

- Rewinding or slimming the combined files would change production payloads for no production benefit.
- Taking ABBREVN in the combined files would add names the committed Wikidata mapping has not reconciled.
- `.geojson` file names: their content type on Workers Static Assets is unverified until P0, and `.json` is compressed.

### First-party Natural Earth basemap for the remaster (2026-11, track T2)

**Observed.**

- The historical polygons overrun coastlines; parts of the Black Sea and Adriatic lie inside territories.
- The remaster drops Mapbox (plan §5) and must not add third-party map hosts.
- Workers Static Assets allows 20,000 files per deployment, and the plan reserves room for a ~10k-file PA street tree under a 16,000-file gate.
- Natural Earth is public domain and frozen at v5.1.2.

**Decision.** An explicit, network-using refresh, `yarn data:refresh:basemap`, builds one static z/x/y vector-tile tree and two assets from pinned, hash-checked Natural Earth files:

- the tree is `/tiles/basemap/<build>/{z}/{x}/{y}.pbf`;
- the assets are a tinted relief WebP and 1:110m land for the locator globe.

The tiles carry five layers:

- an `ocean` mask (world minus land, cut on the z3 tile grid), which the style paints over the territory fills;
- `coast`, wound with water on the right and tagged `landmass_km2` for the waterline rule;
- `lakes`;
- `rivers`;
- `marine_labels`.

**Max zoom: z5, by measurement.**

- Every candidate keeps the full 1:50m detail at its top zoom.
- z5 is 1,365 files and 1.6 MB, with a 2 px worst snap at the app's z10.
- z6 would be 5,461 files for 1 px. z7 exceeds 20,000.

**Placeholders.** Inland tiles are written as tiny valid placeholders, so the pyramid is complete and nothing 404s.

**Delivery.** `_headers` serves `.pbf`/`.mvt` tiles as `application/x-protobuf`, which is compressible, and caches both trees as immutable per build.

**Validation.** `yarn data:validate:basemap`, part of `yarn data:validate`, checks offline:

- pins and hashes;
- the complete pyramid;
- a tree digest against the manifest;
- byte and file budgets (≤ 1,500 files);
- the layer contract in every tile.

**Rejected.**

- **30° mask cells,** because tile-aligned cells hide seams.
- **Packing the globe land into tiles.** The canvas globe needs whole rings.
- **PMTiles.** It needs Range requests, which Workers Static Assets does not honor.

**Unverified until P0:** whether Workers Static Assets compresses `application/x-protobuf`. See `docs/BASEMAP.md`.

### PA street basemap and district tiles for the remaster (2026-11, P5 and T8)

**Observed.**

- Protomaps names residential streets only from z14; its z12–13 tiles carry main roads and a few unnamed minor roads.
- A native z13 tree is 13,109 files and z14 is 48,830; the remaster's gate is 16,000 files including T2's 1,368.
- The current district artifact is 11.5 MiB raw (1.71 MiB Brotli-11) and takes 560–660 ms to `JSON.parse` on a fast Mac before MapLibre indexes it again.
- This Mac has no Docker context, tippecanoe or Go `pmtiles` binary.

**Decision.**

- **Street basemap.** `yarn data:refresh:pa-basemap` reads one pinned Protomaps daily build over coalesced HTTP Range requests in pure Node (`pmtiles@4.5.0`, `vt-pbf`) and commits a static z0–12 tree in which each z12 tile carries z14's streets: 3,864 files, 36.8 MiB (24.2 MiB Brotli-5), largest 107 KiB. Water, streets, places and state and county lines only. The tree lives in `data/pa-basemap/<build>/` so the legacy Next export never ships it. See `docs/PA_BASEMAP.md`.
- **Districts.** A z11 vector-tile tree at extent 8192 (a 1.8 m grid, 838 files) built offline from the committed artifact in `yarn remaster:build`, plus a 138 KiB property index. The state view needs 31–63 KiB of tiles. See `docs/PA_SCHOOL_DISTRICTS.md` ("Remaster data format").
- **No missing-tile requests.** Both trees ship a coverage index; the page's `pa-tiles://` protocol fetches only covered tiles, and MapLibre overzooms the nearest parent outside the state.

**Recommendation.** Keep the R2/PMTiles option from plan §5 in reserve: the remaster now deploys 6,570 files, so the static tree has room to grow (for example, z13 streets around the cities) before the gate matters.

### Self-hosted OFL fonts and prebuilt map glyphs (remaster, 2026-11)

Observed: the remaster's Classic-atlas design (plan §2.1) uses Alegreya, Alegreya SC and Alegreya Sans, and offers Atkinson Hyperlegible Next as projector text. Published names also use Canadian syllabics, Cherokee, Osage, IPA letters and combining marks. MapLibre 6.19 draws a glyph locally with TinySDF at 3.29 ms per glyph under 4× CPU, against 0.09 ms to decode it from a prebuilt PBF (`remaster-spike/results/glyph-raster.json`). Wrangler sends `.pbf` without a Content-Type.

Decision: the fonts are self-hosted OFL WOFF2s from pinned `@fontsource` packages, plus a HarfBuzz subset of the full Noto Sans pinned by `google/fonts` commit and SHA-256. They ship with their license copies and content-hashed names. An explicit build step, `yarn data:refresh:fonts`, renders SDF glyph PBFs for seven fixed fontstacks into a content-addressed `/glyphs/<buildId>/` tree. It emits only the 256-codepoint ranges that published names use, and merges Noto fallbacks into each stack. Alias `@font-face` rules named after the fontstacks keep MapLibre's locally drawn grapheme clusters in the same fonts. `_headers` serves glyphs as immutable `application/x-protobuf`. `yarn data:validate:fonts` fails when any published codepoint lacks a glyph in any stack, when files drift from `data/map-fonts.json`, or when a license copy is missing. The style uses PBF glyphs, not `font-faces`, because main-thread time on Chromebooks matters more than about 250 KB of cacheable glyph bytes. See `docs/FONTS.md`.

### Production cut over to the remaster (P4, 2026-11-18)

Observed: the owner asked for the remaster to replace production directly, with no staged or parallel release; traffic is low.

Decision: `wrangler.toml` and `wrangler.preview.toml` serve `remaster/dist/`. Deploy and Preview build it with `yarn remaster:build` and check it with `scripts/validate-remaster-dist.js` (required pages, Cloudflare Free file limits). The production smoke test reads the remaster's split 1994 polygons and hashed PA district index. The Mapbox token is no longer used or required. The `/api/feedback` Worker and its Durable Object are unchanged. The plan's temporary legacy PA asset directory was not needed because the PA page was remastered first.

Rollback: revert the cutover commit on `main`; Deploy rebuilds and redeploys the Next.js export. (After the legacy app's removal below, that also requires reverting the removal.)

### Legacy Next.js app removed (2026-11-18)

Observed: since the P4 cutover the root Next.js app was never built or deployed, yet CI still ran its quality gate and three-browser journeys, and that job's browser install hung CI for 20+ minutes.

Decision: delete the Next.js app (pages, components, hooks, contexts, styles, Next-only `lib/`, `config/`, `util/`, `next.config.js`), its unit and Playwright tests and configs, the legacy-only scripts (`validate-static-export.js`, `static-server.js`, `generate-sitemap.js`, `measure-map-performance.js`), the legacy `public/sitemap.xml` and `public/_redirects`, ESLint (its only config was `eslint-config-next`) and every root dependency used only by that app (Next, React 18, Mapbox GL, react-map-gl, Testing Library, jsdom, coverage). `yarn size:check` now measures `remaster/dist` only. CI keeps a `checks` job (format, type-check, script/Worker tests, data validation) and moves `cloudflare:check` and `size:check` into the `remaster` job; the deploy job still needs only `remaster`. The layout suites move to their own `Layout` workflow with cancel-in-progress concurrency and job/step timeouts, so a stuck run can no longer delay a later push's deploy. Data refresh and validation scripts, `e2e/layout/`, `worker/`, provenance and attribution are unchanged.

Rollback: the app is in git history before this change; it was already not deployed.

### The Astro app is the repository root (2026-11-18)

Observed: with the Next.js app gone, the production app still lived in `remaster/` as a nohoisted Yarn workspace, imported its Classic-atlas style from the design spike (`remaster-spike/src/atlas/classic/`), and every command carried a `remaster:` prefix.

Decision: move the app to the root as one package. `remaster/{src,scripts,e2e,test}` and its configs moved with history (`git mv`); `remaster/package.json` merged into the root with its exact pins (Astro 7.4.12, React 19.3.1, Vite 8.3.8, Vitest 5.1.0, Playwright 1.65.1) and one regenerated `yarn.lock`. The Classic-atlas module and its tests moved to `src/atlas/classic/`, and `remaster-spike/` was deleted (its measurements, results and screenshots are in the git history). One `tsconfig.json` and one Vitest config (projects `app`, jsdom, and `data`, node) cover everything; `remaster/e2e/*` joined `e2e/` beside `e2e/layout/`. Commands lose the prefix: `dev`, `build`, `preview`, `data`, `tokens`, `type-check`, `test`, `test:e2e`, `test:layout`, `dist:validate` (`scripts/validate-dist.js`), `size:check`, `cloudflare:check`. `wrangler.toml` and `wrangler.preview.toml` serve `./dist`; CI's job is `app`, its artifact `dist`, and `deploy` still needs only that job.

`public/` stays the committed source tree and is not Astro's publicDir: it also holds data that must not ship (53 combined year payloads, the 12 MB PASDA source artifact). `yarn data` stages what ships into the gitignored `build/public/`, as it did into `remaster/public/`. The app's `_headers` replaced the legacy root `public/_headers`, so data validation now checks the rules production actually serves. User-facing persisted keys are unchanged, including `historic-borders-welcome:2026-remaster`, so returning visitors do not see the welcome again. The production smoke script now reads the hashed PA index from the live page when there is no local build: the scheduled uptime check has no build and had failed on every run since the cutover.

Observed: the build has the same 6,590 deployable files as before; data, tiles, fonts and glyphs are byte-identical, and only eight JS chunk hashes change (the bundler drops a Node-mode interop flag on the React import now that the package is not `type: module`, which resolves to the same object).

Rollback: revert this commit.

### Borders flow between years (2026-11-18)

Observed: a year change swapped every border at once, so students had to compare two maps from memory to see what changed, which is the product's core job ("help me move through time and notice meaningful changes"). The owner approved an animated change as the default.

Decision: animate year changes on the year pages with a GPU distance-field "growth" transition (`src/atlas/transition/`): both years are rasterized into id textures with the map's camera, a jump flood gives each changing pixel its distance to the new owner's old land and to the region's far side, and a per-pixel switch time `d1 / (d1 + d2)` lets every region, a sliver or half a continent, finish in the same ~1 s. New territories swell from deep points of their own parts. Territories are compared by name only; no shape matching, no precomputed morphs, no new data files. The overlay is a MapLibre custom layer under relief, water and labels, reads its colours from the live style (both map styles), fades the vector lines and labels with paint transitions, and hands over to the new year's vector layers once they are drawn.

Alternatives rejected: a cross-fade (shows no direction of change), vector morphing (needs territory correspondences and topology the data does not have), and precomputed per-pair animations (53² pairs, data budget). A second canvas over the map was rejected because water, coasts and labels must stay above the borders.

Constraints kept: static-only and free-tier (no request-time compute or new requests: the polygon URL is immutable and shared with MapLibre through the HTTP cache), lazy code (24 KB module, 9.5 KB worker on the first animated change), and accessibility: skipped for reduced motion, low power, no WebGL 2, the first load and when Settings → Animate border changes is off (default on, persisted). About states that the animation shows where borders ended up, not the order of events, so it does not imply a historical sequence.

Measured (Chromium, Apple M4 GPU, 1024×700 at DPR 2): 1914→1920 and 1492→1600 in both styles ran at a 16.7 ms median frame, 0–7 frames over 20 ms per change (those coincide with MapLibre ingesting the new year's tiles under the overlay); one-time CPU prepare 2–4 ms. With 4× CPU throttling the overlay's own frames stayed at a 16.7 ms median, and the year change without animation showed as many long frames (14–16 over 20 ms, max 133–150 ms), so the long frames come from the year change itself. Not yet measured on an iPad or phone.

Rollback: Settings off per visitor; for everyone, revert the commit (or make `skipReason` always return a reason).

### Release through auto-merged pull requests (2026-11-18)

Observed: each merge re-ran the full suite on `main` before deploying (10–13 minutes, three browsers in one serial job), flaky browser tests blocked two deploys whose PRs had passed, and there was no branch protection or auto-merge.

Decision: tests run once, on the pull request, in parallel (`checks`, `app`, `e2e` per engine, aggregated as `browser tests`); `main` requires those three checks and the repository auto-merges and deletes merged branches. A merge to `main` builds, type-checks, deploys and smoke-tests without re-running the tests (about 4–5 minutes); a direct push that did not come through a PR runs every test first. Documentation-only PRs skip the build and browsers. The layout suites report on PRs only. Branches need not be up to date with `main` (no forced rebases for a solo owner); the type-check on `main` is the guard against semantic merge conflicts. See docs/RELEASE.md.

Rollback: revert `.github/workflows/ci.yml` and `layout.yml`; branch protection and auto-merge are repository settings.

## Deferred

### Domain cutover

The registrar is Squarespace Domains and authenticated DNS/Cloudflare-zone UI work is required before launch. The owner explicitly declined Vercel as a fallback; Cloudflare retains the verified M3 Worker version for application rollback, while Vercel remains disabled pending retirement after the seven-day review.
