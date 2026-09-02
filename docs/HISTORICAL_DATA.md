# Historical border data

## Published source

Historical borders and places come from [`aourednik/historical-basemaps`](https://github.com/aourednik/historical-basemaps), currently pinned to commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`. The upstream repository identifies the work under [GNU GPL v3](https://github.com/aourednik/historical-basemaps/blob/62d8f1a03a71f2d3ff17f2d166f7553f256bce68/LICENSE) and says it collected and adapted basemaps from diverse sources, including archived material. The repository, directory, commit date, license link, provenance note, and complete route-year list are in `data/historical-manifest.json`.

These processed payloads are modified on 2026-09-02 by the validation, filtering, coloring, and label-point pipeline in `scripts/lib/historical-data.js`; corresponding source is available from the pinned upstream commit and this repository. The historical payloads remain separately available under GPL-3.0; a verbatim license copy ships at `/data/historical/LICENSE-GPL-3.0.txt`. The application's top-level license does not replace that data license.

These third-party maps are interpretive snapshots. Dates may be approximate; boundaries may be generalized, disputed, degenerate, or incomplete. They are appropriate for exploration, not as academic or legal authority. Consult the upstream project and its cited sources.

Validation currently records five named, structurally valid upstream borders with zero calculated area: Tuareg Nomadic Tribes (1200), Apache (1530 and 1600), Tunis (1650), and Syria (France) (1938). M3 retains them to preserve existing map content rather than making a subjective historical deletion; each affected asset records `zeroAreaBorders: 1`. A future source review may resolve or explicitly exclude them.

## Static pipeline

`yarn data:refresh:historical` is the only workflow that contacts GitHub. It:

1. requires a full pinned commit hash;
2. downloads `places.geojson` once and each enumerated `world_<year>.geojson` from that commit;
3. bounds each response at 25 MiB;
4. validates FeatureCollections, Polygon/MultiPolygon geometry, closed rings, coordinate ranges, names, Point places, and place date fields;
5. removes unnamed, `unclaimed`, and Antarctica records as the previous browser contract did;
6. calculates deterministic atlas colors and one largest-polygon label point per border;
7. filters dated places for each year;
8. publishes `{ data: { borders, labels }, places }` payloads to content-hashed files under `public/data/historical/`; and
9. writes source/output SHA-256 hashes, byte counts, feature counts, and asset URLs to `data/historical-assets.json` last.

`yarn data:validate:historical` is offline. It verifies the source pin, complete year set, immutable names, every committed byte/hash/count, geometry, and browser payload contract. Normal `yarn build` only copies these committed files; it never contacts GitHub.

## Refresh review

A maintainer intentionally changing the source must:

1. update the full commit and its date in `data/historical-manifest.json`;
2. review upstream provenance/license changes and the year list;
3. run `yarn data:refresh:historical` and `yarn data:validate:historical`;
4. inspect manifest count/size/hash/anomaly changes and spot-check BC and AD maps;
5. retain source, vintage, and uncertainty notices; and
6. commit the manifest and newly referenced immutable assets together.

Do not make historical refresh part of deployment builds. Old unreferenced hashed assets may be removed only after confirming that no active/rollback deployment references them.
