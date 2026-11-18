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

## Site data format (P5)

The Astro app (production since 2026-11-18) draws the 500 districts from the committed artifact in a different shape. The Next.js page described above was removed with the legacy app.

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

**Build.** `scripts/build-pa.mjs` runs in `yarn build`. It is offline and deterministic, reads only the committed, validated artifact, and caches its output in `node_modules/.cache/pa-districts` by input hash. It writes:

- `build/public/tiles/pa-districts/<hash>/{z}/{x}/{y}.pbf`: source-layer `districts`. The feature id is the district's index, and `c` is a wash index (0–11), chosen so that districts sharing a boundary vertex never share a wash. `f`, `p` and `e` are the PIAA football class rank, PIAA district and grade 9–11 enrollment from `data/pa-sports.json` ("High-school sports" below).
- `build/public/data/pa/districts.<hash>.json`: schema 2. It holds the same `source` and `validation` records as the artifact, a `sportsSource` record and `piaaLabels`, plus one entry per district with `id`, the PASDA properties, `km2`, `bbox`, an interior `label` point and its PIAA `sports` record (or `null`).
- `src/data/pa.json`: the URLs, tile coverage and vintage the page bundles.

**Provenance in the panel.** Selecting a district, on the map or with the finder, shows:

- the county, intermediate unit, career and technical school, and AUN, with official acronyms kept (IU, CTC, AVTS, BLaST, ARIN, PA);
- the PASDA vintage and source link;
- the enrollment caveat;
- correction guidance that points to PennDOT through PASDA.

Feedback repeats the correction guidance and adds that street and place names are corrected in OpenStreetMap. About credits PennDOT/PASDA and OpenStreetMap (ODbL).

## High-school sports (PIAA)

The panel shows each district's PIAA high schools with their football class, the district's PIAA district and its grade 9–11 enrollment. Settings → "Colour districts by" recolours the map by football class, PIAA district or enrollment. The choice is stored with the other settings and shared as `?colour=football|piaa|enrollment`. The finder also matches "6A" or "District III": choosing the group frames its districts and switches the colouring to match.

### Sources

**Observed:** PIAA publishes these facts on public pages; there is no download or API.

| Fact                                                                                   | Page                                                                                                             | Used                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Football class (1A–6A)                                                                 | `piaa.org/schools/classifications/sportDistrict.aspx?sportID=10&district=1…12`                                   | School list per PIAA district; season "26/27" |
| School list without football                                                           | the same page for boys' and girls' basketball, baseball, softball, cross country and boys' track (`LIST_SPORTS`) | finds high schools that have no football team |
| PIAA district, school district, school type, enrollment, football class and co-op flag | `piaa.org/schools/directory/details.aspx?ID=<school>`                                                            | one page per listed school                    |

- **Season.** The 2026-27 and 2027-28 classification cycle. PIAA set it from enrollment that member schools reported on 1 October 2025 (pages say "October 2025 (26/27 classification season)").
- **Enrollment.** PIAA's classification count: students in grades 9–11, with the boys' count used for football. The district value is the sum over its public high schools. It is a sports-size measure, not K–12 district enrollment.
- **Terms.** PIAA's pages say "Copyright © PIAA. All Rights Reserved." The site publishes no terms of use, and its privacy statement places no limit on automated access. `robots.txt` disallows `/assets/` (where PIAA's PDFs live), not `/schools/`. **Recommendation:** treat the classes, PIAA districts and enrollments as facts, store only those facts with attribution and a link to PIAA, and never store the directory pages' contacts, names of staff, emails, phones or addresses. The refresh follows that rule.
- **Not used.** The PA Department of Education's K–12 enrollment reports are keyed by the district's AUN, but they do not decide sports classes; PIAA's grade 9–11 figures are the ones that place a school in 1A–6A. They are a possible later addition.

### Refresh and review

```bash
yarn data:refresh:pa-sports         # fetch PIAA (about 860 pages, ~25 minutes)
yarn data:refresh:pa-sports --join  # re-join the committed extract only
yarn data:validate                  # includes data:validate:pa-sports
```

The refresh is explicit and never part of a build. It fetches one page at a time, pauses 0.7 s between pages, and sends the User-Agent `HistoricBordersDataRefresh/1.0 (+https://historicborders.app/pa/school-districts)`. It writes:

- `data/pa-sports-schools.json`: the extract. It has one record per listed PIAA school, with its id, name, PIAA district, school district, type, enrollment, football class and co-op flag, plus the source record (publisher, URLs, season, enrollment date, retrieval time, terms note). The extract is written before the join, so a join that fails its floors keeps the crawl.
- `data/pa-sports.json`: the join, keyed by the PASDA district `NAME` (unique, and the page's `?place=` value). Each district has `piaa`, `football` (its largest class), `footballSchools`, `enrollment`, `boys` and `schools[]`. A `coverage` block lists every unmatched and excluded school.
- `data/pa-sports-overrides.json`: reviewed matches. It maps a PIAA school-district name to its PASDA district `NAME`, or to `null` to exclude the name deliberately (the county career-technical schools).

**Why not the AUN.** _Observed:_ PASDA's `AUN_NUM` has only 74 distinct values across the 500 districts, 15 of them `NULL`, and each value goes with exactly one `AVTS`. For example, all 16 districts of the Lancaster County CTC share 113363807. It is the AUN of the district's career-technical school, not the district's own AUN, so the join cannot use it. The panel's "Administrative unit number (AUN)" row shows that field as published; correcting its label is a separate change.

**Matching.** Only public schools (`School Type` starting "Public") join a district. Private and charter schools appear on the PIAA pages but have no PASDA district, so they are skipped. A PIAA "School District" name matches in this order:

1. a reviewed override;
2. an exact normalized name ("Mt. Lebanon" = "Mt Lebanon SD");
3. a loose key without words such as Area, City, Township or Joint, used only when exactly one PASDA district has that key.

Everything else is reported as unmatched, never guessed.

`yarn data:validate` re-derives `data/pa-sports.json` from the extract, the overrides and the PASDA artifact, and fails on any difference. It also checks the schema: classes 1A–6A, PIAA districts 1–12, non-negative enrollment and district names that exist in PASDA. Coverage floors (480 districts with a PIAA district and 440 with a football class) reject a refresh that silently lost matches. Review the extract diff for class changes before committing a refresh.

### How the cases are shown

- **One high school:** the panel shows its class, for example "6A · Carlisle High School".
- **Several high schools** (Philadelphia, Pittsburgh, Allentown, Reading and others): every school is listed with its class and enrollment. The colouring and the fact use the largest class ("Up to 5A"), and the map label says "Up to 5A · 4 schools".
- **Co-op football:** PIAA flags a cooperative sponsorship per school. The school is listed as, for example, "4A co-op", and the class is the co-op team's.
- **No football:** the school is listed as "No football". A district with no PIAA football team is hatched on the football map ("No PIAA football"). Its students may play for a neighbouring school's co-op team; PIAA's pages name the co-op host only on the host's side.
- **No PIAA high school** (a district that sends its students elsewhere): "PIAA high school: None listed".
- **Classes are not purely size.** A school may play up by choice, or be moved up under PIAA's competition (success) formula. Private schools in particular can play above their enrollment. The panel says so and links to PIAA.

### Gaps

- **Conferences and leagues** (WPIAL sections, Mid-Penn, Lancaster-Lebanon and so on) are not shown. They are set by each PIAA district and league, with no authoritative statewide source found. The map shows PIAA districts, which run the district playoffs, and classes, which set the brackets.
- **Co-op partners.** A partner school without its own football row is shown as "No football" even when its students play on a neighbouring co-op team.
- **Charter, private and county career-technical schools** belong to no PASDA district and are not shown. The two career-technical schools that PIAA files under a public school district ("Vo-Tech", "Vocational Technical School") are excluded by override.
- **Districts without a high school:** Bryn Athyn, Duquesne City, Midland Borough, Saint Clair Area and Wilkinsburg Borough send their students to other districts' high schools. They show "None listed" and the "Unknown" colour.
- **Mid-cycle changes** (appeals, new co-ops) appear only after the next refresh.

### Colours

`src/pa/colourBy.ts` holds every palette in `PA_COLOUR_PALETTES`, the breaks and the MapLibre expressions:

- **Football class:** six steps from pale yellow (1A) to blue (6A), and a hatched neutral for no football.
- **PIAA district:** twelve categorical hues, with Roman-numeral region labels below z9.
- **Enrollment:** six lilac-to-violet steps at 225 / 350 / 500 / 750 / 1,100 students in grades 9–11 (the 2026–27 sextiles, rounded).

District names sit on every fill, so `tokens.test.ts` checks ink on each fill at full opacity for WCAG AA. The map draws data fills at 0.8 opacity, which only lightens them. On a data colouring the selected district keeps its colour, with the madder outline marking it, and its name stays in ink.
