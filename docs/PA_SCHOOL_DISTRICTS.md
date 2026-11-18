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
