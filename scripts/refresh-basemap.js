'use strict';

// Explicit, network-using basemap refresh. Never part of `yarn build`.
//
//   yarn data:refresh:basemap            download (cached), verify, rebuild
//   yarn data:refresh:basemap --measure  tile to z7 in memory and print the
//                                        per-zoom table behind MAX_ZOOM
//   yarn data:refresh:basemap --pin      record the sha256/bytes of freshly
//                                        downloaded sources (upgrades only)
//
// Downloads are cached in BASEMAP_CACHE_DIR (default: .cache/basemap, which is
// gitignored). See docs/BASEMAP.md.

const fs = require('fs');
const path = require('path');
const {
  BUILD_ID,
  LAYERS,
  MAX_ZOOM,
  PATHS,
  ROOT,
  TILE,
  assetsDir,
  coastFeatures,
  featureCollection,
  firstTileZoom,
  listTree,
  marineLabelFeatures,
  oceanPolygons,
  polygonsOf,
  readZipEntry,
  rewindPolygon,
  round,
  sha256,
  tilesDir,
  treeDigest,
  zoomStats,
} = require('./lib/basemap');

const args = new Set(process.argv.slice(2));
const MEASURE = args.has('--measure');
const PIN = args.has('--pin');
const CACHE = path.resolve(
  process.env.BASEMAP_CACHE_DIR || path.join(ROOT, '.cache/basemap'),
);

const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const download = async (name, file) => {
  fs.mkdirSync(CACHE, { recursive: true });
  const cached = path.join(CACHE, name);
  if (!fs.existsSync(cached) || PIN) {
    console.log(`download ${file.url}`);
    const response = await fetch(file.url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    fs.writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
  }
  const buffer = fs.readFileSync(cached);
  const digest = sha256(buffer);
  if (PIN) {
    file.sha256 = digest;
    file.bytes = buffer.length;
  } else if (digest !== file.sha256 || buffer.length !== file.bytes) {
    throw new Error(
      `${name}: sha256 ${digest} (${buffer.length} B) does not match the pin ${file.sha256} (${file.bytes} B). ` +
        'Delete the cached file to re-download, or review the upstream change and run with --pin.',
    );
  }
  return buffer;
};

const geojson = (buffer, name) => {
  const json = JSON.parse(buffer.toString('utf8'));
  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features))
    throw new Error(`${name}: not a GeoJSON FeatureCollection`);
  return json;
};

const cleanName = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const withProps = (props) =>
  Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));

// ---------------------------------------------------------------------------
// Layers

const buildLayers = (inputs, sources) => {
  const landPolygons = inputs.ne_50m_land.features.flatMap((f) =>
    polygonsOf(f.geometry),
  );
  const ocean = featureCollection(
    oceanPolygons(landPolygons).map((coordinates) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates },
    })),
  );
  const coast = featureCollection(coastFeatures(landPolygons));
  // `$tz` is the first tile zoom that carries the feature; encodeTile strips it.
  const lakes = featureCollection(
    inputs.ne_50m_lakes.features.map((f) => ({
      type: 'Feature',
      properties: withProps({
        name: cleanName(f.properties.name),
        rank: f.properties.scalerank,
        $tz: firstTileZoom(f.properties.min_zoom),
      }),
      geometry: f.geometry,
    })),
  );
  const rivers = featureCollection(
    inputs.ne_50m_rivers_lake_centerlines.features
      .filter((f) => f.properties.featurecla === 'River')
      .map((f) => ({
        type: 'Feature',
        properties: withProps({
          name: cleanName(f.properties.name_en) || cleanName(f.properties.name),
          rank: f.properties.scalerank,
          $tz: firstTileZoom(f.properties.min_zoom),
        }),
        geometry: f.geometry,
      })),
  );
  const marine_labels = featureCollection(
    marineLabelFeatures(inputs.ne_50m_geography_marine_polys, {
      maxRank: sources.recipe.marineMaxRank,
      overrides: sources.labelOverrides,
    }),
  );
  return { ocean, coast, lakes, rivers, marine_labels };
};

// ---------------------------------------------------------------------------
// Tiles

const tileIndexes = (layers, maxZoom, tolerance = TILE.tolerance) => {
  const geojsonvtModule = require('geojson-vt');
  const geojsonvt = geojsonvtModule.default || geojsonvtModule;
  return Object.fromEntries(
    Object.entries(layers).map(([name, fc]) => [
      name,
      geojsonvt(fc, {
        maxZoom,
        indexMaxZoom: maxZoom,
        indexMaxPoints: 0,
        tolerance,
        extent: TILE.extent,
        buffer: TILE.buffer,
      }),
    ]),
  );
};

/** Drops features not yet due at this zoom and the internal `$tz` tag. */
const thin = (tile, z) => {
  const features = [];
  for (const feature of tile.features) {
    if (!feature.tags || !('$tz' in feature.tags)) {
      features.push(feature);
      continue;
    }
    if (feature.tags.$tz > z) continue;
    const { $tz, ...tags } = feature.tags;
    features.push({ ...feature, tags });
  }
  return { ...tile, features };
};

const encodeTile = (indexes, z, x, y) => {
  const { fromGeojsonVt } = require('vt-pbf');
  const tile = {};
  for (const name of Object.keys(LAYERS)) {
    const t = indexes[name].getTile(z, x, y);
    const thinned = t && thin(t, z);
    if (thinned && thinned.features.length) tile[name] = thinned;
  }
  // Inland tiles have no water at all. They still get a valid, tiny tile (an
  // empty ocean layer) so the pyramid is complete and nothing 404s.
  const empty = !Object.keys(tile).length;
  const layers = empty ? { ocean: { features: [] } } : tile;
  return {
    buffer: Buffer.from(
      fromGeojsonVt(layers, { version: 2, extent: TILE.extent }),
    ),
    tile,
    empty,
  };
};

/**
 * Max-zoom measurement. geojson-vt keeps every vertex at its index maxZoom,
 * so each candidate max zoom M carries the full 1:50m detail; what changes is
 * the file count, the bytes, and the quantization step when overzoomed.
 */
const APP_MAX_ZOOM = 10;
const measure = (layers) => {
  const rows = [];
  for (let M = 3; M <= 7; M++) {
    const indexes = tileIndexes(layers, M);
    let files = 0;
    let placeholders = 0;
    let bytes = 0;
    let topBytes = 0;
    let largest = 0;
    for (let z = 0; z <= M; z++)
      for (let x = 0; x < 2 ** z; x++)
        for (let y = 0; y < 2 ** z; y++) {
          const { buffer, empty } = encodeTile(indexes, z, x, y);
          files += 1;
          placeholders += empty ? 1 : 0;
          bytes += buffer.length;
          if (z === M) topBytes += buffer.length;
          largest = Math.max(largest, buffer.length);
        }
    const unitMetres = 40075016.7 / 2 ** M / TILE.extent;
    rows.push({
      maxzoom: M,
      files,
      placeholders,
      bytes,
      topZoomBytes: topBytes,
      largest,
      quantizationMetresAtEquator: round(unitMetres, 1),
      // Half a tile unit, in CSS px, at the app's max zoom (512 px tiles).
      worstSnapPxAtZ10: round(
        (0.5 * 512 * 2 ** (APP_MAX_ZOOM - M)) / TILE.extent,
        2,
      ),
    });
  }
  console.table(rows);
  return rows;
};

const writeTiles = (layers, maxZoom) => {
  const indexes = tileIndexes(layers, maxZoom);
  const out = path.join(ROOT, tilesDir());
  for (let z = 0; z <= maxZoom; z++)
    for (let x = 0; x < 2 ** z; x++)
      for (let y = 0; y < 2 ** z; y++) {
        const { buffer } = encodeTile(indexes, z, x, y);
        fs.mkdirSync(path.join(out, String(z), String(x)), { recursive: true });
        fs.writeFileSync(
          path.join(out, String(z), String(x), `${y}.pbf`),
          buffer,
        );
      }
  return listTree(out);
};

// ---------------------------------------------------------------------------
// Relief: Natural Earth GRAY_50M_SR, local relief reprojected to Web Mercator
// and tinted with Direction A's sepia shade and cream light (as in the design
// spike's tools/prepare-data.cjs).

const RELIEF = {
  north: 76,
  south: -58,
  width: 2048,
  shadow: [96, 72, 44],
  light: [255, 250, 236],
  maxShadow: 0.5,
  maxLight: 0.42,
  quality: 62,
  alphaQuality: 60,
};

const buildRelief = async (tiff) => {
  const sharp = require('sharp');
  sharp.cache(false);
  const mercY = (lat) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const W = RELIEF.width;
  const H = Math.round(
    (W * (mercY(RELIEF.north) - mercY(RELIEF.south))) / (2 * Math.PI),
  );
  const grey = () => sharp(tiff, { limitInputPixels: false }).greyscale();
  const { data: soft, info } = await grey()
    .blur(2.2)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blur = await grey().blur(14).raw().toBuffer();
  const { width: sw, height: sh } = info;
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const my =
      mercY(RELIEF.north) -
      ((y + 0.5) / H) * (mercY(RELIEF.north) - mercY(RELIEF.south));
    const lat = (2 * Math.atan(Math.exp(my)) - Math.PI / 2) * (180 / Math.PI);
    const sy = Math.min(sh - 1, Math.floor(((90 - lat) / 180) * sh));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor((x / W) * sw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) / W) * sw));
      let sum = 0;
      for (let sx = x0; sx < x1; sx++)
        sum += soft[sy * sw + sx] - blur[sy * sw + sx];
      const d = sum / (x1 - x0);
      const dark = Math.min(1, Math.max(0, -d / 34)) ** 1.1 * RELIEF.maxShadow;
      const light = Math.min(1, Math.max(0, d / 34)) ** 1.1 * RELIEF.maxLight;
      const c = dark >= light ? RELIEF.shadow : RELIEF.light;
      const i = (y * W + x) * 4;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = Math.round(255 * Math.max(dark, light));
    }
  }
  const webp = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .webp({
      quality: RELIEF.quality,
      alphaQuality: RELIEF.alphaQuality,
      effort: 6,
    })
    .toBuffer();
  return {
    buffer: webp,
    width: W,
    height: H,
    coordinates: [
      [-180, RELIEF.north],
      [180, RELIEF.north],
      [180, RELIEF.south],
      [-180, RELIEF.south],
    ],
  };
};

// ---------------------------------------------------------------------------
// Locator globe: Natural Earth 1:110m land, outer rings at 0.1° precision.

const buildGlobe = (land110) => {
  const features = land110.features
    .flatMap((f) => polygonsOf(f.geometry))
    .map((polygon) => {
      const ring = rewindPolygon([polygon[0]])[0]
        .map(([x, y]) => [round(x, 1), round(y, 1)])
        .filter(
          (p, i, all) =>
            i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1],
        );
      return ring;
    })
    .filter((ring) => ring.length >= 4)
    .map((ring) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    }));
  return Buffer.from(JSON.stringify(featureCollection(features)));
};

// ---------------------------------------------------------------------------

const ATTRIBUTION =
  '<a href="https://www.naturalearthdata.com/">Natural Earth</a>';

const tileJson = (maxzoom) =>
  JSON.stringify(
    {
      tilejson: '3.0.0',
      name: `Historic Borders physical basemap ${BUILD_ID}`,
      attribution: ATTRIBUTION,
      tiles: [`/tiles/basemap/${BUILD_ID}/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom,
      bounds: [-180, -85.0511, 180, 85.0511],
      vector_layers: Object.entries(LAYERS).map(([id, spec]) => ({
        id,
        description: spec.description,
        fields: Object.fromEntries(
          [
            ...Object.entries(spec.attributes),
            ...Object.entries(spec.optional),
          ].map(([k, t]) => [k, t === 'number' ? 'Number' : 'String']),
        ),
        minzoom: 0,
        maxzoom,
      })),
    },
    null,
    2,
  ) + '\n';

const formatJson = async (file, text) => {
  const prettier = require('prettier');
  const options = (await prettier.resolveConfig(file)) || {};
  return prettier.format(text, { ...options, filepath: file });
};

const main = async () => {
  const sources = readJson(PATHS.sources);
  const buffers = {};
  for (const [name, file] of Object.entries(sources.files))
    buffers[name] = await download(name, file);
  if (PIN) {
    const file = path.join(ROOT, PATHS.sources);
    fs.writeFileSync(
      file,
      await formatJson(file, JSON.stringify(sources, null, 2)),
    );
    console.log(
      `pinned ${Object.keys(sources.files).length} sources in ${PATHS.sources}`,
    );
  }

  const inputs = {};
  for (const name of [
    'ne_50m_land',
    'ne_50m_lakes',
    'ne_50m_rivers_lake_centerlines',
    'ne_50m_geography_marine_polys',
    'ne_110m_land',
  ])
    inputs[name] = geojson(buffers[name], name);
  console.log('building layers (ocean mask clipping takes a few seconds)');
  const layers = buildLayers(inputs, sources);

  if (MEASURE) {
    measure(layers);
    return;
  }

  for (const root of [PATHS.tilesRoot, PATHS.assetsRoot])
    fs.rmSync(path.join(ROOT, root), { recursive: true, force: true });
  const records = writeTiles(layers, MAX_ZOOM);
  const zooms = zoomStats(records);

  const assetRoot = path.join(ROOT, assetsDir());
  fs.mkdirSync(assetRoot, { recursive: true });
  const relief = await buildRelief(
    readZipEntry(buffers.GRAY_50M_SR, 'GRAY_50M_SR.tif'),
  );
  fs.writeFileSync(path.join(assetRoot, 'relief.webp'), relief.buffer);
  const globe = buildGlobe(inputs.ne_110m_land);
  fs.writeFileSync(path.join(assetRoot, 'land-110m.geojson'), globe);
  fs.writeFileSync(path.join(assetRoot, 'tiles.json'), tileJson(MAX_ZOOM));

  const tileBytes = records.reduce((sum, r) => sum + r.bytes, 0);
  const manifest = {
    buildId: BUILD_ID,
    generatedBy: 'yarn data:refresh:basemap',
    naturalEarthVersion: sources.naturalEarthVersion,
    license: sources.license,
    attribution: ATTRIBUTION,
    sources: Object.fromEntries(
      Object.entries(sources.files).map(([n, f]) => [n, f.sha256]),
    ),
    layers: Object.fromEntries(
      Object.entries(layers).map(([name, fc]) => [
        name,
        { sourceFeatures: fc.features.length },
      ]),
    ),
    tiles: {
      path: tilesDir(),
      url: `/tiles/basemap/${BUILD_ID}/{z}/{x}/{y}.pbf`,
      format:
        'Mapbox Vector Tile v2, extent 4096, served as application/x-protobuf',
      minzoom: 0,
      maxzoom: MAX_ZOOM,
      extent: TILE.extent,
      buffer: TILE.buffer,
      tolerance: TILE.tolerance,
      files: records.length,
      bytes: tileBytes,
      digest: treeDigest(records),
      zooms,
    },
    relief: {
      path: `${assetsDir()}/relief.webp`,
      url: `/basemap/${BUILD_ID}/relief.webp`,
      width: relief.width,
      height: relief.height,
      bytes: relief.buffer.length,
      sha256: sha256(relief.buffer),
      coordinates: relief.coordinates,
      recipe: RELIEF,
    },
    globe: {
      path: `${assetsDir()}/land-110m.geojson`,
      url: `/basemap/${BUILD_ID}/land-110m.geojson`,
      features: JSON.parse(globe.toString('utf8')).features.length,
      bytes: globe.length,
      sha256: sha256(globe),
    },
    tilejson: `/basemap/${BUILD_ID}/tiles.json`,
  };
  const manifestFile = path.join(ROOT, PATHS.manifest);
  fs.writeFileSync(
    manifestFile,
    await formatJson(manifestFile, JSON.stringify(manifest, null, 2)),
  );

  console.log(
    `basemap ${BUILD_ID}: ${records.length} tiles, ${tileBytes} B (z0-${MAX_ZOOM})`,
  );
  for (const [z, s] of Object.entries(zooms))
    console.log(
      `  z${z}: ${s.tiles} tiles, ${s.bytes} B, largest ${s.largest} B`,
    );
  console.log(
    `  relief.webp ${relief.width}x${relief.height}, ${relief.buffer.length} B`,
  );
  console.log(`  land-110m.geojson ${globe.length} B`);
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildGlobe, buildLayers, encodeTile, tileIndexes, tileJson };
