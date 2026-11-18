'use strict';

// Explicit, network-using refresh of the Pennsylvania street basemap
// (docs/PA_BASEMAP.md). Never part of `yarn build`, tests or validation.
//
//   yarn data:refresh:pa-basemap            fetch missing tiles (cached), rebuild
//                                           data/pa-basemap/<build>/ and its manifest
//   yarn data:measure:pa-basemap            build every candidate in memory and print
//                                           the table behind the published recipe
//
// Tiles come from one pinned Protomaps daily build (data/pa-basemap-sources.json)
// over HTTP Range requests and are cached in PA_BASEMAP_CACHE_DIR (default
// .cache/pa-basemap/<build date>, gitignored). Pure Node: no Docker, no
// tippecanoe, no Go binary.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
  EXTENT,
  LAYERS,
  PATHS,
  RECIPE,
  ROOT,
  bboxTiles,
  coverageIndex,
  decodeTile,
  dropSmallWater,
  encodeTile,
  key,
  mergedRoads,
  parseKey,
  sha256,
  stateTiles,
  treeDigest,
} = require('./lib/pa-basemap');
const { fetchTiles } = require('./lib/pa-basemap-fetch');

const MEASURE = process.argv.includes('--measure');
const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const sources = readJson(PATHS.sources);
const buildDate = sources.archive.buildDate.replace(/-/g, '');
const CACHE = path.resolve(
  process.env.PA_BASEMAP_CACHE_DIR ||
    path.join(ROOT, '.cache/pa-basemap', buildDate),
);

/** The published recipe. `--measure` compares it with the alternatives. */
const PUBLISHED = {
  name: 'z0-12, z12 streets from z14, trimmed',
  maxzoom: 12,
  detailZoom: 14,
  tolerance: 2,
  minWaterArea: 1024,
};
const CANDIDATES = [
  { name: 'z0-13 native', maxzoom: 13, detailZoom: null, tolerance: 0 },
  {
    name: 'z0-13, z13 streets from z14',
    maxzoom: 13,
    detailZoom: 14,
    tolerance: 1,
  },
  {
    name: 'z0-12, z12 streets from z14',
    maxzoom: 12,
    detailZoom: 14,
    tolerance: 1,
  },
  PUBLISHED,
  {
    name: 'z0-14 native (count only)',
    maxzoom: 14,
    detailZoom: null,
    countOnly: true,
  },
];
const ONLY = process.argv.includes('--published');

const districts = () => readJson(PATHS.districts).data.borders.features;

/** Every tile key of a pyramid with this max zoom (coverage from the pin file). */
const coverage = (maxzoom, features = districts()) => {
  const c = sources.coverage;
  const keys = [];
  for (let z = 0; z <= maxzoom; z += 1) {
    if (z <= c.outer.zooms[1]) keys.push(...bboxTiles(c.outer.bbox, z));
    else if (z <= c.margin.zooms[1]) keys.push(...bboxTiles(c.margin.bbox, z));
    else keys.push(...stateTiles(features, z, c.state.dilateTiles));
  }
  return keys;
};

/** The `detailZoom` descendants of every max-zoom tile: where its streets come from. */
const detailTiles = (keys, recipe) => {
  const out = [];
  if (!recipe.detailZoom) return out;
  const span = 2 ** (recipe.detailZoom - recipe.maxzoom);
  for (const k of keys) {
    const { z, x, y } = parseKey(k);
    if (z !== recipe.maxzoom) continue;
    for (let dx = 0; dx < span; dx += 1)
      for (let dy = 0; dy < span; dy += 1)
        out.push(key(recipe.detailZoom, x * span + dx, y * span + dy));
  }
  return out;
};

const cachePath = (z, x, y) => path.join(CACHE, String(z), String(x), `${y}`);
const decoded = new Map();
const readCached = (z, x, y) => {
  const k = key(z, x, y);
  if (decoded.has(k)) return decoded.get(k);
  const file = `${cachePath(z, x, y)}.mvt`;
  let value = null;
  if (fs.existsSync(file)) value = decodeTile(fs.readFileSync(file));
  else if (!fs.existsSync(`${cachePath(z, x, y)}.none`))
    throw new Error(`tile ${k} is not cached; run without --measure first`);
  // Keep the cache bounded: z14 children are read once per parent.
  if (z < 14) decoded.set(k, value);
  return value;
};

const buildTile = (recipe, k) => {
  const { z, x, y } = parseKey(k);
  const native = readCached(z, x, y) ?? {};
  let layers = dropSmallWater({ ...native }, recipe.minWaterArea);
  if (recipe.detailZoom && z === recipe.maxzoom)
    layers.roads = mergedRoads(
      { z, x, y },
      recipe.detailZoom,
      (cx, cy) => readCached(recipe.detailZoom, cx, cy),
      recipe.tolerance,
    );
  return encodeTile(layers);
};

const brotli = (buffer) =>
  zlib.brotliCompressSync(buffer, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
  }).length;

const stats = (tiles) => {
  const sizes = [...tiles.values()].map((b) => b.length).sort((a, b) => a - b);
  let br = 0;
  for (const buffer of tiles.values()) br += brotli(buffer);
  return {
    files: sizes.length,
    bytes: sizes.reduce((a, b) => a + b, 0),
    brotli: br,
    largest: sizes[sizes.length - 1] ?? 0,
    p95: sizes[Math.floor(sizes.length * 0.95)] ?? 0,
  };
};

const fmt = (n) => `${(n / 1048576).toFixed(1)} MiB`;
const kib = (n) => `${(n / 1024).toFixed(0)} KiB`;

async function ensureCached(keys) {
  const tiles = keys.map(parseKey);
  const result = await fetchTiles(sources.archive, tiles, CACHE);
  if (result.requested)
    console.log(
      `pa-basemap: fetched ${result.requested} tiles in ${result.ranges} range requests (${fmt(result.bytes)})`,
    );
}

async function measure() {
  const features = districts();
  const all = new Set();
  for (const c of CANDIDATES) {
    const keys = coverage(c.maxzoom, features);
    if (!c.countOnly) {
      keys.forEach((k) => all.add(k));
      detailTiles(keys, c).forEach((k) => all.add(k));
    }
  }
  await ensureCached([...all]);
  console.log(
    '| Candidate | Files | Bytes | Brotli-5 | Largest | p95 tile | Residential street names |',
  );
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const c of ONLY ? [PUBLISHED] : CANDIDATES) {
    const keys = coverage(c.maxzoom, features);
    if (c.countOnly) {
      console.log(`| ${c.name} | ${keys.length} | – | – | – | – | yes |`);
      continue;
    }
    const tiles = new Map(keys.map((k) => [k, buildTile(c, k)]));
    const s = stats(tiles);
    const named = c.detailZoom ? 'yes' : 'no (Protomaps names them from z14)';
    console.log(
      `| ${c.name} | ${s.files} | ${fmt(s.bytes)} | ${fmt(s.brotli)} | ${kib(s.largest)} | ${kib(s.p95)} | ${named} |`,
    );
  }
}

async function refresh() {
  const features = districts();
  const keys = coverage(PUBLISHED.maxzoom, features);
  await ensureCached([...keys, ...detailTiles(keys, PUBLISHED)]);

  const buildId = `pm-${buildDate}-r${RECIPE}`;
  const treeRel = path.join(PATHS.treeRoot, buildId);
  const tmp = path.join(ROOT, `${treeRel}.tmp`);
  fs.rmSync(tmp, { recursive: true, force: true });
  const zooms = {};
  const perLayer = Object.fromEntries(Object.keys(LAYERS).map((l) => [l, 0]));
  const records = [];
  for (const k of keys) {
    const buffer = buildTile(PUBLISHED, k);
    const { z, x, y } = parseKey(k);
    const rel = `${z}/${x}/${y}.pbf`;
    const file = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    records.push({ rel, bytes: buffer.length, sha256: sha256(buffer) });
    const zs = (zooms[z] ??= { tiles: 0, bytes: 0, largest: 0 });
    zs.tiles += 1;
    zs.bytes += buffer.length;
    zs.largest = Math.max(zs.largest, buffer.length);
    for (const layer of Object.keys(decodeTile(buffer))) perLayer[layer] += 1;
  }
  // Atomic swap: remove older recipe builds only after the new one is complete.
  for (const old of fs.existsSync(path.join(ROOT, PATHS.treeRoot))
    ? fs.readdirSync(path.join(ROOT, PATHS.treeRoot))
    : [])
    if (!old.endsWith('.tmp'))
      fs.rmSync(path.join(ROOT, PATHS.treeRoot, old), {
        recursive: true,
        force: true,
      });
  fs.renameSync(tmp, path.join(ROOT, treeRel));

  const bytes = records.reduce((total, r) => total + r.bytes, 0);
  const manifest = {
    buildId,
    generatedBy: 'yarn data:refresh:pa-basemap',
    recipe: RECIPE,
    source: {
      url: sources.archive.url,
      buildDate: sources.archive.buildDate,
      basemapsVersion: sources.archive.basemapsVersion,
      etag: sources.archive.etag,
    },
    license: sources.license,
    attribution: sources.attribution,
    tiles: {
      path: treeRel.split(path.sep).join('/'),
      url: `/tiles/pa/${buildId}/{z}/{x}/{y}.pbf`,
      format: `Mapbox Vector Tile v2, extent ${EXTENT}, served as application/x-protobuf`,
      minzoom: 0,
      maxzoom: PUBLISHED.maxzoom,
      detailZoom: PUBLISHED.detailZoom,
      bounds: sources.coverage.outer.bbox,
      files: records.length,
      bytes,
      digest: treeDigest(records),
      zooms,
      layers: perLayer,
    },
    coverage: coverageIndex(keys),
  };
  fs.writeFileSync(
    path.join(ROOT, PATHS.manifest),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    `pa-basemap: wrote ${records.length} tiles (${fmt(bytes)}) to ${manifest.tiles.path}`,
  );
}

(MEASURE ? measure() : refresh()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
