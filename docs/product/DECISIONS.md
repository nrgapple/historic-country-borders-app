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

## Deferred

### Domain cutover

The registrar is Squarespace Domains and authenticated DNS/Cloudflare-zone UI work is required before launch. The owner explicitly declined Vercel as a fallback; Cloudflare retains the verified M3 Worker version for application rollback, while Vercel remains disabled pending retirement after the seven-day review.
