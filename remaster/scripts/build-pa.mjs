// Pennsylvania school-district page data (P5, T8). Offline and deterministic:
// reads only committed, validated repository data.
//
//   public/tiles/pa/<build>/{z}/{x}/{y}.pbf          T8 street basemap (copied from data/pa-basemap/)
//   public/tiles/pa-districts/<hash>/{z}/{x}/{y}.pbf district polygons as vector tiles
//   public/data/pa/districts.<hash>.json            every district's properties, bounds, label point
//   src/data/pa.json                                URLs, coverage and provenance the page bundles
//
// District format (measured with `yarn data:measure:pa-districts`, see
// docs/PA_SCHOOL_DISTRICTS.md "Remaster data format"): a z11 tile tree at
// extent 8192 (a ~1.8 m grid at 41° N, full source vertices at z11) plus a
// small property index, instead of the 11.5 MB single GeoJSON artifact.
// Tiles are cached by input hash in node_modules/.cache, so a rebuild with
// unchanged data only copies files.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import geojsonvt from 'geojson-vt';
import { APP, REPO, hash16, readJson, writeFile } from './lib.mjs';
import {
  DISTRICT_TILES,
  bboxOf,
  coverageRuns,
  districtWashes,
} from './pa-lib.mjs';

const require = createRequire(import.meta.url);
const vtpbf = require(path.join(REPO, 'node_modules/vt-pbf'));

/** Bump when the district tiling below changes. */
const DISTRICT_RECIPE = 1;

/* ---- T8 street basemap ------------------------------------------------- */

const basemap = readJson(path.join(REPO, 'data/pa-basemap-manifest.json'));
const basemapOut = path.join(APP, 'public/tiles/pa');
fs.rmSync(basemapOut, { recursive: true, force: true });
fs.cpSync(
  path.join(REPO, basemap.tiles.path),
  path.join(basemapOut, basemap.buildId),
  { recursive: true },
);

/* ---- Districts ---------------------------------------------------------- */

const artifactPath = path.join(REPO, 'public/data/pa-school-districts.json');
const artifactBytes = fs.readFileSync(artifactPath);
const artifact = JSON.parse(artifactBytes);
const features = artifact.data.borders.features;
const labels = artifact.data.labels.features;
if (features.length !== artifact.validation.districtCount)
  throw new Error('pa: the artifact and its validation record disagree');

const hash = hash16(
  Buffer.concat([
    artifactBytes,
    Buffer.from(JSON.stringify({ DISTRICT_RECIPE, DISTRICT_TILES })),
  ]),
);
const washes = districtWashes(features);
const cacheDir = path.join(APP, 'node_modules/.cache/pa-districts', hash);
if (!fs.existsSync(path.join(cacheDir, '.complete'))) {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  const index = geojsonvt(
    {
      type: 'FeatureCollection',
      features: features.map((f, id) => ({
        type: 'Feature',
        id,
        properties: { c: washes[id] },
        geometry: f.geometry,
      })),
    },
    {
      maxZoom: DISTRICT_TILES.maxzoom,
      indexMaxZoom: DISTRICT_TILES.maxzoom,
      indexMaxPoints: 0,
      tolerance: DISTRICT_TILES.tolerance,
      extent: DISTRICT_TILES.extent,
      buffer: DISTRICT_TILES.buffer,
    },
  );
  const written = [];
  for (const { z, x, y } of index.tileCoords) {
    if (z < DISTRICT_TILES.minzoom) continue;
    const tile = index.getTile(z, x, y);
    if (!tile?.features.length) continue;
    writeFile(
      path.join(cacheDir, `${z}/${x}/${y}.pbf`),
      Buffer.from(
        vtpbf.fromGeojsonVt(
          { districts: tile },
          { version: 2, extent: DISTRICT_TILES.extent },
        ),
      ),
    );
    written.push({ z, x, y });
  }
  fs.writeFileSync(path.join(cacheDir, '.complete'), JSON.stringify(written));
}
const districtOut = path.join(APP, 'public/tiles/pa-districts');
fs.rmSync(districtOut, { recursive: true, force: true });
fs.cpSync(cacheDir, path.join(districtOut, hash), {
  recursive: true,
  filter: (source) => path.basename(source) !== '.complete',
});
const districtTiles = JSON.parse(
  fs.readFileSync(path.join(cacheDir, '.complete'), 'utf8'),
);

// Property index: what the finder, panel, labels and framing need.
const PROPS = [
  'NAME',
  'SCHOOL_NAM',
  'SCHOOL_DIS',
  'CTY_NAME',
  'IU_NAME',
  'IU_NUM',
  'AUN_NUM',
  'AVTS',
];
const districts = features.map((f, id) => ({
  id,
  ...Object.fromEntries(PROPS.map((p) => [p, f.properties[p]])),
  km2: Math.round(f.properties.AREA / 1e4) / 100,
  bbox: bboxOf(f.geometry),
  label: labels[id].geometry.coordinates.map((v) => Math.round(v * 1e5) / 1e5),
}));
const indexDoc = {
  schemaVersion: 2,
  source: artifact.source,
  validation: artifact.validation,
  districts,
};
const indexUrl = `/data/pa/districts.${hash}.json`;
const dataOut = path.join(APP, 'public/data/pa');
fs.rmSync(dataOut, { recursive: true, force: true });
writeFile(path.join(APP, 'public', indexUrl), JSON.stringify(indexDoc));

writeFile(
  path.join(APP, 'src/data/pa.json'),
  JSON.stringify({
    indexUrl,
    districtCount: artifact.validation.districtCount,
    vintage: artifact.source.vintage,
    metadataUrl: artifact.source.metadataUrl,
    districtTiles: {
      url: `/tiles/pa-districts/${hash}/{z}/{x}/{y}.pbf`,
      sourceLayer: 'districts',
      minzoom: DISTRICT_TILES.minzoom,
      maxzoom: DISTRICT_TILES.maxzoom,
      extent: DISTRICT_TILES.extent,
      coverage: coverageRuns(districtTiles),
    },
    basemap: {
      buildId: basemap.buildId,
      url: basemap.tiles.url,
      minzoom: basemap.tiles.minzoom,
      maxzoom: basemap.tiles.maxzoom,
      bounds: basemap.tiles.bounds,
      attribution: basemap.attribution,
      coverage: basemap.coverage,
    },
  }),
);
console.log(
  `pa: T8 basemap ${basemap.buildId} (${basemap.tiles.files} tiles), ${districtTiles.length} district tiles, index ${indexUrl}`,
);
