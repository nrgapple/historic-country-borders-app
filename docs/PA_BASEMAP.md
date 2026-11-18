# Pennsylvania street basemap (T8)

The remastered `/pa/school-districts` page draws streets, water and town names under the district boundaries from a first-party basemap: static z/x/y vector tiles cut from one pinned [Protomaps](https://protomaps.com) daily build of OpenStreetMap, slimmed, and served from our own origin. There is no tile server, no token, no Mapbox and no third-party request. See `docs/product/REMASTER_PLAN.md` §5 (option B, step 1) and §9.2 P5, and the "PA street basemap" decision in `docs/product/DECISIONS.md`.

The historical maps keep T2's Natural Earth basemap (`docs/BASEMAP.md`); this basemap is used only by the PA page.

## Source, license and attribution

| Input                                                                                    | Pin                                                                                                                                 | Used for                                       |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Protomaps daily build `20260811.pmtiles` (Protomaps Basemaps 4.15.1, OpenStreetMap data) | `data/pa-basemap-sources.json`: URL, byte size (137,295,889,397) and etag; the build listing's BLAKE3 sum is recorded for reference | Water, streets, places, state and county lines |

- **License.** OpenStreetMap data is available under the [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright). The tiles we publish are a Produced Work from a Derivative Database (the slimmed extract), so the ODbL credit must be shown wherever the map is shown.
- **Attribution shown.**
  - The map's attribution control (kept expanded on tablets and desktops; on phones it is MapLibre's compact control, opened on load): `Protomaps © OpenStreetMap` with links, from the manifest's `attribution`.
  - The credit strip under the map: "Streets and places: © OpenStreetMap contributors (ODbL), Protomaps".
  - About: "Streets, water and place names: © OpenStreetMap contributors, available under the Open Database License (ODbL), in Protomaps tiles."
- **Pin choice.** Protomaps keeps recent daily builds and thins older ones. `20260811` had already been kept for three months when it was pinned, so a rerun is likely to find it. If it disappears, pick a newer build from `https://build-metadata.protomaps.dev/builds.json`, update the pin, rerun the refresh and review the diff.

## Toolchain: pure Node (chosen)

- **Observed.** This Mac has no working Docker context, no tippecanoe and no Go `pmtiles` binary. Java 26 is present, but Planetiler would need the 300 MB Geofabrik extract plus a JVM in CI.
- **Chosen.** Everything runs in Node 22 with pinned npm packages that the lockfile already has, plus one addition:
  - `pmtiles@4.5.0` (BSD-3-Clause) parses the archive header and directories over HTTP Range requests;
  - tile bytes are located per tile, sorted by archive offset and fetched in **coalesced Range requests** (gaps ≤ 64 KiB, ranges ≤ 8 MiB), as `pmtiles extract` does. Filling the cache for every measured candidate took 52,901 tiles in 317 requests (285 MiB), about two minutes on this Mac;
  - `@mapbox/vector-tile` and `pbf` decode, and `vt-pbf` re-encodes, as in T2's build.
- The same commands run on macOS and Linux CI. Nothing needs Docker.

## Commands

```bash
yarn data:refresh:pa-basemap   # network: fetch missing tiles (cached), rebuild the tree and manifest
yarn data:measure:pa-basemap   # build every candidate in memory, print the table below
yarn data:validate:pa-basemap  # offline; also part of yarn data:validate
```

- The cache is `PA_BASEMAP_CACHE_DIR` (default `.cache/pa-basemap/<build date>/`, gitignored): decompressed MVTs, and an empty `.none` marker for tiles the archive does not have.
- The refresh aborts if the archive's etag differs from the pin, or if any Range response is short or changes etag mid-run.
- It writes the new tree to `<tree>.tmp` and swaps it in only when complete, then removes older recipe builds.
- `yarn remaster:build`, tests and validation never touch the network. `yarn remaster:build` copies the committed tree into `remaster/dist/tiles/pa/<build>/`.

## Max zoom: z12 with z14 streets, by measurement

Protomaps names residential streets only from z14. At z12 and z13 its tiles carry the main roads and a handful of unnamed minor roads, so a native z13 tree would show no street a family could find their home on. The recipe therefore folds z14's roads into the max-zoom parent: each child's lines are clipped to the child's own square (no buffer duplicates), translated into the parent, joined across child edges, simplified and quantized.

`yarn data:measure:pa-basemap`, 2026-11-18, with the coverage below, extent 4096:

| Candidate                                            |     Files |        Bytes |     Brotli-5 |     Largest |   p95 tile | Residential street names |
| ---------------------------------------------------- | --------: | -----------: | -----------: | ----------: | ---------: | ------------------------ |
| z0–13 native                                         |    13,109 |     49.5 MiB |     41.1 MiB |     109 KiB |     12 KiB | no                       |
| z0–13, z13 streets from z14                          |    13,109 |     60.3 MiB |     45.7 MiB |     109 KiB |     16 KiB | yes                      |
| z0–12, z12 streets from z14                          |     3,864 |     40.2 MiB |     27.0 MiB |     109 KiB |     36 KiB | yes                      |
| **z0–12, z12 streets from z14, trimmed (published)** | **3,864** | **36.8 MiB** | **24.2 MiB** | **107 KiB** | **32 KiB** | **yes**                  |
| z0–14 native                                         |    48,830 |            – |            – |           – |          – | yes                      |

**Decision: z0–12 with z14 streets, trimmed.**

- **Files.** 3,864 instead of 13,109. With T2's 1,368 files, the district tiles and everything else, the remaster deploys 6,570 files against the 16,000 gate (`yarn size:check`). Any z13 tree would have used most of the remaining headroom; native z14 alone exceeds Cloudflare's 20,000-file limit.
- **Detail.** A z12 tile at extent 4096 is a 1.9 m grid at 41° N, and the street geometry is z14's, simplified to 2 grid units. MapLibre overzooms z12 to the page's max zoom 15, where one grid unit is one pixel.
- **Bytes.** The published tree is smaller than any z13 option. Streets are most of it: z12 is 24.3 MiB, and 15.9 MiB of that is residential streets. "Trimmed" means water polygons under 1,024 tile units² (ponds a few pixels across) are dropped ring by ring, and streets are simplified at 2 units instead of 1.
- **The plan's estimate** (§5: "about 10k files at z13") was the state only. The tree also needs z0–12 around it, and a bounding box rather than the state outline at z13 would be 17,658 files.

## Coverage

From `data/pa-basemap-sources.json`:

| Zooms | Area                                                                                                            | Tiles |
| ----- | --------------------------------------------------------------------------------------------------------------- | ----: |
| 0–8   | the map's `maxBounds`, 86.5° W–68.8° W, 34° N–47.5° N (so the state fits on a 320 px phone at the minimum zoom) |   279 |
| 9–10  | Pennsylvania plus about 50 km: 81.2° W–74.1° W, 39.2° N–42.8° N                                                 |   382 |
| 11–12 | tiles that touch the union of the 500 PASDA district polygons, grown by one tile                                | 3,203 |

The state outline comes from the committed district artifact, so it needs no extra source. Edges are densified to a quarter tile, so the straight 42° N border is covered, and interiors are filled by scanline.

**The page never requests a missing tile.** The manifest's `coverage` lists per zoom the rows of covered `[x0, x1]` runs (about 3 KB), and the page bundles it. The map loads tiles through a `pa-tiles://` protocol (`remaster/src/pa/paMap.ts`):

- a covered tile is fetched from `/tiles/pa/<build>/{z}/{x}/{y}.pbf`;
- an uncovered one is rejected without a request.

MapLibre then draws the nearest loaded parent, overzoomed. So at z11+ the land beyond the state still shows z10's water and main roads, and the network panel shows no 404s. The e2e journey "the street basemap credits OpenStreetMap (ODbL) and every map file is first-party" asserts both.

## Layer contract

One vector source, `pa-basemap`, z0–12, extent 4096, Mapbox Vector Tile v2, four `source-layer`s. Every other Protomaps layer (buildings, POIs, land use, land cover, earth, transit) is dropped: the atlas paints land as its paper.

| `source-layer` | Geometry                   | Attributes                                                                                           | Kept                                                                |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `water`        | Polygon, LineString, Point | `kind`; `name` on lines and points only                                                              | all but swimming pools; polygons ≥ 1,024 units²                     |
| `roads`        | LineString                 | `kind` (`highway`, `major_road`, `minor_road`), `kind_detail`, `name`, `ref` (not on minor roads)    | no paths, rail, aeroways, ferries, `service`, `alley` or `driveway` |
| `places`       | Point                      | `kind` (`locality`, `neighbourhood`, `region`), `kind_detail`, `name`, `min_zoom`, `population_rank` | named only                                                          |
| `boundaries`   | LineString                 | `kind` (`region`, `county`)                                                                          | state and county lines only                                         |

- **Names** are OSM's `name`, or `name:en` when `name` uses a script outside the glyph ranges T3 publishes (`data/map-fonts.json`), or dropped. The validator fails any name that would request a glyph PBF that does not exist. One case today: "Москва", replaced by its English name.
- The validator also fails a build with any other layer, attribute or geometry type, a tile outside the coverage index, a covered tile that is missing, or a digest, byte or file count that disagrees with the manifest.

## Style

The page's style module is `remaster/src/pa/paStyle.ts`. It uses Direction A's tokens (`remaster/src/styles/tokens.ts`) and T3's fontstacks.

- **Order.** Paper (land) → district washes → water → streets → county and state lines → district edge bands, borders and selection → street, water and place names → district names. The district names are drawn last, so they claim space first.
- **Streets in ink.**
  - Residential streets are a sepia hairline from z11.
  - Main roads are cased in ink-2 with a sheet-white fill.
  - Highways are in gamboge, the old road-atlas yellow, with route numbers. Madder stays reserved for the selection.
- **Names.**
  - Settlements are set in roman type: cities in spaced capitals, towns from z9, villages and hamlets from z10, neighbourhoods in italic from z12.5. District names are in Alegreya SC, so the two never read alike.
  - Street names appear on main roads from z11, and on residential streets from z13.5.
  - Water names are in Alegreya Italic, in water ink.
- **Projector text** swaps every label to Atkinson Hyperlegible Next. No label is set below 13 px.

## Budgets

These are enforced by `yarn data:validate:pa-basemap` (`BUDGETS` in `scripts/lib/pa-basemap.js`) and by `yarn size:check`:

| Budget                    |   Limit |                   Current |
| ------------------------- | ------: | ------------------------: |
| PA tiles                  |   4,500 |                     3,864 |
| PA tile bytes             |  48 MiB |                  36.8 MiB |
| Largest PA tile           | 256 KiB |                   107 KiB |
| Any deployable file       |  25 MiB | 2.0 MiB (`1492.polygons`) |
| Remaster deployable files |  16,000 |                     6,570 |

## Upgrading

1. Pick a newer build from the listing.
2. Update `archive` in `data/pa-basemap-sources.json`: url, buildDate, basemapsVersion, bytes, etag and b3sum.
3. Run `yarn data:refresh:pa-basemap`. A new build id `pm-<date>-r<recipe>` replaces the old directory.
4. Review the manifest diff (files, bytes, per-zoom counts, layer counts) and spot-check `yarn remaster:build` + `node remaster/scripts/shoot.mjs` (`ONLY=pa`).
5. Commit the tree and manifest together.

Changing the recipe (layers, attributes, tolerance, coverage) means bumping `RECIPE` in `scripts/lib/pa-basemap.js`.
