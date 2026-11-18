// STAND-INS for T2 (basemap, relief) and T3 (glyph fontstacks), built from the
// design spike's prepared, committed data in design/living-atlas/data/. The
// output follows the Classic-atlas contract (src/atlas/classic/contract.ts),
// so integrating the real tracks is a URL swap there. Offline; outputs are
// gitignored: public/basemap-standin, public/relief-standin, public/glyphs-standin.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import { REPO, SPIKE } from './lib.mjs';

const DESIGN = path.join(REPO, 'design/living-atlas/data');
const readGlobal = (file, name) => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DESIGN, file), 'utf8'), ctx, {
    filename: file,
  });
  return ctx.window[name];
};
const reset = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ---- Basemap (T2 contract): ocean, coast{landmass_km2}, lakes, rivers, marine ----
const NE = readGlobal('natural-earth.js', 'HB_NE');
const R = 6371.0088; // km
// Spherical ring area (km²), as in @mapbox/geojson-area.
const ringAreaKm2 = (ring) => {
  let s = 0;
  const rad = Math.PI / 180;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
  }
  return Math.abs((s * R * R) / 2);
};
const coast = {
  type: 'FeatureCollection',
  features: NE.coast.features.map((f) => ({
    ...f,
    properties: {
      landmass_km2: Math.round(ringAreaKm2(f.geometry.coordinates)),
    },
  })),
};
// The design spike moves the North Atlantic label into the European view.
const marine = {
  type: 'FeatureCollection',
  features: NE.marine.features.map((f) =>
    f.properties.name === 'North Atlantic Ocean'
      ? {
          ...f,
          properties: { ...f.properties, name: 'Atlantic Ocean' },
          geometry: { type: 'Point', coordinates: [-19, 46] },
        }
      : f,
  ),
};
const MAXZOOM = 5;
const opts = {
  maxZoom: MAXZOOM,
  indexMaxZoom: MAXZOOM,
  indexMaxPoints: 0,
  tolerance: 3,
  extent: 4096,
  buffer: 64,
};
const layers = Object.fromEntries(
  Object.entries({
    ocean: NE.ocean,
    coast,
    lakes: NE.lakes,
    rivers: NE.rivers,
    marine,
  }).map(([k, v]) => [k, new GeoJSONVT(v, opts)]),
);
const basemapOut = reset(path.join(SPIKE, 'public/basemap-standin'));
let files = 0;
let bytes = 0;
for (let z = 0; z <= MAXZOOM; z++)
  for (let x = 0; x < 2 ** z; x++)
    for (let y = 0; y < 2 ** z; y++) {
      const tile = {};
      for (const [name, index] of Object.entries(layers)) {
        const t = index.getTile(z, x, y);
        if (t && t.features.length) tile[name] = t;
      }
      if (!Object.keys(tile).length) continue;
      const buf = Buffer.from(
        fromGeojsonVt(tile, { version: 2, extent: 4096 }),
      );
      fs.mkdirSync(path.join(basemapOut, String(z), String(x)), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(basemapOut, String(z), String(x), `${y}.pbf`),
        buf,
      );
      files += 1;
      bytes += buf.length;
    }
console.log(`basemap stand-in: ${files} tiles, ${bytes} bytes (z0-${MAXZOOM})`);

// ---- Relief (T2 contract): one Web Mercator WebP, 180°W–180°E, 76°N–58°S ----
const relief = readGlobal('relief-a.js', 'HB_RELIEF');
if (relief.north !== 76 || relief.south !== -58)
  throw new Error('relief bounds changed: update RELIEF in contract.ts');
fs.writeFileSync(
  path.join(reset(path.join(SPIKE, 'public/relief-standin')), 'relief.webp'),
  Buffer.from(relief.webp, 'base64'),
);

// ---- Glyphs (T3 contract): /glyphs-standin/{fontstack}/{range}.pbf ----
const glyphsOut = reset(path.join(SPIKE, 'public/glyphs-standin'));
const STACKS = [
  ['glyphs-a.js', 'Alegreya SC Medium', 'Alegreya SC Medium'],
  ['glyphs-a.js', 'Alegreya SC Bold', 'Alegreya SC Bold'],
  ['glyphs-a.js', 'Alegreya Medium Italic', 'Alegreya Medium Italic'],
  ['glyphs-a.js', 'Alegreya Italic', 'Alegreya Italic'],
  ['glyphs-a.js', 'Alegreya Regular', 'Alegreya Regular'],
  ['glyphs-b.js', 'Atkinson Next Medium', 'Atkinson Hyperlegible Next Medium'],
  ['glyphs-b.js', 'Atkinson Next Bold', 'Atkinson Hyperlegible Next Bold'],
];
const bundles = {};
let glyphFiles = 0;
for (const [file, from, to] of STACKS) {
  bundles[file] ??= readGlobal(file, 'HB_GLYPHS');
  fs.mkdirSync(path.join(glyphsOut, to), { recursive: true });
  for (const [key, b64] of Object.entries(bundles[file])) {
    const [stack, range] = key.split('/');
    if (stack !== from) continue;
    fs.writeFileSync(
      path.join(glyphsOut, to, `${range}.pbf`),
      Buffer.from(b64, 'base64'),
    );
    glyphFiles += 1;
  }
}
fs.copyFileSync(
  path.join(REPO, 'design/living-atlas/fonts/LICENSE-alegreya.txt'),
  path.join(glyphsOut, 'LICENSE-alegreya.txt'),
);
fs.copyFileSync(
  path.join(REPO, 'design/living-atlas/fonts/LICENSE-alegreya-sc.txt'),
  path.join(glyphsOut, 'LICENSE-alegreya-sc.txt'),
);
fs.copyFileSync(
  path.join(
    REPO,
    'design/living-atlas/fonts/LICENSE-atkinson-hyperlegible-next.txt',
  ),
  path.join(glyphsOut, 'LICENSE-atkinson-hyperlegible-next.txt'),
);
console.log(
  `glyph stand-ins: ${glyphFiles} files in ${STACKS.length} fontstacks (ranges 0-511, 8192-8447 only)`,
);
