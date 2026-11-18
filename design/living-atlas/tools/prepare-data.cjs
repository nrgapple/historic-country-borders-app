/**
 * Builds the static data bundles used by the three mock pages.
 *
 *   node tools/prepare-data.cjs <naturalEarthDir> <GRAY_50M_SR.tif>
 *
 * Inputs: the 1492 historical payload in ../../public/data, Natural Earth
 * 1:50m GeoJSON (v5.1.2, public domain) and the Natural Earth 1:50m gray
 * shaded relief raster (public domain). Output: data/*.js files that assign
 * globals, so each page also works when opened straight from disk.
 */
const fs = require('fs');
const path = require('path');
const ROOT_NM =
  process.env.ROOT_NODE_MODULES ||
  '/Volumes/External SSD/Developer/Projects/borders/node_modules';
const sharp = require(path.join(ROOT_NM, 'sharp'));
const polylabel = require(path.join(ROOT_NM, 'polylabel'));

const [neDir, reliefTif] = process.argv.slice(2);
const here = path.resolve(__dirname, '..');
const repo = path.resolve(here, '../..');
const out = (name, globalName, value) => {
  const file = path.join(here, 'data', name);
  fs.writeFileSync(file, `window.${globalName}=${JSON.stringify(value)};\n`);
  console.log(name, (fs.statSync(file).size / 1024).toFixed(0) + ' kB');
};

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const roundCoords = (c, d) =>
  typeof c[0] === 'number' ? [round(c[0], d), round(c[1], d)] : c.map((x) => roundCoords(x, d));
const signedArea = (ring) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return s; // > 0 means clockwise in lon/lat
};
// RFC 7946: exterior rings counter-clockwise, holes clockwise. The tint-band
// and waterline layers rely on this to offset lines inward or outward.
const rewindPolygon = (rings) =>
  rings.map((ring, i) => {
    const cw = signedArea(ring) > 0;
    return (i === 0 ? cw : !cw) ? ring.slice().reverse() : ring;
  });
const rewind = (g) => {
  if (!g) return g;
  if (g.type === 'Polygon') return { ...g, coordinates: rewindPolygon(g.coordinates) };
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(rewindPolygon) };
  return g;
};
const dedupe = (ring) => ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]);
const clean = (g, d) => {
  const c = roundCoords(g.coordinates, d);
  if (g.type === 'Polygon') return rewind({ type: g.type, coordinates: c.map(dedupe).filter((r) => r.length >= 4) });
  if (g.type === 'MultiPolygon')
    return rewind({ type: g.type, coordinates: c.map((p) => p.map(dedupe).filter((r) => r.length >= 4)).filter((p) => p.length) });
  if (g.type === 'LineString') return { type: g.type, coordinates: dedupe(c) };
  if (g.type === 'MultiLineString') return { type: g.type, coordinates: c.map(dedupe) };
  return { type: g.type, coordinates: c };
};
const fc = (features) => ({ type: 'FeatureCollection', features });

// ---- Historical 1492 (aourednik/historical-basemaps, GPL-3.0) -------------
const histFile = fs.readdirSync(path.join(repo, 'public/data/historical')).find((f) => f.startsWith('1492.'));
const hist = JSON.parse(fs.readFileSync(path.join(repo, 'public/data/historical', histFile)));
const keep = ['NAME', 'COLOR', 'PARTOF', 'SUBJECTO', 'BORDERPRECISION'];
const borders = hist.data.borders.features.map((f, i) => ({
  type: 'Feature',
  id: i + 1,
  properties: Object.fromEntries(keep.filter((k) => f.properties[k] != null).map((k) => [k, f.properties[k]])),
  geometry: clean(f.geometry, 3),
}));
const labels = hist.data.labels.features.map((f) => ({
  type: 'Feature',
  properties: { NAME: f.properties.NAME, AREA: Math.round(f.properties.AREA / 1e6) /* km² */ },
  geometry: clean(f.geometry, 3),
}));
const places = hist.places.features.map((f) => ({
  type: 'Feature',
  properties: { name: f.properties.name, since: f.properties.inhabitedSince },
  geometry: clean(f.geometry, 3),
}));
out('historical-1492.js', 'HB_1492', {
  source: `public/data/historical/${histFile}`,
  borders: fc(borders),
  labels: fc(labels),
  places: fc(places),
});

// ---- Natural Earth 1:50m (public domain) ------------------------------------
const ne = (name) => JSON.parse(fs.readFileSync(path.join(neDir, `${name}.geojson`)));
const land = fc(ne('ne_50m_land').features.map((f) => ({ type: 'Feature', properties: {}, geometry: clean(f.geometry, 2) })));
const lakes = fc(
  ne('ne_50m_lakes').features
    .filter((f) => f.properties.scalerank <= 6)
    .map((f) => ({ type: 'Feature', properties: { name: f.properties.name, rank: f.properties.scalerank }, geometry: clean(f.geometry, 2) })),
);
const rivers = fc(
  ne('ne_50m_rivers_lake_centerlines').features
    .filter((f) => /River/.test(f.properties.featurecla) && f.properties.scalerank <= 7)
    .map((f) => ({ type: 'Feature', properties: { name: f.properties.name_en || f.properties.name, rank: f.properties.scalerank }, geometry: clean(f.geometry, 2) })),
);
const title = (s) => s.toLowerCase().replace(/\b(\p{L})/gu, (m) => m.toUpperCase()).replace(/\bOf\b/g, 'of');
const marine = fc(
  ne('ne_50m_geography_marine_polys').features
    .filter((f) => f.properties.scalerank <= 4 && f.properties.name)
    .map((f) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const largest = polys.reduce((a, b) => (Math.abs(signedArea(b[0])) > Math.abs(signedArea(a[0])) ? b : a));
      const p = polylabel(largest, 0.5);
      return {
        type: 'Feature',
        properties: { name: title(f.properties.name), kind: f.properties.featurecla, rank: f.properties.scalerank },
        geometry: { type: 'Point', coordinates: [round(p[0], 2), round(p[1], 2)] },
      };
    }),
);
// Ocean mask: the world minus land, cut into 30° cells so no single polygon
// carries hundreds of holes (which triangulates badly). Historical territory
// polygons overrun coastlines, so water is painted over them.
const martinez = require(path.join(ROOT_NM, 'martinez-polygon-clipping'));
const landPolys = land.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
const bboxOf = (poly) => poly[0].reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]);
const landBoxes = landPolys.map(bboxOf);
const oceanPolys = [];
for (let x = -180; x < 180; x += 30) {
  for (let y = -85; y < 85; y += 34) {
    const cell = [[[x, y], [x + 30, y], [x + 30, y + 34], [x, y + 34], [x, y]]];
    const hits = landPolys.filter((_, i) => landBoxes[i][0] <= x + 30 && landBoxes[i][2] >= x && landBoxes[i][1] <= y + 34 && landBoxes[i][3] >= y);
    const result = hits.length ? martinez.diff(cell, hits) : [cell];
    (result || []).forEach((poly) => oceanPolys.push(poly.map((ring) => ring.map(([a, b]) => [round(a, 2), round(b, 2)]))));
  }
}
const ocean = fc([{ type: 'Feature', properties: {}, geometry: rewind({ type: 'MultiPolygon', coordinates: oceanPolys }) }]);
// Coastline for strokes (cell edges would otherwise draw as lines at sea).
const coast = fc(landPolys.flatMap((p) => p.map((ring) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } }))));
out('natural-earth.js', 'HB_NE', { ocean, coast, lakes, rivers, marine });

// 1:110m land outlines for direction B's locator globe.
out('land-110m.js', 'HB_LAND110', ne('ne_110m_land').features.flatMap((f) =>
  (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => roundCoords(p[0], 1))));

// ---- Relief: NE GRAY_50M_SR reprojected to Web Mercator ---------------------
const NORTH = 76;
const SOUTH = -58;
const W = 2048;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const H = Math.round((W * (mercY(NORTH) - mercY(SOUTH))) / (2 * Math.PI));
const TINTS = {
  a: { shadow: [96, 72, 44], light: [255, 250, 236], maxShadow: 0.5, maxLight: 0.42 },
  b: { shadow: [58, 72, 84], light: [255, 255, 255], maxShadow: 0.3, maxLight: 0.34 },
  c: { shadow: [52, 50, 48], light: [255, 255, 252], maxShadow: 0.42, maxLight: 0.36 },
};
(async () => {
  sharp.cache(false);
  const src = await sharp(reliefTif, { limitInputPixels: false }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const blur = await sharp(reliefTif, { limitInputPixels: false }).greyscale().blur(14).raw().toBuffer();
  const soft = await sharp(reliefTif, { limitInputPixels: false }).greyscale().blur(2.2).raw().toBuffer();
  const { width: sw, height: sh } = src.info;
  // Local relief: pixel minus its neighbourhood, so slopes read as light/shade
  // without the raster's elevation brightening flattening the tints.
  const detail = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const my = mercY(NORTH) - ((y + 0.5) / H) * (mercY(NORTH) - mercY(SOUTH));
    const lat = (2 * Math.atan(Math.exp(my)) - Math.PI / 2) * (180 / Math.PI);
    const sy = Math.min(sh - 1, Math.floor(((90 - lat) / 180) * sh));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x / W) * sw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) / W) * sw));
      let s = 0;
      for (let sx = x0; sx < x1; sx++) s += soft[sy * sw + sx] - blur[sy * sw + sx];
      detail[y * W + x] = s / (x1 - x0);
    }
  }
  const meta = { north: NORTH, south: SOUTH, width: W, height: H };
  for (const [key, t] of Object.entries(TINTS)) {
    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const d = detail[i];
      const dark = Math.min(1, Math.max(0, -d / 34)) ** 1.1 * t.maxShadow;
      const light = Math.min(1, Math.max(0, d / 34)) ** 1.1 * t.maxLight;
      const c = dark >= light ? t.shadow : t.light;
      rgba[i * 4] = c[0];
      rgba[i * 4 + 1] = c[1];
      rgba[i * 4 + 2] = c[2];
      rgba[i * 4 + 3] = Math.round(255 * Math.max(dark, light));
    }
    const webp = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 62, alphaQuality: 60 }).toBuffer();
    out(`relief-${key}.js`, 'HB_RELIEF', { ...meta, webp: webp.toString('base64') });
  }
})();
