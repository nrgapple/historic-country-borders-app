// STAND-INS for tracks that have not landed yet, built offline from the design
// spike's committed data (design/living-atlas/data, Natural Earth + OFL fonts).
// Each follows the contract the real track will publish, so switching is a
// one-line URL change in src/adapters/* (see README "Adapters").
//
//   T2  public/basemap-standin/{z}/{x}/{y}.pbf   source-layers: ocean, coast,
//       lakes, rivers, marine (z0-5). The ocean mask is painted over borders.
//   T2  public/relief-standin/relief.webp        tinted local relief (Mercator)
//   T3  public/glyphs-standin/{fontstack}/{range}.pbf   SDF glyphs per stack,
//       plus Noto Sans fallback ranges (from the spike's SSD cache) for the
//       non-Latin characters in published names, when that cache exists.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import { APP, REPO, writeFile } from './lib.mjs';

const DESIGN = path.join(REPO, 'design/living-atlas/data');
const loadGlobal = (file, name) => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DESIGN, file), 'utf8'), sandbox);
  const value = sandbox.window[name];
  if (!value) throw new Error(`${file} did not define window.${name}`);
  return value;
};

/* ---- T2: basemap tiles --------------------------------------------------- */
const ne = loadGlobal('natural-earth.js', 'HB_NE');
const MAXZOOM = 5;
const opts = { maxZoom: MAXZOOM, indexMaxZoom: MAXZOOM, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 };
// The Atlantic label is moved into the European view, as in the design mock.
const marine = {
  ...ne.marine,
  features: ne.marine.features.map((f) =>
    f.properties.name === 'North Atlantic Ocean'
      ? { ...f, properties: { ...f.properties, name: 'Atlantic Ocean' }, geometry: { type: 'Point', coordinates: [-19, 46] } }
      : f,
  ),
};
const layers = Object.fromEntries(
  Object.entries({ ocean: ne.ocean, coast: ne.coast, lakes: ne.lakes, rivers: ne.rivers, marine }).map(([k, fc]) => [
    k,
    new GeoJSONVT(fc, opts),
  ]),
);
const tilesOut = path.join(APP, 'public/basemap-standin');
fs.rmSync(tilesOut, { recursive: true, force: true });
let tiles = 0;
let tileBytes = 0;
for (let z = 0; z <= MAXZOOM; z++)
  for (let x = 0; x < 2 ** z; x++)
    for (let y = 0; y < 2 ** z; y++) {
      const tile = {};
      for (const [name, index] of Object.entries(layers)) {
        const t = index.getTile(z, x, y);
        if (t && t.features.length) tile[name] = t;
      }
      if (!Object.keys(tile).length) continue;
      const buf = Buffer.from(fromGeojsonVt(tile, { version: 2, extent: 4096 }));
      writeFile(path.join(tilesOut, String(z), String(x), `${y}.pbf`), buf);
      tiles += 1;
      tileBytes += buf.length;
    }
fs.writeFileSync(
  path.join(tilesOut, 'SOURCE.txt'),
  'STAND-IN for T2. Natural Earth v5.1.2 1:50m (public domain), prepared by design/living-atlas/tools/prepare-data.cjs.\n',
);

/* ---- T2: relief ---------------------------------------------------------- */
const relief = loadGlobal('relief-a.js', 'HB_RELIEF');
writeFile(path.join(APP, 'public/relief-standin/relief.webp'), Buffer.from(relief.webp, 'base64'));

/* ---- T3: glyphs ---------------------------------------------------------- */
const glyphsOut = path.join(APP, 'public/glyphs-standin');
fs.rmSync(glyphsOut, { recursive: true, force: true });
// T3's fontstack names (plan §5) -> the design spike's bundle names.
const STACKS = {
  'Alegreya SC Medium': ['glyphs-a.js', 'Alegreya SC Medium'],
  'Alegreya SC Bold': ['glyphs-a.js', 'Alegreya SC Bold'],
  'Alegreya Medium Italic': ['glyphs-a.js', 'Alegreya Medium Italic'],
  'Alegreya Italic': ['glyphs-a.js', 'Alegreya Italic'],
  'Alegreya Regular': ['glyphs-a.js', 'Alegreya Regular'],
  'Atkinson Hyperlegible Next Medium': ['glyphs-b.js', 'Atkinson Next Medium'],
  'Atkinson Hyperlegible Next Bold': ['glyphs-b.js', 'Atkinson Next Bold'],
};
const bundles = {};
const usedRanges = new Set();
const yearsDir = path.join(APP, 'public/data/historical');
if (fs.existsSync(yearsDir))
  for (const f of fs.readdirSync(yearsDir).filter((f) => /\.labels\.[0-9a-f]+\.json$/.test(f)))
    for (const ft of JSON.parse(fs.readFileSync(path.join(yearsDir, f))).features) {
      const s = ft.properties.n || ft.properties.p;
      if (s) for (const ch of s) usedRanges.add(Math.floor(ch.codePointAt(0) / 256) * 256);
    }
const notoCache = path.join(os.homedir(), 'LargeFiles/historic-borders-remaster/glyphs/main/Noto Sans Medium');
let glyphFiles = 0;
let fallbacks = 0;
for (const [stack, [file, source]] of Object.entries(STACKS)) {
  bundles[file] ??= loadGlobal(file, 'HB_GLYPHS');
  const dir = path.join(glyphsOut, stack);
  const have = new Set();
  for (const [key, b64] of Object.entries(bundles[file])) {
    const [name, range] = key.split('/');
    if (name !== source) continue;
    writeFile(path.join(dir, `${range}.pbf`), Buffer.from(b64, 'base64'));
    have.add(Number(range.split('-')[0]));
    glyphFiles += 1;
  }
  for (const start of usedRanges) {
    if (have.has(start)) continue;
    const cached = path.join(notoCache, `${start}-${start + 255}.pbf`);
    if (!fs.existsSync(cached)) continue;
    fs.copyFileSync(cached, path.join(dir, `${start}-${start + 255}.pbf`));
    fallbacks += 1;
  }
}
fs.writeFileSync(
  path.join(glyphsOut, 'LICENSE.txt'),
  'STAND-IN for T3. SDF glyphs derived from Alegreya, Alegreya SC (Huerta Tipografica) and Atkinson Hyperlegible Next (Braille Institute), and Noto Sans fallback ranges; all SIL Open Font License 1.1.\n',
);

console.log(
  `stand-ins: ${tiles} basemap tiles (${tileBytes} B), relief, ${glyphFiles} glyph files + ${fallbacks} Noto fallback ranges`,
);
