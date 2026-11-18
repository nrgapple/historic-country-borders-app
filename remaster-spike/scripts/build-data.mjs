// Converts the committed, validated per-year payloads into the spike's format:
//   /data/years/<year>.<hash>.geojson         border polygons {id, c} for the map worker
//   /data/years/<year>.<hash>.labels.geojson  label points {id, n, a} and places {p};
//       separate so border tiles never wait for label glyphs
//   /data/years/<year>.<hash>.index.json  territory facts for the finder/panel
//   src/data/years.json  year -> URLs (bundled; ~5 KB)
// Offline and deterministic: reads only ../data and ../public/data.
import fs from 'node:fs';
import path from 'node:path';
import { REPO, SPIKE, SOURCE_COLORS, hash16 } from './lib.mjs';
import { CAPITALS, DEPENDENCIES, SITES } from './standin-metadata.mjs';

const assets = JSON.parse(fs.readFileSync(path.join(REPO, 'data/historical-assets.json'), 'utf8')).assets;
const outDir = path.join(SPIKE, 'public/data/years');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const colorIndex = new Map(SOURCE_COLORS.map((c, i) => [c, i]));
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const bboxOf = (geometry) => {
  let w = 180, s = 90, e = -180, n = -90;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) for (const [x, y] of poly[0]) {
    if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
  }
  return [w, s, e, n];
};
const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const r2 = (v) => Math.round(v * 100) / 100;

// STAND-IN for T1: RFC 7946 winding (exteriors counter-clockwise, holes
// clockwise), so the style's line offsets know inside from outside.
const signedArea = (ring) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return s; // > 0: clockwise in lon/lat
};
const rewindPolygon = (rings) => rings.map((ring, i) => ((i === 0) === signedArea(ring) > 0 ? ring.slice().reverse() : ring));
const rewind = (g) =>
  g.type === 'Polygon' ? { ...g, coordinates: rewindPolygon(g.coordinates) }
    : g.type === 'MultiPolygon' ? { ...g, coordinates: g.coordinates.map(rewindPolygon) } : g;

const manifest = {};
const years = Object.keys(assets).map(Number).sort((a, b) => a - b);
for (const year of years) {
  const payload = JSON.parse(fs.readFileSync(path.join(REPO, 'public', assets[year].url), 'utf8'));
  const ids = new Map();
  const territories = [];
  const features = [];
  const labels = [];
  for (const f of payload.data.borders.features) {
    const p = f.properties;
    // Observed: -5000 has a whitespace-only NAME that passes current validation.
    const name = text(p.NAME) ?? text(p.ABBREVN) ?? 'Unnamed territory';
    let id = ids.get(name);
    const box = bboxOf(f.geometry);
    if (id === undefined) {
      id = territories.length;
      ids.set(name, id);
      territories.push({ name, partOf: text(p.PARTOF), subjectTo: text(p.SUBJECTO), precision: Number(p.BORDERPRECISION) || null, bbox: box });
    } else {
      territories[id].bbox = union(territories[id].bbox, box);
    }
    const c = colorIndex.get(String(p.COLOR).toUpperCase()) ?? 30;
    features.push({ type: 'Feature', id, properties: { c }, geometry: rewind(f.geometry) });
  }
  // STAND-IN for T1's dependency metadata: dep, ov (overlord id), ovc (overlord wash).
  const overlordOf = DEPENDENCIES[year] ?? {};
  for (const ft of features) {
    const overlord = overlordOf[territories[ft.id].name];
    const ov = overlord === undefined ? undefined : ids.get(overlord);
    if (overlord !== undefined && ov === undefined) throw new Error(`${year}: unknown overlord ${overlord}`);
    if (ov === undefined) continue;
    const ovc = features.find((o) => o.id === ov).properties.c;
    Object.assign(ft.properties, { dep: 1, ov, ovc });
  }
  // STAND-IN for T1's capitals source: {name, tid, qid}.
  const capitals = (CAPITALS[year] ?? []).map(([name, territory, lon, lat]) => {
    const tid = ids.get(territory);
    if (tid === undefined) throw new Error(`${year}: unknown territory ${territory} for capital ${name}`);
    return { type: 'Feature', properties: { name, tid, qid: null }, geometry: { type: 'Point', coordinates: [lon, lat] } };
  });
  for (const f of payload.data.labels.features) {
    const id = ids.get(text(f.properties.NAME) ?? text(f.properties.ABBREVN) ?? 'Unnamed territory');
    if (id === undefined) continue;
    labels.push({ type: 'Feature', id, properties: { n: territories[id].name, a: Math.round(Number(f.properties.AREA) || 0) }, geometry: f.geometry });
  }
  for (const f of payload.places.features) {
    const name = f.properties.name;
    // STAND-IN for T1's archaeological-site class.
    labels.push({ type: 'Feature', properties: SITES.has(name) ? { p: name, k: 'site' } : { p: name }, geometry: f.geometry });
  }
  const geojson = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }));
  const labelsJson = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: labels }));
  const labelsName = `${year}.${hash16(labelsJson)}.labels.geojson`;
  fs.writeFileSync(path.join(outDir, labelsName), labelsJson);
  const index = Buffer.from(JSON.stringify({
    year,
    territories: territories.map((t) => [t.name, t.partOf, t.subjectTo, t.precision, t.bbox.map(r2)]),
  }));
  const capitalsJson = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: capitals }));
  const capitalsName = `${year}.${hash16(capitalsJson)}.capitals.geojson`;
  fs.writeFileSync(path.join(outDir, capitalsName), capitalsJson);
  const mapName = `${year}.${hash16(geojson)}.geojson`;
  const indexName = `${year}.${hash16(index)}.index.json`;
  fs.writeFileSync(path.join(outDir, mapName), geojson);
  fs.writeFileSync(path.join(outDir, indexName), index);
  manifest[year] = { map: `/data/years/${mapName}`, labels: `/data/years/${labelsName}`, capitals: `/data/years/${capitalsName}`, index: `/data/years/${indexName}` };
}
fs.mkdirSync(path.join(SPIKE, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(SPIKE, 'src/data/years.json'), JSON.stringify({ years, files: manifest }));
fs.copyFileSync(path.join(REPO, 'public/data/historical/LICENSE-GPL-3.0.txt'), path.join(outDir, 'LICENSE-GPL-3.0.txt'));
console.log(`wrote ${years.length} years to ${path.relative(SPIKE, outDir)}`);
