// Measures the two ways to ship Pennsylvania's district polygons to the
// remaster (REMASTER_PLAN §9.2 P5): the current single static artifact
// against a district vector-tile tree. Offline; prints the table recorded in
// docs/PA_SCHOOL_DISTRICTS.md ("Remaster data format").
//
//   yarn data:measure:pa-districts
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import geojsonvt from 'geojson-vt';

const require = createRequire(import.meta.url);
const vtpbf = require('vt-pbf');
const { bboxTiles, parseKey } = require('./lib/pa-basemap.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'public/data/pa-school-districts.json');
const raw = fs.readFileSync(file);
const brotli = (buf, quality) =>
  zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: quality },
  }).length;
const time = (fn, runs = 3) => {
  let best = Infinity;
  let value;
  for (let i = 0; i < runs; i += 1) {
    const t = performance.now();
    value = fn();
    best = Math.min(best, performance.now() - t);
  }
  return { ms: best, value };
};

const parsed = time(() => JSON.parse(raw));
const artifact = parsed.value;
const features = artifact.data.borders.features;

// Tile tree: geometry only, with the feature index as the id (promoteId).
const tileable = {
  type: 'FeatureCollection',
  features: features.map((f, id) => ({
    type: 'Feature',
    id,
    properties: { id },
    geometry: f.geometry,
  })),
};
const PA = [-80.6, 39.7, -74.7, 42.3];
const results = [];
for (const [maxZoom, extent] of [
  [10, 4096],
  [11, 4096],
  [12, 4096],
  [11, 8192],
]) {
  const index = geojsonvt(tileable, {
    maxZoom,
    indexMaxZoom: maxZoom,
    indexMaxPoints: 0,
    tolerance: 3,
    extent,
    buffer: 64,
  });
  const tiles = new Map();
  for (let z = 0; z <= maxZoom; z += 1)
    for (const k of bboxTiles(PA, z)) {
      const { x, y } = parseKey(k);
      const tile = index.getTile(z, x, y);
      if (tile && tile.features.length)
        tiles.set(
          k,
          Buffer.from(
            vtpbf.fromGeojsonVt({ districts: tile }, { version: 2, extent }),
          ),
        );
    }
  let total = 0;
  let br = 0;
  let largest = 0;
  for (const buf of tiles.values()) {
    total += buf.length;
    br += brotli(buf, 5);
    largest = Math.max(largest, buf.length);
  }
  // First paint of the whole state: the 1440 x 900 desktop frames PA at
  // about zoom 7 (512 px tiles), a 390 px phone at about 5.5.
  const view = (z) =>
    bboxTiles(PA, z).reduce((sum, k) => {
      const buf = tiles.get(k);
      return sum + (buf ? brotli(buf, 5) : 0);
    }, 0);
  results.push({
    maxZoom,
    extent,
    files: tiles.size,
    raw: total,
    brotli: br,
    largest,
    desktop: view(7),
    phone: view(5),
  });
}

// The finder, panel and prerendered list need every district's properties,
// bounds and label point whichever geometry format is chosen.
const sidecar = Buffer.from(
  JSON.stringify(
    features.map((f, i) => ({
      ...f.properties,
      label: artifact.data.labels.features[i].geometry.coordinates,
    })),
  ),
);

const kib = (n) => `${(n / 1024).toFixed(0)} KiB`;
const mib = (n) => `${(n / 1048576).toFixed(2)} MiB`;
console.log(
  `Single artifact: 1 file, ${mib(raw.length)} raw, ${mib(brotli(raw, 11))} Brotli-11, ${mib(brotli(raw, 5))} Brotli-5; JSON.parse ${parsed.ms.toFixed(0)} ms (Node, best of 3)`,
);
console.log(
  `Property sidecar a tile tree would also need: ${kib(sidecar.length)} raw, ${kib(brotli(sidecar, 5))} Brotli-5`,
);
console.log(
  '| Tile max zoom | Extent | Grid at 41° N | Files | Raw | Brotli-5 | Largest tile | State view, desktop z7 | State view, phone z5 |',
);
console.log('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const r of results)
  console.log(
    `| ${r.maxZoom} | ${r.extent} | ${((40075016 * Math.cos((41 * Math.PI) / 180)) / 2 ** r.maxZoom / r.extent).toFixed(1)} m | ${r.files} | ${mib(r.raw)} | ${mib(r.brotli)} | ${kib(r.largest)} | ${kib(r.desktop)} | ${kib(r.phone)} |`,
  );
