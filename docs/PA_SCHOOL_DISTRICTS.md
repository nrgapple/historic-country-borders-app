# Pennsylvania School Districts

## User experience

The `/pa/school-districts` page displays Pennsylvania's 500 school districts as an interactive map. Selecting a district shows its source properties, including county, intermediate unit, AUN, and career/technical school when available. The page identifies the source vintage and links to PASDA metadata.

The map reports loading, unavailable, empty, and stale-source states. A source is flagged for verification when its published vintage is at least 18 months old. This notice does not imply that a boundary is wrong; users should consult the linked source for current or legal use.

## Static data architecture

The browser loads the normalized static artifact at:

```text
/data/pa-school-districts.json
```

Ordinary page loads do not contact PASDA and do not invoke an application API route. Browser and CDN HTTP caching provide cold- and returning-user behavior; no IndexedDB application cache is used.

The artifact contains:

- a source/provenance record;
- one validated border feature per district;
- one interior label point per district;
- calculated geodesic area and normalized display properties; and
- the observed district count and Polygon/MultiPolygon mix.

## Pinned source and provenance

- **Dataset:** Pa School Districts
- **Publisher:** Pennsylvania Department of Transportation, Bureau of Planning and Research, Cartographic Information Division
- **Distributor:** Pennsylvania Spatial Data Access (PASDA)
- **Published vintage:** October 2025
- **Source:** <https://www.pasda.psu.edu/json/PaSchoolDistricts2025_10.geojson>
- **Metadata:** <https://www.pasda.psu.edu/uci/FullMetadataDisplay.aspx?file=PaSchoolDistricts2025_10.xml>
- **Expected count:** 500
- **Observed geometry:** 460 Polygon; 40 MultiPolygon
- **Source size:** 21,161,924 bytes
- **SHA-256:** `d17163e4f6edd6d27266bad2d850ab063461e90610733056db8efa430ac3c993`
- **Access/license note:** PASDA metadata states `Access_Constraints: None` and `Fees: none`, but does not name a standard license. It includes an as-is/no-warranty distribution liability statement. Follow the full metadata rather than inferring a broader license.

The machine-readable record is `data/pa-school-districts-source.json`. The pinned representative fixture at `tests/fixtures/pa-school-districts-source.fixture.geojson` covers both geometry types and required properties. `data/pa-school-districts-validation.json` records checksums and measured output.

## Controlled refresh

Refresh is explicit and separate from deployment builds:

```bash
yarn data:refresh
```

The command downloads the bounded PASDA source, rejects invalid JSON, validates all required properties and geometry, requires exactly 500 unique districts, calculates areas and interior label points, then atomically writes the artifact, provenance, and validation report. Network or validation failure leaves committed data unchanged. Review all generated diffs, especially vintage, checksum, count, geometry mix, terms, and district properties, before committing an upstream change.

Validate committed data without network access:

```bash
yarn data:validate
```

Normal `yarn build` never runs the refresh command and does not contact PASDA.

## Required source properties

- `SCHOOL_NAM`
- `SCHOOL_DIS`
- `CTY_NAME`
- `IU_NAME`
- `IU_NUM`
- `AUN_NUM`
- `AVTS`

Every property must be a non-empty string. Polygon rings must be closed, contain valid longitude/latitude positions, and have measurable area. Unsupported or malformed records fail the refresh rather than being silently omitted.

## Validation coverage

Unit/integration tests cover fixture normalization, Polygon/MultiPolygon labels, area calculation, empty and malformed input, unavailable upstream/static data, stale vintage classification, cache-deduplicated consumers, and fixture detail selection. Playwright covers cold and returning school-map journeys in Chromium, Firefox, and WebKit with deterministic request interception.

## Remaster data format (P5)

The Astro remaster (`remaster/`, not deployed until the cutover) draws the same 500 districts from the same committed artifact, in a different shape. Production's Next.js page above is unchanged.

**Measured** with `yarn data:measure:pa-districts` (2026-11-18). JSON.parse is timed in Node on the development Mac, best of 3. "State view" is the Brotli-5 bytes of the tiles that cover Pennsylvania at the zoom that frames it: about z7 on a 1440 × 900 desktop and about z5 on a 390 px phone.

| Format                                        |   Files |          Raw |                             Compressed |      First view |                                                                  Parse |
| --------------------------------------------- | ------: | -----------: | -------------------------------------: | --------------: | ---------------------------------------------------------------------: |
| Single artifact `pa-school-districts.json`    |       1 |    11.47 MiB | 1.71 MiB Brotli-11 (3.22 MiB Brotli-5) |  the whole file | 560–660 ms `JSON.parse`, then geojson-vt indexing in MapLibre's worker |
| Tile tree z0–10, extent 4096 (7.2 m grid)     |     245 |     1.50 MiB |                               0.82 MiB |     45 / 23 KiB |                                                               per tile |
| Tile tree z0–11, extent 4096 (3.6 m grid)     |     843 |     1.74 MiB |                               1.16 MiB |     45 / 23 KiB |                                                               per tile |
| Tile tree z0–12, extent 4096 (1.8 m grid)     |   3,102 |     2.21 MiB |                               1.72 MiB |     45 / 23 KiB |                                                               per tile |
| **Tile tree z0–11, extent 8192 (1.8 m grid)** | **843** | **1.94 MiB** |                           **1.45 MiB** | **63 / 31 KiB** |                                                           **per tile** |

The finder, the panel and the labels need every district's properties, bounds and label point whichever format is used. That property index is 138 KiB raw and 23 KiB Brotli-5.

**Decision: the z11 tile tree at extent 8192, plus the property index.**

- **First view.** A visitor downloads 63 KiB (desktop) or 31 KiB (phone) of district tiles plus the 23 KiB index to see the state, instead of 1.7 MB.
- **Main thread.** The browser no longer parses 11.5 MB of JSON on it.
- **Precision.** The grid matches z12's 1.8 m at a quarter of z12's files. geojson-vt keeps every source vertex at the top zoom, and 7.2 m or 3.6 m grids would move a boundary that follows a street by a visible amount at street zoom.
- **Files.** 838 tiles (z4–11; z4 so a 320 px phone at the minimum zoom still shows districts) fit easily under the 16,000-file gate next to T8's street basemap.

**Build.** `remaster/scripts/build-pa.mjs` runs in `yarn remaster:build`. It is offline and deterministic, reads only the committed, validated artifact, and caches its output in `remaster/node_modules/.cache` by input hash. It writes:

- `remaster/public/tiles/pa-districts/<hash>/{z}/{x}/{y}.pbf`: source-layer `districts`. The feature id is the district's index, and `c` is a wash index (0–11), chosen so that districts sharing a boundary vertex never share a wash.
- `remaster/public/data/pa/districts.<hash>.json`: schema 2. It holds the same `source` and `validation` records as the artifact, plus one entry per district with `id`, the PASDA properties, `km2`, `bbox` and an interior `label` point.
- `remaster/src/data/pa.json`: the URLs, tile coverage and vintage the page bundles.

**Provenance in the remaster panel.** Selecting a district, on the map or with the finder, shows:

- the county, intermediate unit, career and technical school, and AUN, with official acronyms kept (IU, CTC, AVTS, BLaST, ARIN, PA);
- the PASDA vintage and source link;
- the enrollment caveat;
- correction guidance that points to PennDOT through PASDA.

Feedback repeats the correction guidance and adds that street and place names are corrected in OpenStreetMap. About credits PennDOT/PASDA and OpenStreetMap (ODbL).
