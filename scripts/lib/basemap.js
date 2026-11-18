'use strict';

// Shared code for the first-party physical basemap (docs/BASEMAP.md):
// geometry preparation used by `yarn data:refresh:basemap`, and the offline
// rules used by `yarn data:validate:basemap`. Everything here is pure or reads
// local files only; the network step lives in scripts/refresh-basemap.js.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/** Bump the `-rN` suffix whenever the recipe changes the published bytes. */
const BUILD_ID = 'ne-5.1.2-r1';
/** Chosen by measurement; see docs/BASEMAP.md "Max zoom". */
const MAX_ZOOM = 5;
const TILE = { extent: 4096, buffer: 64, tolerance: 3 };

const PATHS = {
  sources: 'data/basemap-sources.json',
  manifest: 'data/basemap-manifest.json',
  tilesRoot: 'public/tiles/basemap',
  assetsRoot: 'public/basemap',
};
const tilesDir = (buildId = BUILD_ID) => `${PATHS.tilesRoot}/${buildId}`;
const assetsDir = (buildId = BUILD_ID) => `${PATHS.assetsRoot}/${buildId}`;

/**
 * The layer contract the MapLibre style consumes. `attributes` are required on
 * every feature; `optional` may be absent. Geometry is the MVT geometry type.
 */
const LAYERS = {
  ocean: {
    geometry: 'Polygon',
    attributes: {},
    optional: {},
    description:
      'Ocean mask: the world minus Natural Earth land, cut on the z3 tile grid. Paint above territory fills.',
  },
  coast: {
    geometry: 'LineString',
    attributes: { landmass_km2: 'number' },
    optional: {},
    description:
      'Coastlines from land rings, water on the right: a positive line-offset moves seaward.',
  },
  lakes: {
    geometry: 'Polygon',
    attributes: { rank: 'number' },
    optional: { name: 'string' },
    description:
      'Natural Earth lakes and reservoirs. Paint above territory fills.',
  },
  rivers: {
    geometry: 'LineString',
    attributes: { rank: 'number' },
    optional: { name: 'string' },
    description:
      'Major rivers (Natural Earth River class, lake centerlines excluded).',
  },
  marine_labels: {
    geometry: 'Point',
    attributes: { name: 'string', kind: 'string', rank: 'number' },
    optional: {},
    description:
      'One label point per sea or ocean, at the pole of inaccessibility.',
  },
};
const GEOMETRY_TYPES = { 1: 'Point', 2: 'LineString', 3: 'Polygon' };

const MiB = 1024 * 1024;
const KiB = 1024;
/**
 * Budgets. Workers Static Assets allows 20,000 files per deployment and
 * 25 MiB per file; the repository gate is 16,000 files so the PA street tree
 * (~10k files) and rollback assets still fit. The basemap takes at most 1,500.
 */
const BUDGETS = {
  deploymentFileLimit: 20000,
  repositoryFileGate: 16000,
  basemapFiles: 1500,
  tileBytesTotal: 3 * MiB,
  tileBytesLargest: 80 * KiB,
  reliefBytes: 900 * KiB,
  globeBytes: 160 * KiB,
  maxFileBytes: 25 * MiB,
};

const sha256 = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

// ---------------------------------------------------------------------------
// Geometry

const polygonsOf = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

/** Shoelace sum in lon/lat; > 0 means clockwise. */
const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return sum;
};

/** RFC 7946 winding: exterior counter-clockwise, holes clockwise. */
const rewindPolygon = (rings) =>
  rings.map((ring, index) => {
    const clockwise = signedArea(ring) > 0;
    return (index === 0 ? clockwise : !clockwise)
      ? ring.slice().reverse()
      : ring;
  });

/** Geodesic area in km², using @turf/area (spherical excess). */
const polygonAreaKm2 = (rings) => {
  const turfArea = require('@turf/area').default || require('@turf/area');
  return turfArea({ type: 'Polygon', coordinates: rings }) / 1e6;
};

const EDGE_EPSILON = 1e-4;
/**
 * Natural Earth closes land polygons along the antimeridian and along the
 * south pole. Those edges are not coastline and must not be stroked.
 */
const isArtificialEdge = ([x0, y0], [x1, y1]) =>
  (Math.abs(x0) >= 180 - EDGE_EPSILON &&
    Math.abs(x1) >= 180 - EDGE_EPSILON &&
    Math.sign(x0) === Math.sign(x1)) ||
  (y0 <= -90 + 0.01 && y1 <= -90 + 0.01);

/** Splits a closed ring into the runs that are real coastline. */
const coastRuns = (ring) => {
  const segments = ring.length - 1;
  if (segments < 1) return [];
  const artificial = [];
  for (let i = 0; i < segments; i++)
    artificial.push(isArtificialEdge(ring[i], ring[i + 1]));
  const first = artificial.indexOf(true);
  if (first === -1) return [ring.slice()];
  const runs = [];
  let run = [];
  for (let step = 1; step <= segments; step++) {
    const i = (first + step) % segments;
    if (artificial[i]) {
      if (run.length >= 2) runs.push(run);
      run = [];
      continue;
    }
    if (!run.length) run.push(ring[i]);
    run.push(ring[i + 1]);
  }
  if (run.length >= 2) runs.push(run);
  return runs;
};

/**
 * Coastline features tagged with the area of the landmass they bound, so the
 * style can draw waterlines only around landmasses of at least 5,000 km².
 * Rings are wound per RFC 7946, so water is always on the right-hand side.
 */
const coastFeatures = (landPolygons) =>
  landPolygons.flatMap((polygon) => {
    const rings = rewindPolygon(polygon);
    const landmassKm2 = Math.max(1, Math.round(polygonAreaKm2(rings)));
    return rings.flatMap((ring) =>
      coastRuns(ring).map((coordinates) => ({
        type: 'Feature',
        properties: { landmass_km2: landmassKm2 },
        geometry: { type: 'LineString', coordinates },
      })),
    );
  });

const mercatorLat = (y, z) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/**
 * Ocean-mask cells on the z3 tile grid (45° of longitude by one Mercator tile
 * row). At z3 and above a cell edge is a tile edge, which MapLibre's stencil
 * clipping hides, so the mask shows no seams where territories overrun water.
 */
const oceanCells = (z = 3) => {
  const n = 2 ** z;
  const lats = Array.from({ length: n + 1 }, (_, y) =>
    y === 0 ? 90 : y === n ? -90 : mercatorLat(y, z),
  );
  const cells = [];
  for (let x = 0; x < n; x++) {
    const west = -180 + (360 / n) * x;
    const east = -180 + (360 / n) * (x + 1);
    for (let y = 0; y < n; y++) {
      const north = lats[y];
      const south = lats[y + 1];
      cells.push([
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ]);
    }
  }
  return cells;
};

const bboxOf = (polygon) =>
  polygon[0].reduce(
    (box, [x, y]) => [
      Math.min(box[0], x),
      Math.min(box[1], y),
      Math.max(box[2], x),
      Math.max(box[3], y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );

/** The world minus land, cell by cell. Returns RFC 7946 polygons. */
const oceanPolygons = (landPolygons, cells = oceanCells()) => {
  const martinez = require('martinez-polygon-clipping');
  const boxes = landPolygons.map(bboxOf);
  const result = [];
  for (const cell of cells) {
    const [w, s, e, n] = bboxOf(cell);
    const hits = landPolygons.filter(
      (_, i) =>
        boxes[i][0] < e &&
        boxes[i][2] > w &&
        boxes[i][1] < n &&
        boxes[i][3] > s,
    );
    const pieces = hits.length ? martinez.diff(cell, hits) : [cell];
    for (const piece of pieces || []) {
      const rings = piece.filter((ring) => ring.length >= 4);
      if (rings.length) result.push(rewindPolygon(rings));
    }
  }
  return result;
};

const titleCase = (value) =>
  value
    .toLowerCase()
    .replace(
      /(^|[\s(-])(\p{L})/gu,
      (_, lead, letter) => lead + letter.toUpperCase(),
    )
    .replace(/\b(Of|The|And|De|Du)\b/g, (word, _w, offset) =>
      offset === 0 ? word : word.toLowerCase(),
    );

const round = (value, digits) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Sea and ocean label points: the pole of inaccessibility of each feature's
 * largest polygon. Overrides (by Natural Earth name) rename or move a label,
 * for example the Atlantic into the European view.
 */
const marineLabelFeatures = (marine, { maxRank, overrides = {} }) => {
  const polylabel = require('polylabel');
  return marine.features
    .filter((f) => f.properties.name && f.properties.scalerank <= maxRank)
    .map((f) => {
      const source = f.properties.name.trim();
      const override = overrides[source] || {};
      let coordinates = override.coordinates;
      if (!coordinates) {
        const largest = polygonsOf(f.geometry).reduce((a, b) =>
          Math.abs(signedArea(b[0])) > Math.abs(signedArea(a[0])) ? b : a,
        );
        const point = polylabel(largest, 0.5);
        coordinates = [round(point[0], 2), round(point[1], 2)];
      }
      return {
        type: 'Feature',
        properties: {
          name: override.name || titleCase(source),
          kind: String(f.properties.featurecla).toLowerCase(),
          rank: f.properties.scalerank,
        },
        geometry: { type: 'Point', coordinates },
      };
    })
    .sort(
      (a, b) =>
        a.properties.rank - b.properties.rank ||
        a.properties.name.localeCompare(b.properties.name),
    );
};

const featureCollection = (features) => ({
  type: 'FeatureCollection',
  features,
});

/**
 * First tile zoom that carries a lake or river. Natural Earth's `min_zoom`
 * assumes 256 px tiles; MapLibre draws 512 px tile z from map zoom z, so a
 * feature enters the tiles two levels before Natural Earth's suggestion and
 * the style can still fade it in exactly where it wants. Missing hints keep
 * the feature everywhere.
 */
const firstTileZoom = (naturalEarthMinZoom) =>
  Number.isFinite(naturalEarthMinZoom)
    ? Math.max(0, Math.ceil(naturalEarthMinZoom) - 2)
    : 0;

// ---------------------------------------------------------------------------
// Small binary readers used by the refresh (zip) and the validator (WebP).

/** Extracts one entry from a zip archive held in memory (stored or deflate). */
const readZipEntry = (buffer, name) => {
  const zlib = require('zlib');
  let eocd = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip: end of central directory not found');
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error('zip: bad central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString(
      'utf8',
      offset + 46,
      offset + 46 + nameLength,
    );
    offset += 46 + nameLength + extraLength + commentLength;
    if (entryName !== name) continue;
    const localName = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const data = buffer.subarray(start, start + compressedSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return zlib.inflateRawSync(data);
    throw new Error(`zip: unsupported compression method ${method}`);
  }
  throw new Error(`zip: ${name} not found`);
};

/** Width and height of a WebP file, from its RIFF header. */
const webpSize = (buffer) => {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  )
    throw new Error('not a WebP file');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X')
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
      alpha: Boolean(buffer[20] & 0x10),
    };
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
      alpha: true,
    };
  }
  if (chunk === 'VP8 ')
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      alpha: false,
    };
  throw new Error(`unknown WebP chunk ${chunk}`);
};

// ---------------------------------------------------------------------------
// Tile tree helpers

const walk = (directory) =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(entryPath) : [entryPath];
      })
    : [];

/** Lists a tile tree as sorted `{ rel, bytes, sha256 }` records. */
const listTree = (directory) =>
  walk(directory)
    .map((file) => {
      const buffer = fs.readFileSync(file);
      return {
        rel: path.relative(directory, file).split(path.sep).join('/'),
        bytes: buffer.length,
        sha256: sha256(buffer),
      };
    })
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

/** One hash for a whole tree: sha256 over sorted "path sha256" lines. */
const treeDigest = (records) =>
  sha256(records.map((r) => `${r.rel} ${r.sha256}\n`).join(''));

const TILE_PATH = /^(\d+)\/(\d+)\/(\d+)\.pbf$/;

const zoomStats = (records) => {
  const stats = {};
  for (const record of records) {
    const match = TILE_PATH.exec(record.rel);
    if (!match) continue;
    const z = match[1];
    stats[z] = stats[z] || { tiles: 0, bytes: 0, largest: 0 };
    stats[z].tiles += 1;
    stats[z].bytes += record.bytes;
    stats[z].largest = Math.max(stats[z].largest, record.bytes);
  }
  return stats;
};

/** Decodes an MVT buffer into `{ layer: [{ type, properties }] }`. */
const decodeTile = (buffer) => {
  const { VectorTile } = require('@mapbox/vector-tile');
  const Pbf = require('pbf');
  const tile = new VectorTile(new Pbf(buffer));
  const layers = {};
  for (const [name, layer] of Object.entries(tile.layers)) {
    layers[name] = [];
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      layers[name].push({
        type: GEOMETRY_TYPES[feature.type] || 'Unknown',
        properties: feature.properties,
        extent: layer.extent,
      });
    }
  }
  return layers;
};

// ---------------------------------------------------------------------------
// Validation rules. Each returns an array of error strings; empty means valid.

const HEX64 = /^[0-9a-f]{64}$/;

const validateSources = (sources) => {
  const errors = [];
  if (!sources || typeof sources !== 'object')
    return ['sources: not an object'];
  if (!/^\d+\.\d+\.\d+$/.test(sources.naturalEarthVersion || ''))
    errors.push('sources: naturalEarthVersion must be an exact x.y.z release');
  if (!/public domain/i.test(sources.license || ''))
    errors.push('sources: license must state Natural Earth public domain');
  const entries = Object.entries(sources.files || {});
  if (!entries.length) errors.push('sources: no files pinned');
  for (const [name, file] of entries) {
    if (!/^https:\/\//.test(file.url || ''))
      errors.push(`${name}: url must be https`);
    else if (
      file.url.includes('raw.githubusercontent.com') &&
      !file.url.includes(`/v${sources.naturalEarthVersion}/`)
    )
      errors.push(
        `${name}: GitHub url must be pinned to tag v${sources.naturalEarthVersion}`,
      );
    if (!HEX64.test(file.sha256 || ''))
      errors.push(`${name}: sha256 missing or malformed`);
    if (!Number.isInteger(file.bytes) || file.bytes <= 0)
      errors.push(`${name}: bytes must be a positive integer`);
  }
  return errors;
};

/** The manifest must have been generated from exactly the pinned sources. */
const validateProvenance = (manifest, sources) => {
  const errors = [];
  for (const [name, file] of Object.entries(sources.files || {})) {
    if (manifest.sources?.[name] !== file.sha256)
      errors.push(`manifest: ${name} was not built from the pinned sha256`);
  }
  for (const name of Object.keys(manifest.sources || {}))
    if (!sources.files?.[name]) errors.push(`manifest: unknown source ${name}`);
  return errors;
};

/**
 * Validates a tile tree listing against the manifest and budgets:
 * only `{z}/{x}/{y}.pbf` files, a complete pyramid z0..maxzoom (the ocean mask
 * makes every tile non-empty, and a missing tile would show territory fill in
 * the sea), per-zoom counts and the tree digest matching the manifest.
 */
const validateTileTree = (records, manifest, budgets = BUDGETS) => {
  const errors = [];
  const maxzoom = manifest.tiles?.maxzoom;
  if (!Number.isInteger(maxzoom) || maxzoom < 0 || maxzoom > 14)
    return ['manifest: tiles.maxzoom must be an integer in 0..14'];
  const seen = new Set();
  for (const record of records) {
    const match = TILE_PATH.exec(record.rel);
    if (!match) {
      errors.push(`tiles: unexpected file ${record.rel}`);
      continue;
    }
    const [z, x, y] = match.slice(1).map(Number);
    if (z > maxzoom || x >= 2 ** z || y >= 2 ** z)
      errors.push(`tiles: ${record.rel} is outside z0-${maxzoom}`);
    else seen.add(`${z}/${x}/${y}`);
    if (record.bytes > budgets.maxFileBytes)
      errors.push(`tiles: ${record.rel} exceeds the 25 MiB per-file limit`);
    if (record.bytes > budgets.tileBytesLargest)
      errors.push(
        `tiles: ${record.rel} is ${record.bytes} B, over the ${budgets.tileBytesLargest} B tile budget`,
      );
    if (record.bytes === 0) errors.push(`tiles: ${record.rel} is empty`);
  }
  let missing = 0;
  for (let z = 0; z <= maxzoom; z++)
    for (let x = 0; x < 2 ** z; x++)
      for (let y = 0; y < 2 ** z; y++)
        if (!seen.has(`${z}/${x}/${y}`)) missing += 1;
  if (missing)
    errors.push(
      `tiles: ${missing} tiles missing from the z0-${maxzoom} pyramid`,
    );

  const stats = zoomStats(records);
  for (let z = 0; z <= maxzoom; z++) {
    const expected = manifest.tiles?.zooms?.[z];
    const actual = stats[z] || { tiles: 0, bytes: 0 };
    if (
      !expected ||
      expected.tiles !== actual.tiles ||
      expected.bytes !== actual.bytes
    )
      errors.push(
        `tiles: z${z} has ${actual.tiles} files / ${actual.bytes} B, manifest says ${expected ? `${expected.tiles} / ${expected.bytes}` : 'nothing'}`,
      );
  }
  const total = records.reduce((sum, r) => sum + r.bytes, 0);
  if (total > budgets.tileBytesTotal)
    errors.push(
      `tiles: ${total} B exceeds the ${budgets.tileBytesTotal} B budget`,
    );
  if (manifest.tiles?.digest !== treeDigest(records))
    errors.push(
      'tiles: tree digest does not match the manifest (tiles changed without a refresh)',
    );
  return errors;
};

/**
 * Checks decoded tiles against the layer contract: no unknown layers, every
 * contract layer present somewhere and in the z0 tile, correct geometry type
 * and attribute types, and coastline landmass areas that are positive.
 */
const validateLayers = (decodedTiles, contract = LAYERS) => {
  const errors = [];
  const present = new Set();
  const report = (message) => {
    if (errors.length < 50) errors.push(message);
  };
  for (const { rel, layers } of decodedTiles) {
    for (const [name, features] of Object.entries(layers)) {
      const spec = contract[name];
      if (!spec) {
        report(`layers: ${rel} has unknown layer ${name}`);
        continue;
      }
      if (features.length) present.add(name);
      for (const feature of features) {
        if (feature.type !== spec.geometry)
          report(
            `layers: ${rel} ${name} has ${feature.type}, expected ${spec.geometry}`,
          );
        for (const [key, type] of Object.entries(spec.attributes))
          if (typeof feature.properties[key] !== type)
            report(`layers: ${rel} ${name} feature lacks ${type} ${key}`);
        for (const [key, type] of Object.entries(spec.optional))
          if (
            key in feature.properties &&
            typeof feature.properties[key] !== type
          )
            report(`layers: ${rel} ${name}.${key} must be a ${type}`);
        const allowed = new Set([
          ...Object.keys(spec.attributes),
          ...Object.keys(spec.optional),
        ]);
        for (const key of Object.keys(feature.properties))
          if (!allowed.has(key))
            report(`layers: ${rel} ${name} has undocumented attribute ${key}`);
        if (name === 'coast' && !(feature.properties.landmass_km2 > 0))
          report(`layers: ${rel} coast landmass_km2 must be positive`);
      }
    }
  }
  for (const name of Object.keys(contract))
    if (!present.has(name))
      errors.push(`layers: required layer ${name} is missing from every tile`);
  const root = decodedTiles.find((t) => t.rel === '0/0/0.pbf');
  if (!root) errors.push('layers: 0/0/0.pbf is missing');
  else
    for (const name of Object.keys(contract))
      if (!root.layers[name]?.length)
        errors.push(`layers: 0/0/0.pbf lacks ${name}`);
  return errors;
};

/** Relief image and globe file against the manifest and budgets. */
const validateAssets = (assets, manifest, budgets = BUDGETS) => {
  const errors = [];
  const relief = assets['relief.webp'];
  const expectedRelief = manifest.relief;
  if (!relief) errors.push('assets: relief.webp is missing');
  else {
    try {
      const size = webpSize(relief);
      if (
        size.width !== expectedRelief?.width ||
        size.height !== expectedRelief?.height
      )
        errors.push(
          `assets: relief.webp is ${size.width}x${size.height}, manifest says ${expectedRelief?.width}x${expectedRelief?.height}`,
        );
      if (!size.alpha)
        errors.push('assets: relief.webp must have an alpha channel');
    } catch (error) {
      errors.push(`assets: relief.webp ${error.message}`);
    }
    if (relief.length > budgets.reliefBytes)
      errors.push(
        `assets: relief.webp is ${relief.length} B, over the ${budgets.reliefBytes} B budget`,
      );
    if (sha256(relief) !== expectedRelief?.sha256)
      errors.push('assets: relief.webp does not match the manifest sha256');
    const c = expectedRelief?.coordinates;
    if (
      !Array.isArray(c) ||
      c.length !== 4 ||
      c[0][0] !== -180 ||
      c[1][0] !== 180
    )
      errors.push(
        'assets: relief coordinates must span -180..180 (TL, TR, BR, BL)',
      );
  }
  const globe = assets['land-110m.geojson'];
  if (!globe) errors.push('assets: land-110m.geojson is missing');
  else {
    if (globe.length > budgets.globeBytes)
      errors.push(
        `assets: land-110m.geojson is ${globe.length} B, over the ${budgets.globeBytes} B budget`,
      );
    if (sha256(globe) !== manifest.globe?.sha256)
      errors.push(
        'assets: land-110m.geojson does not match the manifest sha256',
      );
    try {
      const json = JSON.parse(globe.toString('utf8'));
      if (json.type !== 'FeatureCollection' || !json.features?.length)
        errors.push(
          'assets: land-110m.geojson must be a non-empty FeatureCollection',
        );
      else if (json.features.some((f) => f.geometry?.type !== 'Polygon'))
        errors.push(
          'assets: land-110m.geojson must contain only Polygon outer rings',
        );
    } catch {
      errors.push('assets: land-110m.geojson is not valid JSON');
    }
  }
  const tilejson = assets['tiles.json'];
  if (!tilejson) errors.push('assets: tiles.json is missing');
  else {
    try {
      const json = JSON.parse(tilejson.toString('utf8'));
      if (
        json.tiles?.[0] !== `/tiles/basemap/${manifest.buildId}/{z}/{x}/{y}.pbf`
      )
        errors.push(
          'assets: tiles.json tiles URL does not point at this build',
        );
      if (json.maxzoom !== manifest.tiles?.maxzoom)
        errors.push('assets: tiles.json maxzoom differs from the manifest');
      const ids = (json.vector_layers || []).map((l) => l.id).sort();
      if (JSON.stringify(ids) !== JSON.stringify(Object.keys(LAYERS).sort()))
        errors.push(
          'assets: tiles.json vector_layers differ from the layer contract',
        );
    } catch {
      errors.push('assets: tiles.json is not valid JSON');
    }
  }
  for (const [name, buffer] of Object.entries(assets))
    if (!['relief.webp', 'land-110m.geojson', 'tiles.json'].includes(name))
      errors.push(`assets: unexpected file ${name}`);
    else if (buffer.length > budgets.maxFileBytes)
      errors.push(`assets: ${name} exceeds 25 MiB`);
  return errors;
};

const validateFileBudget = (basemapFiles, budgets = BUDGETS) =>
  basemapFiles > budgets.basemapFiles
    ? [
        `budget: basemap ships ${basemapFiles} files, over its ${budgets.basemapFiles}-file share of the ${budgets.repositoryFileGate}-file gate`,
      ]
    : [];

/** Only the current build may be published; old builds must be removed. */
const validateBuildDirectories = (tileBuilds, assetBuilds, buildId) => {
  const errors = [];
  for (const [label, builds] of [
    ['tiles', tileBuilds],
    ['assets', assetBuilds],
  ]) {
    if (!builds.includes(buildId))
      errors.push(`${label}: build ${buildId} is missing`);
    for (const other of builds.filter((b) => b !== buildId))
      errors.push(`${label}: stale build directory ${other}`);
  }
  return errors;
};

const listDirectories = (directory) =>
  fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

const listFiles = (directory) =>
  fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
    : [];

/** Runs every rule against the committed files. */
const validateBasemap = (root = ROOT) => {
  const read = (rel) =>
    JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  const sources = read(PATHS.sources);
  const manifest = read(PATHS.manifest);
  const errors = [
    ...validateSources(sources),
    ...validateProvenance(manifest, sources),
  ];
  if (manifest.buildId !== BUILD_ID)
    errors.push(
      `manifest: buildId ${manifest.buildId} differs from the code's ${BUILD_ID}`,
    );
  errors.push(
    ...validateBuildDirectories(
      listDirectories(path.join(root, PATHS.tilesRoot)),
      listDirectories(path.join(root, PATHS.assetsRoot)),
      manifest.buildId,
    ),
  );
  const tileRoot = path.join(root, tilesDir(manifest.buildId));
  const records = listTree(tileRoot);
  errors.push(...validateTileTree(records, manifest));
  const decoded = [];
  for (const record of records) {
    if (!TILE_PATH.test(record.rel)) continue;
    try {
      decoded.push({
        rel: record.rel,
        layers: decodeTile(fs.readFileSync(path.join(tileRoot, record.rel))),
      });
    } catch (error) {
      errors.push(
        `tiles: ${record.rel} does not decode as MVT (${error.message})`,
      );
    }
  }
  errors.push(...validateLayers(decoded));
  const assetRoot = path.join(root, assetsDir(manifest.buildId));
  const assets = Object.fromEntries(
    listFiles(assetRoot).map((name) => [
      name,
      fs.readFileSync(path.join(assetRoot, name)),
    ]),
  );
  errors.push(...validateAssets(assets, manifest));
  const files = records.length + Object.keys(assets).length;
  errors.push(...validateFileBudget(files));
  return {
    errors,
    files,
    tileBytes: records.reduce((sum, r) => sum + r.bytes, 0),
    assetBytes: Object.values(assets).reduce((sum, b) => sum + b.length, 0),
  };
};

module.exports = {
  BUDGETS,
  BUILD_ID,
  LAYERS,
  MAX_ZOOM,
  PATHS,
  ROOT,
  TILE,
  assetsDir,
  coastFeatures,
  coastRuns,
  decodeTile,
  featureCollection,
  firstTileZoom,
  isArtificialEdge,
  listTree,
  marineLabelFeatures,
  mercatorLat,
  oceanCells,
  oceanPolygons,
  polygonAreaKm2,
  polygonsOf,
  readZipEntry,
  rewindPolygon,
  round,
  sha256,
  signedArea,
  tilesDir,
  titleCase,
  treeDigest,
  validateAssets,
  validateBasemap,
  validateBuildDirectories,
  validateFileBudget,
  validateLayers,
  validateProvenance,
  validateSources,
  validateTileTree,
  webpSize,
  zoomStats,
};
