// Compares per-year delivery formats on real years. Run with --expose-gc.
//   node --expose-gc scripts/measure-formats.mjs [years...]
// Bytes: raw, gzip -9, Brotli q11 (static precompression) and q5 (typical
// on-the-fly CDN level). Times: median of 7 runs on this machine (no CPU
// throttle). Heap: retained V8 heap after decoding, measured after GC.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import * as geobuf from 'geobuf';
import { serialize as fgbSerialize, deserialize as fgbDeserialize } from 'flatgeobuf/lib/mjs/geojson.js';
import { topology } from 'topojson-server';

import * as topojsonClient from 'topojson-client';
import { REPO, SPIKE } from './lib.mjs';

const years = process.argv.slice(2).length ? process.argv.slice(2) : ['1914', '1492'];
const assets = JSON.parse(fs.readFileSync(path.join(REPO, 'data/historical-assets.json'), 'utf8')).assets;
const spikeManifest = JSON.parse(fs.readFileSync(path.join(SPIKE, 'src/data/years.json'), 'utf8')).files;

const br = (b, q) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } }).length;
const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const sizes = (b) => ({ raw: b.length, gzip: gz(b), br11: br(b, 11), br5: br(b, 5) });
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const timeAsync = async (fn, runs = 7) => { await fn(); const t = []; for (let i = 0; i < runs; i++) { const s = performance.now(); await fn(); t.push(performance.now() - s); } return Math.round(median(t) * 10) / 10; };
const fgbAll = async (buf) => { const out = []; for await (const f of fgbDeserialize(new Uint8Array(buf))) out.push(f); return out; };
const time = (fn, runs = 7) => { fn(); const t = []; for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); } return Math.round(median(t) * 10) / 10; };
const retained = (fn) => { global.gc(); global.gc(); const before = process.memoryUsage().heapUsed; const keep = fn(); global.gc(); global.gc(); const after = process.memoryUsage().heapUsed; void keep.length; return Math.round((after - before) / 1024); };

// Tiles intersecting a lon/lat box at zoom z.
const tileRange = (z, [w, s, e, n]) => {
  const n2 = 2 ** z;
  const tx = (lon) => Math.min(n2 - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n2)));
  const ty = (lat) => { const r = (lat * Math.PI) / 180; return Math.min(n2 - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n2))); };
  const out = [];
  for (let x = tx(w); x <= tx(e); x++) for (let y = ty(n); y <= ty(s); y++) out.push([z, x, y]);
  return out;
};
// Viewports used by the browser benchmark (1366x768 CSS px).
const VIEWS = {
  'world z1.6': { z: 1, box: [-180, -80, 180, 85] },
  'Europe z3.5 (1914 bench)': { z: 3, box: [-15, 35, 45, 62] },
  'Anatolia z3.6 (1492 bench)': { z: 3, box: [2, 25, 62, 52] },
};

const report = { measuredAt: new Date().toISOString(), node: process.version, years: {} };
for (const year of years) {
  const current = fs.readFileSync(path.join(REPO, 'public', assets[year].url));
  const slim = fs.readFileSync(path.join(SPIKE, 'public', spikeManifest[year].map));
  const slimObj = JSON.parse(slim);
  const labelsBuf = fs.readFileSync(path.join(SPIKE, 'public', spikeManifest[year].labels));
  const indexBuf = fs.readFileSync(path.join(SPIKE, 'public', spikeManifest[year].index));
  const polys = { type: 'FeatureCollection', features: slimObj.features.filter((f) => f.geometry.type !== 'Point') };

  const geobufBuf = Buffer.from(geobuf.encode(slimObj, new Pbf()));
  const fgbBuf = Buffer.from(fgbSerialize(polys));
  const topo = topology({ b: polys }, 1e6);
  const topoBuf = Buffer.from(JSON.stringify(topo));

  // Vector-tile pyramid z0-6 (what a static z/x/y tree or a per-year PMTiles would hold).
  let t0 = performance.now();
  const index = new GeoJSONVT(slimObj, { maxZoom: 6, indexMaxZoom: 6, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 });
  const vtBuildMs = Math.round(performance.now() - t0);
  const tiles = new Map();
  let tileBytes = 0, tileBr = 0, perZoom = {};
  for (let z = 0; z <= 6; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) {
    const t = index.getTile(z, x, y);
    if (!t || !t.features.length) continue;
    const buf = Buffer.from(fromGeojsonVt({ borders: t }, { version: 2, extent: 4096 }));
    tiles.set(`${z}/${x}/${y}`, buf);
    tileBytes += buf.length; const b = br(buf, 11); tileBr += b;
    perZoom[z] = (perZoom[z] ?? 0) + 1;
  }
  const views = {};
  for (const [name, { z, box }] of Object.entries(VIEWS)) {
    const list = tileRange(z, box).map(([z, x, y]) => tiles.get(`${z}/${x}/${y}`)).filter(Boolean);
    views[name] = { tiles: list.length, br11: list.reduce((s, b) => s + br(b, 11), 0),
      decodeMs: time(() => { for (const b of list) { const vt = new VectorTile(new Pbf(b)); const l = vt.layers.borders; for (let i = 0; i < l.length; i++) l.feature(i).loadGeometry(); } }) };
  }

  // What MapLibre's worker does with GeoJSON: JSON.parse then geojson-vt index (z0..indexMaxZoom 5).
  const mlWorker = () => new GeoJSONVT(JSON.parse(slim), { maxZoom: 14, tolerance: 0.375 * 1, extent: 8192, buffer: 128 / 512 * 8192 / 64 });

  report.years[year] = {
    features: { total: slimObj.features.length, polygons: polys.features.length },
    bytes: {
      'current payload (GeoJSON)': sizes(current),
      'spike GeoJSON polygons {id,c}': sizes(slim),
      'spike labels+places GeoJSON': sizes(labelsBuf),
      'spike territory index JSON': sizes(indexBuf),
      'geobuf (slim)': sizes(geobufBuf),
      'FlatGeobuf (polygons only)': sizes(fgbBuf),
      'TopoJSON q1e6, ~40 m grid, lossy (polygons)': sizes(topoBuf),
      'MVT pyramid z0-6 (sum of tiles)': { raw: tileBytes, br11: tileBr, files: tiles.size, perZoom },
    },
    decodeMs: {
      'JSON.parse current': time(() => JSON.parse(current)),
      'JSON.parse slim': time(() => JSON.parse(slim)),
      'geobuf.decode': time(() => geobuf.decode(new Pbf(geobufBuf))),
      'FlatGeobuf deserialize (all features)': await timeAsync(() => fgbAll(fgbBuf)),
      'TopoJSON parse + feature()': time(() => topojsonClient.feature(JSON.parse(topoBuf), 'b')),
      'MapLibre-style worker: parse + geojson-vt index': time(mlWorker, 3),
      'geojson-vt z0-6 pyramid build (offline)': vtBuildMs,
    },
    retainedHeapKiB: {
      'JSON.parse current': retained(() => [JSON.parse(current)]),
      'JSON.parse slim': retained(() => [JSON.parse(slim)]),
      'parse + geojson-vt index': retained(() => [mlWorker()]),
    },
    viewportTiles: views,
  };
}
// Distribution across all published years for the two GeoJSON variants.
if (!process.env.SKIP_ALL) {
  const all = [];
  for (const [year, f] of Object.entries(spikeManifest)) {
    const b = fs.readFileSync(path.join(SPIKE, 'public', f.map));
    all.push({ year: Number(year), raw: b.length, br5: br(b, 5), br11: br(b, 11) });
  }
  all.sort((a, b) => a.br11 - b.br11);
  const pick = (q) => all[Math.min(all.length - 1, Math.floor(q * all.length))];
  report.allYearsSlimGeoJSON = { count: all.length, totalRaw: all.reduce((s, x) => s + x.raw, 0), totalBr11: all.reduce((s, x) => s + x.br11, 0),
    median: pick(0.5), p90: pick(0.9), max: all[all.length - 1], min: all[0], over300kBr11: all.filter((x) => x.br11 > 300000).map((x) => x.year) };
}
fs.mkdirSync(path.join(SPIKE, 'results'), { recursive: true });
fs.writeFileSync(path.join(SPIKE, 'results/formats.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
