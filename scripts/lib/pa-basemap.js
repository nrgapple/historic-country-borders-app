'use strict';

// Offline half of the PA street basemap (docs/PA_BASEMAP.md): tile coverage,
// the slimming recipe that turns cached Protomaps tiles into the published
// tree, and validation of the committed tree. No network access here.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const KiB = 1024;
const MiB = 1024 * KiB;

const PATHS = {
  sources: 'data/pa-basemap-sources.json',
  manifest: 'data/pa-basemap-manifest.json',
  districts: 'public/data/pa-school-districts.json',
  /** Committed tile trees live outside public/ so the legacy Next export never ships them. */
  treeRoot: 'data/pa-basemap',
};

const sha256 = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

/** Digest of a tile tree: sha256 over sorted "path sha256" lines. */
const treeDigest = (records) =>
  sha256(
    Buffer.from(
      records
        .map((r) => `${r.rel} ${r.sha256}`)
        .sort()
        .join('\n'),
    ),
  );

// ---------------------------------------------------------------------------
// Tile math (Web Mercator, XYZ)

const lonToX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat, z) => {
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const xToLon = (x, z) => (x / 2 ** z) * 360 - 180;
const yToLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

/** [west, south, east, north] of a tile. */
const tileBounds = (z, x, y) => [
  xToLon(x, z),
  yToLat(y + 1, z),
  xToLon(x + 1, z),
  yToLat(y, z),
];

const key = (z, x, y) => `${z}/${x}/${y}`;
const parseKey = (k) => {
  const [z, x, y] = k.split('/').map(Number);
  return { z, x, y };
};

/** Every tile of zoom `z` that intersects a [w, s, e, n] box. */
const bboxTiles = ([w, s, e, n], z) => {
  const out = [];
  const x0 = Math.floor(lonToX(w, z));
  const x1 = Math.min(2 ** z - 1, Math.floor(lonToX(e, z)));
  const y0 = Math.floor(latToY(n, z));
  const y1 = Math.min(2 ** z - 1, Math.floor(latToY(s, z)));
  for (let x = x0; x <= x1; x += 1)
    for (let y = y0; y <= y1; y += 1) out.push(key(z, x, y));
  return out;
};

const ringsOf = (geometry) =>
  geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat()
      : [];

/**
 * Tiles of zoom `z` that touch Pennsylvania (the union of the 500 PASDA
 * district polygons), grown by `dilate` tiles in every direction. Edges are
 * densified to a quarter tile so long straight borders (42° N) are covered;
 * interiors are filled row by row with an even-odd scanline.
 */
const stateTiles = (districts, z, dilate = 1) => {
  const hit = new Set();
  const step = 0.25;
  const rows = new Map();
  for (const feature of districts) {
    for (const ring of ringsOf(feature.geometry)) {
      const pts = ring.map(([lon, lat]) => [lonToX(lon, z), latToY(lat, z)]);
      for (let i = 1; i < pts.length; i += 1) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const n = Math.max(
          1,
          Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / step),
        );
        for (let k = 0; k <= n; k += 1) {
          const t = k / n;
          hit.add(
            key(
              z,
              Math.floor(ax + (bx - ax) * t),
              Math.floor(ay + (by - ay) * t),
            ),
          );
        }
        // Scanline crossings at row centres, for the interior fill.
        const yMin = Math.min(ay, by);
        const yMax = Math.max(ay, by);
        for (let row = Math.ceil(yMin - 0.5); row + 0.5 < yMax; row += 1) {
          const yc = row + 0.5;
          if (yc < yMin) continue;
          const xc = ax + ((yc - ay) / (by - ay)) * (bx - ax);
          if (!rows.has(row)) rows.set(row, []);
          rows.get(row).push(xc);
        }
      }
    }
  }
  // District rings are each closed, so crossings pair up per district; the
  // union of their spans is the state.
  for (const [row, xs] of rows) {
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.floor(xs[i]); x <= Math.floor(xs[i + 1]); x += 1)
        hit.add(key(z, x, row));
  }
  const out = new Set();
  for (const k of hit) {
    const { x, y } = parseKey(k);
    for (let dx = -dilate; dx <= dilate; dx += 1)
      for (let dy = -dilate; dy <= dilate; dy += 1)
        out.add(key(z, x + dx, y + dy));
  }
  return [...out];
};

/**
 * Compact coverage index for the client: per zoom, rows of [x0, x1] runs
 * ({ "12": { "1550": [[1130, 1190]] } }). The map's tile protocol answers
 * only covered tiles, so MapLibre never requests a missing file and shows
 * the nearest covered parent instead.
 */
const coverageIndex = (keys) => {
  const rows = {};
  for (const k of keys) {
    const { z, x, y } = parseKey(k);
    ((rows[z] ??= {})[y] ??= []).push(x);
  }
  const out = {};
  for (const [z, byRow] of Object.entries(rows)) {
    out[z] = {};
    for (const [y, xs] of Object.entries(byRow)) {
      xs.sort((a, b) => a - b);
      const runs = [];
      for (const x of xs) {
        const last = runs[runs.length - 1];
        if (last && x === last[1] + 1) last[1] = x;
        else runs.push([x, x]);
      }
      out[z][y] = runs;
    }
  }
  return out;
};

const coveredKeys = (index) => {
  const out = [];
  for (const [z, byRow] of Object.entries(index))
    for (const [y, runs] of Object.entries(byRow))
      for (const [x0, x1] of runs)
        for (let x = x0; x <= x1; x += 1) out.push(key(+z, x, +y));
  return out;
};

// ---------------------------------------------------------------------------
// Recipe: what the published tiles keep (docs/PA_BASEMAP.md "Layer contract")

/** Bump when the recipe changes; it is part of the build id. */
const RECIPE = 1;
const EXTENT = 4096;

/**
 * The published source-layers and the attributes each keeps. Protomaps
 * layers not listed (buildings, pois, landuse, landcover, earth, transit) are
 * dropped: the atlas paints land as its paper and needs only water, streets,
 * places and the state and county lines.
 */
const LAYERS = {
  water: ['kind', 'name'],
  roads: ['kind', 'kind_detail', 'name', 'ref'],
  places: ['kind', 'kind_detail', 'name', 'min_zoom', 'population_rank'],
  boundaries: ['kind'],
};
const GEOMETRY = { 1: 'Point', 2: 'LineString', 3: 'Polygon' };

const ROAD_KINDS = new Set(['highway', 'major_road', 'minor_road']);
/** Driveways, parking aisles and alleys: too many, never a street address. */
const ROAD_DETAILS_DROPPED = new Set(['service', 'alley', 'driveway']);
const PLACE_KINDS = new Set(['locality', 'neighbourhood', 'region']);
const BOUNDARY_KINDS = new Set(['region', 'county']);
const WATER_DROPPED = new Set(['swimming_pool']);

const keepFeature = (layer, f) => {
  const p = f.properties;
  switch (layer) {
    case 'water':
      return !WATER_DROPPED.has(p.kind);
    case 'roads':
      return ROAD_KINDS.has(p.kind) && !ROAD_DETAILS_DROPPED.has(p.kind_detail);
    case 'places':
      return f.type === 1 && PLACE_KINDS.has(p.kind) && Boolean(labelName(p));
    case 'boundaries':
      return f.type === 2 && BOUNDARY_KINDS.has(p.kind);
    default:
      return false;
  }
};

let glyphRanges;
/** The 256-codepoint ranges T3 publishes for the city fontstack (data/map-fonts.json). */
const publishedRanges = () => {
  if (!glyphRanges) {
    const fonts = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/map-fonts.json'), 'utf8'),
    );
    glyphRanges = new Set(
      Object.keys(fonts.glyphs.fontstacks['Alegreya Regular'].ranges).map((r) =>
        Number(r.split('-')[0]),
      ),
    );
  }
  return glyphRanges;
};

/** True when every character has a published glyph range (no 404 for a glyph PBF). */
const drawable = (text) =>
  [...text].every((ch) =>
    publishedRanges().has(Math.floor(ch.codePointAt(0) / 256) * 256),
  );

/** The local name, or the English one when the local script has no glyphs here. */
const labelName = (properties) => {
  for (const candidate of [properties.name, properties['name:en']])
    if (typeof candidate === 'string' && candidate && drawable(candidate))
      return candidate;
  return undefined;
};

const slimProperties = (layer, f) => {
  const out = {};
  for (const name of LAYERS[layer]) {
    const value =
      name === 'name' ? labelName(f.properties) : f.properties[name];
    if (value === undefined || value === null || value === '') continue;
    // Names label points and lines only; water polygons are painted, not named.
    if (name === 'name' && layer === 'water' && f.type === 3) continue;
    // Route numbers only where the style prints them.
    if (name === 'ref' && f.properties.kind === 'minor_road') continue;
    out[name] = value;
  }
  return out;
};

/** Decodes a cached tile into { layer: [{ type, properties, geometry }] } (tile units). */
const decodeTile = (buffer) => {
  const { VectorTile } = require('@mapbox/vector-tile');
  const Pbf = require('pbf');
  const tile = new VectorTile(new Pbf(buffer));
  const out = {};
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (!LAYERS[name]) continue;
    const scale = EXTENT / layer.extent;
    const features = [];
    for (let i = 0; i < layer.length; i += 1) {
      const f = layer.feature(i);
      if (!keepFeature(name, f)) continue;
      const geometry = f
        .loadGeometry()
        .map((ring) => ring.map((p) => [p.x * scale, p.y * scale]));
      features.push({
        type: f.type,
        properties: slimProperties(name, f),
        geometry,
      });
    }
    out[name] = features;
  }
  return out;
};

/** Squared distance from p to segment ab. */
const segDist2 = (p, a, b) => {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
};

/** Douglas-Peucker, iterative. */
const simplify = (points, tolerance) => {
  if (points.length <= 2 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = 0;
    let index = 0;
    for (let i = first + 1; i < last; i += 1) {
      const d = segDist2(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > t2) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

/** Clips a polyline to [lo, hi]² (Liang-Barsky per segment); returns pieces. */
const clipLine = (points, lo, hi) => {
  const pieces = [];
  let current = null;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    let visible = true;
    for (const [p, q] of [
      [-dx, a[0] - lo],
      [dx, hi - a[0]],
      [-dy, a[1] - lo],
      [dy, hi - a[1]],
    ]) {
      if (p === 0) {
        if (q < 0) visible = false;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
    }
    if (!visible || t0 > t1) {
      current = null;
      continue;
    }
    const start = t0 === 0 ? a : [a[0] + t0 * dx, a[1] + t0 * dy];
    const end = t1 === 1 ? b : [a[0] + t1 * dx, a[1] + t1 * dy];
    if (!current || t0 > 0) {
      current = [start];
      pieces.push(current);
    }
    current.push(end);
    if (t1 < 1) current = null;
  }
  return pieces.filter((piece) => piece.length >= 2);
};

const signature = (properties) => JSON.stringify(properties);
const pointKey = ([x, y]) => `${x},${y}`;

/** Joins lines with identical properties that meet end to start (greedy). */
const joinLines = (features) => {
  const groups = new Map();
  for (const f of features) {
    const s = signature(f.properties);
    if (!groups.has(s)) groups.set(s, []);
    for (const line of f.geometry) groups.get(s).push(line);
  }
  const out = [];
  for (const [s, lines] of groups) {
    const properties = JSON.parse(s);
    const byStart = new Map();
    const used = new Set();
    lines.forEach((line, i) => {
      const k = pointKey(line[0]);
      if (!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(i);
    });
    const hasPredecessor = new Set();
    lines.forEach((line) => {
      for (const j of byStart.get(pointKey(line[line.length - 1])) ?? [])
        hasPredecessor.add(j);
    });
    const order = lines
      .map((_, i) => i)
      .sort((a, b) => hasPredecessor.has(a) - hasPredecessor.has(b));
    for (const i of order) {
      if (used.has(i)) continue;
      used.add(i);
      const merged = [...lines[i]];
      for (;;) {
        const next = (
          byStart.get(pointKey(merged[merged.length - 1])) ?? []
        ).find((j) => !used.has(j));
        if (next === undefined) break;
        used.add(next);
        merged.push(...lines[next].slice(1));
      }
      out.push({ type: 2, properties, geometry: [merged] });
    }
  }
  return out;
};

const roundLine = (points) => {
  const out = [];
  for (const [x, y] of points) {
    const p = [Math.round(x), Math.round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
};

/**
 * The roads of a parent tile rebuilt from its descendants at `detailZoom`:
 * Protomaps names residential streets only from z14, so a z12 or z13 tile
 * carries z14's streets, clipped to each child's own square (no buffer
 * duplicates), joined across child edges, simplified to `tolerance` parent
 * units and quantized to the parent's grid.
 */
const mergedRoads = (parent, detailZoom, readChild, tolerance) => {
  const span = 2 ** (detailZoom - parent.z);
  const pieces = [];
  for (let ox = 0; ox < span; ox += 1)
    for (let oy = 0; oy < span; oy += 1) {
      const child = readChild(parent.x * span + ox, parent.y * span + oy);
      for (const f of child?.roads ?? []) {
        if (f.type !== 2) continue;
        const geometry = [];
        for (const line of f.geometry)
          for (const piece of clipLine(line, 0, EXTENT))
            geometry.push(
              piece.map(([x, y]) => [
                (ox * EXTENT + x) / span,
                (oy * EXTENT + y) / span,
              ]),
            );
        if (geometry.length) pieces.push({ ...f, geometry });
      }
    }
  return joinLines(pieces).flatMap((f) => {
    const geometry = f.geometry
      .map((line) => roundLine(simplify(line, tolerance)))
      .filter((line) => line.length >= 2);
    return geometry.length ? [{ ...f, geometry }] : [];
  });
};

/** Signed shoelace area of a ring in tile units² (y down: MVT exteriors are positive). */
const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1)
    sum += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
  return sum / 2;
};

/**
 * Drops water polygons smaller than `minArea` tile units². An MVT polygon is
 * a list of exterior rings, each followed by its holes, so rings are grouped
 * by the exterior's winding and each group is kept or dropped as a whole.
 * Protomaps packs every lake of a tile into one MultiPolygon, so this must
 * work per ring, not per feature. Ponds a few pixels across do not help
 * anyone find their district and are most of the low-zoom bytes.
 */
const dropSmallWater = (layers, minArea) => {
  if (!layers.water || !minArea) return layers;
  const water = [];
  for (const f of layers.water) {
    if (f.type !== 3) {
      water.push(f);
      continue;
    }
    const exteriorSign = Math.sign(signedArea(f.geometry[0]) || 1);
    const kept = [];
    let keepGroup = false;
    for (const ring of f.geometry) {
      const area = signedArea(ring);
      if (Math.sign(area) === exteriorSign)
        keepGroup = Math.abs(area) >= minArea;
      if (keepGroup) kept.push(ring);
    }
    if (kept.length) water.push({ ...f, geometry: kept });
  }
  return { ...layers, water };
};

/** Encodes { layer: features } as an MVT v2 tile (vt-pbf). */
const encodeTile = (layers) => {
  const vtpbf = require('vt-pbf');
  const tile = { layers: {} };
  for (const name of Object.keys(LAYERS)) {
    const features = (layers[name] ?? []).filter((f) => f.geometry.length);
    if (!features.length) continue;
    tile.layers[name] = {
      name,
      version: 2,
      extent: EXTENT,
      length: features.length,
      feature: (i) => ({
        type: features[i].type,
        properties: features[i].properties,
        id: undefined,
        loadGeometry: () =>
          features[i].geometry.map((ring) =>
            ring.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) })),
          ),
      }),
    };
  }
  return Buffer.from(vtpbf.fromVectorTileJs(tile));
};

// ---------------------------------------------------------------------------
// Validation (offline; part of `yarn data:validate`)

const BUDGETS = {
  /** All PA tiles. The whole deployable tree is gated at 16,000 by `yarn size:check`. */
  files: 4500,
  bytesTotal: 48 * MiB,
  bytesLargest: 256 * KiB,
  maxFileBytes: 25 * MiB,
};

/** Allowed geometry types per source-layer (MVT: 1 point, 2 line, 3 polygon). */
const LAYER_TYPES = {
  water: [1, 2, 3],
  roads: [2],
  places: [1],
  boundaries: [2],
};

const TILE_PATH = /^(\d+)\/(\d+)\/(\d+)\.pbf$/;

const listTree = (dir) => {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else out.push(path.relative(dir, file).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
};

/** Checks one decoded tile against the layer contract; returns error strings. */
const checkTileContract = (rel, buffer) => {
  const { VectorTile } = require('@mapbox/vector-tile');
  const Pbf = require('pbf');
  const errors = [];
  let tile;
  try {
    tile = new VectorTile(new Pbf(buffer));
  } catch (error) {
    return [`${rel}: does not decode (${error.message})`];
  }
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (!LAYERS[name]) {
      errors.push(`${rel}: unexpected layer ${name}`);
      continue;
    }
    if (layer.extent !== EXTENT)
      errors.push(`${rel}: ${name} extent ${layer.extent}`);
    for (let i = 0; i < layer.length; i += 1) {
      const f = layer.feature(i);
      if (!LAYER_TYPES[name].includes(f.type))
        errors.push(`${rel}: ${name} has a ${GEOMETRY[f.type] ?? f.type}`);
      for (const prop of Object.keys(f.properties))
        if (!LAYERS[name].includes(prop))
          errors.push(`${rel}: ${name} has attribute ${prop}`);
      if (typeof f.properties.kind !== 'string')
        errors.push(`${rel}: ${name} feature without a kind`);
      if (
        f.properties.name !== undefined &&
        !drawable(String(f.properties.name))
      )
        errors.push(
          `${rel}: "${f.properties.name}" needs a glyph range T3 does not publish`,
        );
      if (errors.length > 20) return errors;
    }
  }
  return errors;
};

function validatePaBasemap({ root = ROOT, budgets = BUDGETS } = {}) {
  const errors = [];
  const read = (rel) =>
    JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  const sources = read(PATHS.sources);
  const manifest = read(PATHS.manifest);
  const pin = sources.archive;
  if (
    manifest.source?.url !== pin.url ||
    manifest.source?.etag !== pin.etag ||
    manifest.source?.buildDate !== pin.buildDate
  )
    errors.push('manifest: source does not match data/pa-basemap-sources.json');
  const expectedId = `pm-${pin.buildDate.replace(/-/g, '')}-r${RECIPE}`;
  if (manifest.buildId !== expectedId)
    errors.push(
      `manifest: buildId ${manifest.buildId}, expected ${expectedId}`,
    );
  if (manifest.recipe !== RECIPE)
    errors.push(
      `manifest: recipe ${manifest.recipe}, scripts are at ${RECIPE}`,
    );
  if (
    !/OpenStreetMap/.test(manifest.attribution ?? '') ||
    !/ODbL/.test(manifest.license ?? '')
  )
    errors.push('manifest: the ODbL attribution must name OpenStreetMap');
  if (manifest.tiles?.url !== `/tiles/pa/${manifest.buildId}/{z}/{x}/{y}.pbf`)
    errors.push(
      'manifest: tiles.url must be /tiles/pa/<buildId>/{z}/{x}/{y}.pbf',
    );
  const treeRoot = path.join(root, PATHS.treeRoot);
  const builds = fs.existsSync(treeRoot) ? fs.readdirSync(treeRoot) : [];
  if (builds.length !== 1 || builds[0] !== manifest.buildId)
    errors.push(
      `${PATHS.treeRoot}: expected only ${manifest.buildId}, found ${builds.join(', ') || 'nothing'}`,
    );

  const dir = path.join(treeRoot, manifest.buildId);
  const files = listTree(dir);
  const covered = new Set(
    coveredKeys(manifest.coverage ?? {}).map((k) => `${k}.pbf`),
  );
  const records = [];
  let largest = 0;
  for (const rel of files) {
    const match = TILE_PATH.exec(rel);
    if (!match) {
      errors.push(`tiles: unexpected file ${rel}`);
      continue;
    }
    const [z, x, y] = match.slice(1).map(Number);
    if (z > manifest.tiles.maxzoom || x >= 2 ** z || y >= 2 ** z)
      errors.push(`tiles: ${rel} is outside z0-${manifest.tiles.maxzoom}`);
    if (!covered.has(rel))
      errors.push(`tiles: ${rel} is not in the coverage index`);
    const buffer = fs.readFileSync(path.join(dir, rel));
    if (buffer.length > budgets.maxFileBytes)
      errors.push(`tiles: ${rel} exceeds the 25 MiB per-file limit`);
    largest = Math.max(largest, buffer.length);
    records.push({ rel, bytes: buffer.length, sha256: sha256(buffer) });
    errors.push(...checkTileContract(rel, buffer));
    if (errors.length > 50) break;
  }
  for (const rel of covered)
    if (!fs.existsSync(path.join(dir, rel)))
      errors.push(`tiles: covered tile ${rel} is missing`);
  const bytes = records.reduce((total, r) => total + r.bytes, 0);
  if (records.length !== manifest.tiles.files)
    errors.push(
      `tiles: ${records.length} files, manifest says ${manifest.tiles.files}`,
    );
  if (bytes !== manifest.tiles.bytes)
    errors.push(`tiles: ${bytes} bytes, manifest says ${manifest.tiles.bytes}`);
  if (treeDigest(records) !== manifest.tiles.digest)
    errors.push(
      'tiles: digest does not match the manifest (run yarn data:refresh:pa-basemap)',
    );
  if (records.length > budgets.files)
    errors.push(`budget: ${records.length} PA tiles exceeds ${budgets.files}`);
  if (bytes > budgets.bytesTotal)
    errors.push(
      `budget: ${(bytes / MiB).toFixed(1)} MiB of PA tiles exceeds ${budgets.bytesTotal / MiB} MiB`,
    );
  if (largest > budgets.bytesLargest)
    errors.push(
      `budget: largest PA tile ${(largest / KiB).toFixed(0)} KiB exceeds ${budgets.bytesLargest / KiB} KiB`,
    );
  return { errors, files: records.length, bytes, largest };
}

module.exports = {
  BUDGETS,
  LAYER_TYPES,
  checkTileContract,
  validatePaBasemap,
  EXTENT,
  GEOMETRY,
  LAYERS,
  RECIPE,
  decodeTile,
  drawable,
  dropSmallWater,
  encodeTile,
  signedArea,
  mergedRoads,
  simplify,
  clipLine,
  joinLines,
  KiB,
  MiB,
  PATHS,
  ROOT,
  bboxTiles,
  coverageIndex,
  coveredKeys,
  key,
  latToY,
  lonToX,
  parseKey,
  sha256,
  stateTiles,
  tileBounds,
  treeDigest,
  xToLon,
  yToLat,
};
