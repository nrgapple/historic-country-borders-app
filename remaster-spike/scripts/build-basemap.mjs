// First-party physical basemap: Natural Earth (public domain) land, lakes and
// major rivers, tiled once into a static z/x/y vector-tile tree (z0-5) that
// Workers Static Assets serves like any other file. No roads, no modern
// borders, no names. MapLibre overzooms z5 tiles beyond zoom 5.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import { SPIKE } from './lib.mjs';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const cache = path.join(os.homedir(), 'LargeFiles/historic-borders-remaster/ne');
const MAXZOOM = Number(process.env.BASEMAP_MAXZOOM || 5);
const out = path.join(SPIKE, 'public/basemap');

async function load(name) {
  fs.mkdirSync(cache, { recursive: true });
  const file = path.join(cache, `${name}.geojson`);
  if (!fs.existsSync(file)) {
    const res = await fetch(`${NE}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (json.type !== 'FeatureCollection') throw new Error(`${name}: not a FeatureCollection`);
  return json;
}
const keep = (fc, props, filter = () => true) => ({
  type: 'FeatureCollection',
  features: fc.features.filter(filter).map((f) => ({ type: 'Feature', properties: Object.fromEntries(props.map((k) => [k, f.properties[k]])), geometry: f.geometry })),
});

const land = keep(await load('ne_50m_land'), []);
const lakes = keep(await load('ne_50m_lakes'), ['scalerank'], (f) => f.properties.scalerank <= 4);
const rivers = keep(await load('ne_50m_rivers_lake_centerlines'), ['scalerank'], (f) => f.properties.featurecla !== 'Lake Centerline');

const opts = { maxZoom: MAXZOOM, indexMaxZoom: MAXZOOM, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 };
const layers = { land: new GeoJSONVT(land, opts), lakes: new GeoJSONVT(lakes, opts), rivers: new GeoJSONVT(rivers, opts) };
fs.rmSync(out, { recursive: true, force: true });
let files = 0, bytes = 0;
for (let z = 0; z <= MAXZOOM; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) {
  const tile = {};
  for (const [name, index] of Object.entries(layers)) {
    const t = index.getTile(z, x, y);
    if (t && t.features.length) tile[name] = t;
  }
  if (!Object.keys(tile).length) continue; // open ocean: MapLibre shows the background
  const buf = Buffer.from(fromGeojsonVt(tile, { version: 2, extent: 4096 }));
  fs.mkdirSync(path.join(out, String(z), String(x)), { recursive: true });
  fs.writeFileSync(path.join(out, String(z), String(x), `${y}.pbf`), buf);
  files += 1; bytes += buf.length;
}
fs.writeFileSync(path.join(out, 'SOURCE.txt'), `Natural Earth v5.1.2 (public domain): ne_50m_land, ne_50m_lakes (scalerank<=4), ne_50m_rivers_lake_centerlines. z0-${MAXZOOM}.\n`);
console.log(`basemap: ${files} tiles, ${bytes} bytes (z0-${MAXZOOM})`);
