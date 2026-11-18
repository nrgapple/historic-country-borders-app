// T1 STAND-IN: per-year map data in the split format of plan §6, built offline
// from the committed, validated payloads in ../public/data/historical.
//
//   public/data/years/<year>.<hash>.geojson         polygons {id, c}
//   public/data/years/<year>.<hash>.labels.geojson  label points {n, a} + places {p}
//   public/data/years/<year>.<hash>.index.json      territory facts (finder, panel, SEO)
//   public/data/context/*                           Wikidata context (copied as-is)
//   src/data/years.json                             year -> URLs, bundled (~6 KB)
//   src/data/sources.json                           provenance for About and credits
//
// When T1 publishes its own split files, this script is replaced by reading
// T1's manifest; the app reads only src/data/years.json through
// src/adapters/yearData.ts, so nothing else changes. See README "Adapters".
import fs from 'node:fs';
import path from 'node:path';
import { APP, REPO, SOURCE_COLORS, hash16, readJson, writeFile } from './lib.mjs';

const assets = readJson(path.join(REPO, 'data/historical-assets.json')).assets;
const manifestSource = readJson(path.join(REPO, 'data/historical-manifest.json'));
const contextManifest = readJson(path.join(REPO, 'data/historical-context.json'));
const outDir = path.join(APP, 'public/data/years');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const colorIndex = new Map(SOURCE_COLORS.map((c, i) => [c, i]));
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const bboxOf = (geometry) => {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  const polys =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  return [w, s, e, n];
};
const union = (a, b) => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];
const r2 = (v) => Math.round(v * 100) / 100;

// RFC 7946 winding (outer rings counter-clockwise, holes clockwise), so a
// negative line-offset draws the edge band inside each territory (T1 does
// the same in its pipeline).
const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return sum / 2;
};
const rewindPolygon = (rings) =>
  rings.map((ring, i) => {
    const ccw = signedArea(ring) > 0;
    return ccw === (i === 0) ? ring : [...ring].reverse();
  });
const rewind = (geometry) =>
  geometry.type === 'Polygon'
    ? { ...geometry, coordinates: rewindPolygon(geometry.coordinates) }
    : { ...geometry, coordinates: geometry.coordinates.map(rewindPolygon) };

const files = {};
const years = Object.keys(assets)
  .map(Number)
  .sort((a, b) => a - b);
if (JSON.stringify(years) !== JSON.stringify(manifestSource.years))
  throw new Error('historical-assets.json and historical-manifest.json disagree');

for (const year of years) {
  const payload = readJson(path.join(REPO, 'public', assets[year].url));
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
      territories.push({
        name,
        partOf: text(p.PARTOF),
        subjectTo: text(p.SUBJECTO),
        precision: Number(p.BORDERPRECISION) || null,
        bbox: box,
      });
    } else {
      territories[id].bbox = union(territories[id].bbox, box);
    }
    const c = colorIndex.get(String(p.COLOR).toUpperCase()) ?? 30;
    features.push({ type: 'Feature', id, properties: { c }, geometry: rewind(f.geometry) });
  }
  for (const f of payload.data.labels.features) {
    const id = ids.get(
      text(f.properties.NAME) ?? text(f.properties.ABBREVN) ?? 'Unnamed territory',
    );
    if (id === undefined) continue;
    labels.push({
      type: 'Feature',
      id,
      // `a` stays in the source unit (m²), as in the spike; see AREA_TO_KM2.
      properties: { n: territories[id].name, a: Math.round(Number(f.properties.AREA) || 0) },
      geometry: f.geometry,
    });
  }
  for (const f of payload.places.features) {
    labels.push({ type: 'Feature', properties: { p: f.properties.name }, geometry: f.geometry });
  }
  const polygons = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }));
  const labelsJson = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: labels }));
  const index = Buffer.from(
    JSON.stringify({
      year,
      territories: territories.map((t) => [t.name, t.partOf, t.subjectTo, t.precision, t.bbox.map(r2)]),
    }),
  );
  const name = (suffix, buf) => `${year}.${hash16(buf)}.${suffix}`;
  const entry = {
    map: `/data/years/${name('geojson', polygons)}`,
    labels: `/data/years/${name('labels.geojson', labelsJson)}`,
    index: `/data/years/${name('index.json', index)}`,
    context: contextManifest.years[String(year)] ?? null,
  };
  writeFile(path.join(APP, 'public', entry.map), polygons);
  writeFile(path.join(APP, 'public', entry.labels), labelsJson);
  writeFile(path.join(APP, 'public', entry.index), index);
  files[year] = entry;
}
fs.copyFileSync(
  path.join(REPO, 'public/data/historical/LICENSE-GPL-3.0.txt'),
  path.join(outDir, 'LICENSE-GPL-3.0.txt'),
);

// Wikidata context files are already static, hashed and validated: copy them.
const contextOut = path.join(APP, 'public/data/context');
fs.rmSync(contextOut, { recursive: true, force: true });
fs.cpSync(path.join(REPO, 'public/data/context'), contextOut, { recursive: true });

writeFile(path.join(APP, 'src/data/years.json'), JSON.stringify({ years, files }));
writeFile(
  path.join(APP, 'src/data/sources.json'),
  JSON.stringify({ historical: manifestSource.source, context: contextManifest.source ?? null }),
);
console.log(`data: ${years.length} years -> ${path.relative(APP, outDir)}`);
