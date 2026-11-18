# Historical border data

## Published source

Historical borders and places come from [`aourednik/historical-basemaps`](https://github.com/aourednik/historical-basemaps), currently pinned to commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`. The upstream repository identifies the work under [GNU GPL v3](https://github.com/aourednik/historical-basemaps/blob/62d8f1a03a71f2d3ff17f2d166f7553f256bce68/LICENSE) and says it collected and adapted basemaps from diverse sources, including archived material. The repository, directory, commit date, license link, provenance note, and complete route-year list are in `data/historical-manifest.json`.

These processed payloads are modified on 2026-09-02 by the validation, filtering, coloring, and label-point pipeline in `scripts/lib/historical-data.js`, and on 2026-11-18 by its coordinate-rounding step; corresponding source is available from the pinned upstream commit and this repository. The historical payloads remain separately available under GPL-3.0; a verbatim license copy ships at `/data/historical/LICENSE-GPL-3.0.txt`. The application's top-level license does not replace that data license.

These third-party maps are interpretive snapshots. Dates may be approximate; boundaries may be generalized, disputed, degenerate, or incomplete. They are appropriate for exploration, not as academic or legal authority. Consult the upstream project and its cited sources.

Validation currently records five named, structurally valid upstream borders with zero calculated area: Tuareg Nomadic Tribes (1200), Apache (1530 and 1600), Tunis (1650), and Syria (France) (1938). M3 retains them to preserve existing map content rather than making a subjective historical deletion; each affected asset records `zeroAreaBorders: 1`. A future source review may resolve or explicitly exclude them. Area and label placement are calculated from the unrounded source geometry, so rounding does not create or hide zero-area anomalies.

## Coordinate precision

The upstream borders are hand-drawn historical approximations with roughly kilometre-level accuracy, but the source files carry about 15 significant digits. Published payloads round every coordinate (border rings, label points, and places) to five decimal places, about 1.1 m at the equator:

1. each ring position is rounded and consecutive duplicate positions created by rounding are dropped;
2. rounding preserves first/last equality, so every published ring stays closed;
3. a ring that would fall below four positions is published with its original, unrounded coordinates for that ring only; the refresh logs per-year counts and `data/historical-assets.json` records the total as `roundingFallbackRings` (kept out of per-year entries because the browser bundles that manifest); at the pinned commit, 208 such rings exist across 28 years, all upstream slivers (sub-metre-wide or already degenerate) that would collapse to two or fewer distinct points after rounding; and
4. no feature, name, color, or source property (including `PARTOF`, `SUBJECTO`, and `BORDERPRECISION`) is removed, and no shape is simplified.

Offline validation rejects any published border ring that is not already in this rounded, duplicate-free form (fallback rings excepted), any unrounded label or place point, and a `roundingFallbackRings` total that does not match the payloads.

## Static pipeline

`yarn data:refresh:historical` is the only workflow that contacts GitHub. It:

1. requires a full pinned commit hash;
2. downloads `places.geojson` once and each enumerated `world_<year>.geojson` from that commit;
3. bounds each response at 25 MiB;
4. validates FeatureCollections, Polygon/MultiPolygon geometry, closed rings, coordinate ranges, names, Point places, and place date fields;
5. removes unnamed, `unclaimed`, and Antarctica records as the previous browser contract did;
6. calculates deterministic atlas colors and one largest-polygon label point per border;
7. filters dated places for each year and rounds published coordinates (see Coordinate precision);
8. checks that every reviewed place class matches exactly one dated upstream place (see Archaeological sites);
9. publishes `{ data: { borders, labels }, places }` payloads to content-hashed files under `public/data/historical/`;
10. writes source/output SHA-256 hashes, byte counts, feature/anomaly/fallback counts, and asset URLs to `data/historical-assets.json`; and
11. derives the split year files and `data/historical-split-assets.json` from those payloads (see Split year files), then removes every file in `public/data/historical/` that no manifest references.

`yarn data:validate:historical` is offline. It verifies the source pin, complete year set, immutable names, every committed byte/hash/count, geometry, names, and browser payload contract. It then **rebuilds every split file offline** from the committed payloads and place classes and requires byte-for-byte equality with the committed files and manifest, and fails on any unreferenced file in `public/data/historical/`. Normal `yarn build` only copies these committed files; it never contacts GitHub.

## Blank names

Observed at the pinned commit: six borders have a `NAME` that is empty or only spaces. They are real territories, not "unnamed" records (which upstream marks with a `null` NAME and the pipeline removes).

| Year    | Source NAME | Source ABBREVN         | What it is                                                | Published as                            |
| ------- | ----------- | ---------------------- | --------------------------------------------------------- | --------------------------------------- |
| 5000 BC | 6 spaces    | `Cardial Ware culture` | 597,040 km² culture area                                  | **Cardial Ware culture** (from ABBREVN) |
| 700     | 11 spaces   | 11 spaces              | 0.03 km² sliver, SUBJECTO Bega                            | unnamed                                 |
| 1815    | 7 spaces    | `Netherlands`          | 33,346 km², part of the United Kingdom of the Netherlands | **Netherlands** (from ABBREVN)          |
| 1994    | `""`        | none                   | the main Swiss polygon (40,661 km²)                       | unnamed                                 |
| 2000    | `""`        | none                   | the main Swiss polygon                                    | unnamed                                 |
| 2010    | `""`        | none                   | the main Swiss polygon                                    | unnamed                                 |

The rules:

1. **Combined payloads** (`<year>.<hash>.json`, used by production): a blank NAME is removed from the border and its label point, so no blank string is ever published. The border is kept, so the map has no hole; it is drawn but not labelled or selectable, as production already behaved. Other blank string properties (`ABBREVN`, `PARTOF`) are dropped like empty ones. Non-blank names are trimmed (nine years had `"Pomeranian culture "`, `"Zacateco "` or `"Kashtik "`), which also lets selection outlines match the trimmed `?place=` key; colors still hash the source spelling, so no published color changes.
2. **Split files**: a border without a NAME takes the source's **own `ABBREVN`** when that is non-blank, and its index entry records `"nameFrom": "ABBREVN"`. No name is invented. Without an ABBREVN the polygon is published with no `id`, no label, and no index entry; `counts.unnamedPolygons` records it.
3. **Validation** rejects a blank or untrimmed NAME, a border and label with different names, a blank place name, and a blank or untrimmed `NAME`, `n` or `p` in the split files.

The combined payloads stay without the ABBREVN fallback so the Wikidata context pipeline, which reads them, keeps its committed mapping. In 1994–2010 upstream names a 0 km² sliver "Switzerland" while the real Swiss polygon has an empty name; a reviewed name override, or an upstream fix, is the right correction and is not made here.

## Split year files

The remaster hands polygons and labels to MapLibre by URL, so its worker downloads and parses them (`docs/product/REMASTER_PLAN.md` §6). Each year therefore also publishes three content-hashed files in `public/data/historical/`, recorded in `data/historical-split-assets.json` (not bundled; it holds URLs, hashes, byte counts and counts per year). The combined payloads are unchanged in shape and remain production's files until the P4 cutover.

| File                          | Content                                                       | Who reads it                       |
| ----------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `<year>.polygons.<hash>.json` | Border polygons with `id` and wash/dependency properties only | MapLibre worker (`geojson` source) |
| `<year>.labels.<hash>.json`   | Territory label points and places                             | MapLibre worker (`geojson` source) |
| `<year>.index.<hash>.json`    | Territory facts, bbox and label point                         | Finder, panel, prerendered lists   |

`<year>` is `1492` or `bc500`, like the combined files. The `.json` extension (rather than `.geojson`) guarantees an `application/json` type, which Cloudflare compresses.

**Territory ids.** `id` is a dense integer per year, in order of first appearance. Every polygon that shares a NAME shares the id (a territory can span several features), so `feature-state` selects a whole territory. The same id is the array position in the index. Ids are per year: use NAME to keep a selection across years.

### Polygons

```json
{
  "type": "Feature",
  "id": 18,
  "properties": { "c": 5, "dep": 1, "ov": 34, "oc": 5 },
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [[[[13.0172, -4.76824], "…"]]]
  }
}
```

| Property | Meaning                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`     | Territory id (top-level feature id). Absent on an unnamed polygon (see Blank names).                                                                                                                                                 |
| `c`      | Atlas wash index, 0–11, for Direction A's 12 hand-tinted washes. It is the legacy color slot modulo 12, exactly as the approved mock assigns washes (`HB.colorMatch`).                                                               |
| `dep`    | `1` when the territory is a dependency: its `SUBJECTO`, or failing that its `PARTOF`, names a **different territory that exists in the same year**. Absent otherwise, including when the named overlord is not a feature that year.  |
| `ov`     | The overlord's territory id (present only with `dep`).                                                                                                                                                                               |
| `oc`     | The overlord's wash index (its largest feature's `c`), so the style can tint colonies and vassals as a lighter shade of the overlord, for example British colonies in 1914 as a light United Kingdom wash (present only with `dep`). |

Dependency facts use the territory's largest feature, so every polygon of a territory carries the same `dep`/`ov`/`oc`. Only the direct overlord is recorded; chains are not followed. Source names that match no feature are left alone: in 1914 the Russian Empire's SUBJECTO is "Russia" and four territories name "Italy", neither of which is a feature that year.

Polygons are **rewound to RFC 7946** (exterior rings counter-clockwise, holes clockwise, in lon/lat), so `line-offset` edge bands and selection bands draw inside borders. Rewinding only reverses ring order; no position moves, so rounding and fallback rings are as in the combined files. Zero-area rings have no orientation and are left as they are.

### Labels

```json
{ "type": "Feature", "id": 0, "properties": { "n": "Cyprus", "a": 9204 }, "geometry": { "type": "Point", "coordinates": [33.08659, 35.01417] } }
{ "type": "Feature", "properties": { "p": "Kaneš", "k": "site" }, "geometry": { "type": "Point", "coordinates": [35.63333, 38.84962] } }
```

- **Territory labels** (`has n`): one per named polygon, at the largest part's pole of inaccessibility, as in the combined files. `n` is the name, `a` the largest part's area in km² (rounded) for size hierarchy and sort keys, `id` the territory id for selected-label styling.
- **Places** (`has p`): `p` is the name and `k` is `"city"` or `"site"` (archaeological site, drawn with ∴). See Archaeological sites.

### Index

```json
{
  "schemaVersion": 1,
  "year": 1914,
  "territories": [
    {
      "id": 131,
      "NAME": "Russian Empire",
      "PARTOF": "Russian Empire",
      "SUBJECTO": "Russia",
      "BORDERPRECISION": 3,
      "bbox": [17.89, 35.25, -169.83, 77.6],
      "label": [66.85356, 52.45233]
    }
  ]
}
```

`NAME`, `PARTOF`, `SUBJECTO` and `BORDERPRECISION` keep the source field names and come from the territory's largest feature; blank values are omitted. `nameFrom: "ABBREVN"` marks a name taken from the source's ABBREVN. `dep`, `ov` and `oc` are as for polygons. `bbox` is `[west, south, east, north]` around every exterior ring, rounded outward to two decimals. A territory that straddles the antimeridian gets **west > east** (RFC 7946 §5.2) instead of a world-wide box. `label` is the territory label point.

### Sizes

Observed at the pinned commit (bytes; Brotli quality 5 approximates Cloudflare's on-the-fly compression, 11 is the ceiling):

| File                       | 1914 raw | 1914 Br-5 | 1914 Br-11 |  1492 raw | 1492 Br-5 | 1492 Br-11 |
| -------------------------- | -------: | --------: | ---------: | --------: | --------: | ---------: |
| Combined payload (before)  |  730,853 |   251,809 |    173,803 | 2,503,970 |   784,592 |    530,068 |
| Polygons                   |  686,393 |   241,924 |    166,459 | 2,142,125 |   714,427 |    474,708 |
| Labels                     |   25,405 |     4,898 |      4,003 |   185,051 |    38,827 |     30,994 |
| Index                      |   23,483 |     6,166 |      5,023 |   222,575 |    58,587 |     46,131 |
| Capitals (`data/context/`) |    8,447 |     1,711 |      1,473 |     1,933 |       485 |        433 |

All 159 split files total 31.1 MB raw and 10.5 MB Brotli-5. `yarn size:check` budgets them: 32 MiB in total; Brotli-5 largest polygons 800 KiB, labels 64 KiB, index 96 KiB; and at most five years of polygons above 300 KiB Brotli-5, the plan's trigger for reconsidering vector tiles (two years exceed it today).

Rebuild them offline with `yarn data:build:historical-split`, for example after editing place classes.

## Archaeological sites

Upstream places have no type, so prehistoric ritual sites and long-ruined towns were drawn as living cities. `data/historical-place-classes.json` is a committed, reviewed list, treated like the place end-date overrides. Each entry names one upstream place and gives its class, a source URL and a review note. An optional `from` year makes it a site only from that map year on. Without `from`, it is a site in every year it is published.

The split labels publish `k: "site"` for a classified place in a year when the class applies, and `k: "city"` otherwise. The combined payloads are unchanged.

At the pinned commit, 11 places are classified, all citing English Wikipedia:

- **Sites in every published year:** Göbekli Tepe, Çatal Höyük, Taljanky, Sannai-Maruyama Site, Ōyu site, Jätinkirkko and Cumbe Mayo.
- **Sites from a given year:** Chavín de Huántar from 500 BC, Kaneš from AD 500, and Lambaesa and Siga from 700.

Towns published only while they were inhabited (Ur, Harappa, Knossos) are not listed. Neither are cases that need more review (Bagan, Bolghar, Calusa, Levisa).

Rules:

- `yarn data:refresh:historical` requires every entry to match exactly one dated upstream place, after end-date overrides. A `from` must fall after `inhabitedSince` and no later than `inhabitedUntil`.
- Offline validation requires every entry to be published in some year, never twice in one year, and to be a site in at least one map year.
- The refresh records the file's hash, and `yarn data:validate` fails if the file changed without a refresh, as it does for overrides.

## Capital points

`public/data/context/<year>.capitals.<hash>.json` holds `{ name, t, qid }` points: the capital's English label, the territory id from that year's index, and its Wikidata item. Publication rules, the 50 km rule and the rejection list are in `docs/HISTORICAL_CONTEXT.md` ("Capital points"). They are built by the context pipeline, because they combine Wikidata facts with the split polygons.

## Refresh review

A maintainer intentionally changing the source must:

1. update the full commit and its date in `data/historical-manifest.json`;
2. review upstream provenance/license changes and the year list;
3. run `yarn data:refresh:historical` and `yarn data:validate:historical`;
4. inspect manifest count/size/hash/anomaly/fallback-ring changes (including `data/historical-split-assets.json` counts) and spot-check BC and AD maps;
5. retain source, vintage, and uncertainty notices; and
6. if names or territory ids changed, run `yarn data:refresh:context --offline` (and reconciliation if names changed) so the capital points use the new ids; and
7. commit the manifests and newly referenced immutable assets together.

Do not make historical refresh part of deployment builds. Old unreferenced hashed assets may be removed only after confirming that no active/rollback deployment references them.

## Reviewed place end dates

Upstream `places.geojson` leaves `inhabitedUntil` empty for many long-abandoned archaeological sites, so they appeared as living cities in later maps (for example Göbekli Tepe and Ur in 1492). `data/historical-place-overrides.json` lists a small, conservative set of well-established abandonment dates, each with a source URL. `yarn data:refresh:historical` applies them. Every override must match exactly one dated upstream place, so a renamed upstream record fails the refresh. `yarn data:validate` fails if the overrides file changed without a refresh. Uncertain cases stay as upstream publishes them; please report corrections upstream as well.
