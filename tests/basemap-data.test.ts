import fs from 'fs';
import zlib from 'zlib';
import { describe, expect, it } from 'vitest';

const basemap = require('../scripts/lib/basemap');
const {
  encodeTile,
  tileIndexes,
  tileJson,
} = require('../scripts/refresh-basemap');
const {
  parseHeadersFile,
  resolveHeaders,
} = require('../scripts/lib/static-headers');

const {
  BUDGETS,
  BUILD_ID,
  LAYERS,
  coastFeatures,
  coastRuns,
  decodeTile,
  firstTileZoom,
  marineLabelFeatures,
  oceanCells,
  oceanPolygons,
  polygonAreaKm2,
  readZipEntry,
  rewindPolygon,
  sha256,
  signedArea,
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
} = basemap;

const square = (west: number, south: number, size: number) => [
  [
    [west, south],
    [west + size, south],
    [west + size, south + size],
    [west, south + size],
    [west, south],
  ],
];

describe('basemap geometry', () => {
  it('drops antimeridian and south-pole closing edges from coastlines', () => {
    const ring = [
      [170, -10],
      [180, -10],
      [180, 10],
      [170, 10],
      [170, -10],
    ];
    expect(coastRuns(ring)).toEqual([
      [
        [180, 10],
        [170, 10],
        [170, -10],
        [180, -10],
      ],
    ]);
    const pole = [
      [-180, -89.998926],
      [0, -70],
      [180, -89.998926],
      [0, -89.998926],
      [-180, -89.998926],
    ];
    expect(coastRuns(pole)).toEqual([
      [
        [-180, -89.998926],
        [0, -70],
        [180, -89.998926],
      ],
    ]);
    const island = square(10, 10, 1)[0];
    expect(coastRuns(island)).toEqual([island]);
  });

  it('tags coastlines with landmass area and winds them water-on-the-right', () => {
    const clockwise = square(0, 0, 1).map((ring) => ring.slice().reverse());
    const [feature] = coastFeatures([clockwise]);
    // RFC 7946 exterior rings are counter-clockwise (shoelace sum < 0 here).
    expect(signedArea(feature.geometry.coordinates)).toBeLessThan(0);
    expect(feature.properties.landmass_km2).toBeGreaterThan(12000);
    expect(feature.properties.landmass_km2).toBeLessThan(12700);
    expect(rewindPolygon(clockwise)[0]).toEqual(feature.geometry.coordinates);
  });

  it('cuts the ocean mask on the z3 tile grid and removes land', () => {
    const cells = oceanCells();
    expect(cells).toHaveLength(64);
    const lats = [...new Set(cells.map((c: number[][][]) => c[0][2][1]))].sort(
      (a: any, b: any) => b - a,
    );
    expect(lats[0]).toBe(90);
    expect(lats).toContainEqual(expect.closeTo(66.5133, 3));
    expect(lats).toContainEqual(expect.closeTo(40.9799, 3));

    const cell = square(0, 0, 20);
    const island = square(5, 5, 2);
    const pieces = oceanPolygons([island], [cell]);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toHaveLength(2); // exterior plus the island hole
    const area = polygonAreaKm2(pieces[0]);
    expect(area).toBeCloseTo(polygonAreaKm2(cell) - polygonAreaKm2(island), -1);
    expect(oceanPolygons([], [cell])[0][0]).toHaveLength(5);
  });

  it('thins lakes and rivers two tile zooms before Natural Earth min_zoom', () => {
    expect(firstTileZoom(1)).toBe(0);
    expect(firstTileZoom(1.7)).toBe(0);
    expect(firstTileZoom(4.7)).toBe(3);
    expect(firstTileZoom(6)).toBe(4);
    expect(firstTileZoom(undefined)).toBe(0);
  });

  it('places sea labels inside the water with title case and overrides', () => {
    const marine = {
      type: 'FeatureCollection',
      features: [
        {
          properties: {
            name: 'SOUTHERN OCEAN',
            featurecla: 'ocean',
            scalerank: 0,
          },
          geometry: { type: 'Polygon', coordinates: square(0, -70, 20) },
        },
        {
          properties: {
            name: 'Bay of Biscay',
            featurecla: 'bay',
            scalerank: 3,
          },
          geometry: { type: 'Polygon', coordinates: square(-6, 44, 4) },
        },
        {
          properties: {
            name: 'North Atlantic Ocean',
            featurecla: 'ocean',
            scalerank: 0,
          },
          geometry: { type: 'Polygon', coordinates: square(-60, 10, 40) },
        },
        {
          properties: { name: 'Tiny Sound', featurecla: 'sound', scalerank: 5 },
          geometry: { type: 'Polygon', coordinates: square(0, 0, 1) },
        },
      ],
    };
    const labels = marineLabelFeatures(marine, {
      maxRank: 4,
      overrides: {
        'North Atlantic Ocean': {
          name: 'Atlantic Ocean',
          coordinates: [-19, 46],
        },
      },
    });
    expect(labels.map((f: any) => f.properties)).toEqual([
      { name: 'Atlantic Ocean', kind: 'ocean', rank: 0 },
      { name: 'Southern Ocean', kind: 'ocean', rank: 0 },
      { name: 'Bay of Biscay', kind: 'bay', rank: 3 },
    ]);
    const [x, y] = labels[1].geometry.coordinates;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(20);
    expect(y).toBeGreaterThan(-70);
    expect(y).toBeLessThan(-50);
  });
});

describe('basemap binary readers', () => {
  const zipWith = (name: string, data: Buffer, deflate: boolean) => {
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(0, 42);
    const centralOffset = local.length + nameBytes.length + body.length;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + nameBytes.length, 12);
    end.writeUInt32LE(centralOffset, 16);
    return Buffer.concat([local, nameBytes, body, central, nameBytes, end]);
  };

  it('extracts stored and deflated zip entries', () => {
    const data = Buffer.from('relief '.repeat(100));
    expect(readZipEntry(zipWith('a.tif', data, true), 'a.tif')).toEqual(data);
    expect(readZipEntry(zipWith('a.tif', data, false), 'a.tif')).toEqual(data);
    expect(() => readZipEntry(zipWith('a.tif', data, true), 'b.tif')).toThrow(
      'not found',
    );
    expect(() => readZipEntry(Buffer.alloc(40), 'a.tif')).toThrow(
      'end of central directory',
    );
  });

  it('reads WebP dimensions and alpha from the RIFF header', () => {
    const vp8x = Buffer.alloc(30);
    vp8x.write('RIFF', 0, 'ascii');
    vp8x.write('WEBP', 8, 'ascii');
    vp8x.write('VP8X', 12, 'ascii');
    vp8x[20] = 0x10;
    vp8x.writeUIntLE(2047, 24, 3);
    vp8x.writeUIntLE(1090, 27, 3);
    expect(webpSize(vp8x)).toEqual({ width: 2048, height: 1091, alpha: true });
    expect(() =>
      webpSize(Buffer.from('not a webp file at all, really.')),
    ).toThrow('not a WebP');
  });
});

describe('basemap tiles', () => {
  const layers = {
    ocean: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: square(-170, -60, 100) },
        },
      ],
    },
    coast: {
      type: 'FeatureCollection',
      features: coastFeatures([square(0, 0, 10)]),
    },
    lakes: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Lake', rank: 0, $tz: 0 },
          geometry: { type: 'Polygon', coordinates: square(2, 2, 2) },
        },
      ],
    },
    rivers: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Early', rank: 1, $tz: 0 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [1, 1],
              [5, 5],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { rank: 6, $tz: 1 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [1, 5],
              [5, 1],
            ],
          },
        },
      ],
    },
    marine_labels: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Test Sea', kind: 'sea', rank: 1 },
          geometry: { type: 'Point', coordinates: [-100, -20] },
        },
      ],
    },
  };

  it('encodes the contract layers, thins by zoom and strips the internal tag', () => {
    const indexes = tileIndexes(layers, 1);
    const z0 = decodeTile(encodeTile(indexes, 0, 0, 0).buffer);
    expect(Object.keys(z0).sort()).toEqual(Object.keys(LAYERS).sort());
    expect(z0.rivers).toHaveLength(1);
    expect(z0.rivers[0].properties).toEqual({ name: 'Early', rank: 1 });
    expect(validateLayers([{ rel: '0/0/0.pbf', layers: z0 }])).toEqual([]);
    const z1 = decodeTile(encodeTile(indexes, 1, 1, 0).buffer);
    expect(z1.rivers).toHaveLength(2);
    expect(z1.rivers.some((f: any) => '$tz' in f.properties)).toBe(false);
  });

  it('writes a tiny valid placeholder for tiles without water', () => {
    const empty = Object.fromEntries(
      Object.keys(LAYERS).map((name) => [
        name,
        { type: 'FeatureCollection', features: [] },
      ]),
    );
    const { buffer, empty: isEmpty } = encodeTile(
      tileIndexes(empty, 0),
      0,
      0,
      0,
    );
    expect(isEmpty).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.length).toBeLessThan(64);
    // The placeholder carries one empty `ocean` layer; decoders skip
    // zero-feature layers, so it reads as an empty tile.
    expect(buffer.toString('latin1')).toContain('ocean');
    expect(decodeTile(buffer)).toEqual({});
  });

  it('publishes a TileJSON whose layers match the contract', () => {
    const json = JSON.parse(tileJson(5));
    expect(json.tiles).toEqual([`/tiles/basemap/${BUILD_ID}/{z}/{x}/{y}.pbf`]);
    expect(json.vector_layers.map((l: any) => l.id)).toEqual(
      Object.keys(LAYERS),
    );
    expect(
      json.vector_layers.find((l: any) => l.id === 'coast').fields,
    ).toEqual({ landmass_km2: 'Number' });
  });
});

describe('basemap validation rules', () => {
  const pinned = {
    naturalEarthVersion: '5.1.2',
    license: 'Public domain.',
    files: {
      ne_50m_land: {
        url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson',
        sha256: 'a'.repeat(64),
        bytes: 10,
      },
    },
  };

  it('requires sources pinned to a release with hashes', () => {
    expect(validateSources(pinned)).toEqual([]);
    const unpinned = structuredClone(pinned);
    unpinned.files.ne_50m_land.url = unpinned.files.ne_50m_land.url.replace(
      '/v5.1.2/',
      '/master/',
    );
    unpinned.files.ne_50m_land.sha256 = 'abc';
    expect(validateSources(unpinned)).toEqual([
      'ne_50m_land: GitHub url must be pinned to tag v5.1.2',
      'ne_50m_land: sha256 missing or malformed',
    ]);
    expect(
      validateSources({
        ...pinned,
        naturalEarthVersion: 'latest',
        license: 'CC-BY',
      }),
    ).toEqual([
      'sources: naturalEarthVersion must be an exact x.y.z release',
      'sources: license must state Natural Earth public domain',
      'ne_50m_land: GitHub url must be pinned to tag vlatest',
    ]);
  });

  it('requires the manifest to be built from exactly the pinned sources', () => {
    expect(
      validateProvenance({ sources: { ne_50m_land: 'a'.repeat(64) } }, pinned),
    ).toEqual([]);
    expect(
      validateProvenance(
        { sources: { ne_50m_land: 'b'.repeat(64), extra: 'c' } },
        pinned,
      ),
    ).toEqual([
      'manifest: ne_50m_land was not built from the pinned sha256',
      'manifest: unknown source extra',
    ]);
  });

  const pyramid = (maxzoom: number) => {
    const records = [];
    for (let z = 0; z <= maxzoom; z++)
      for (let x = 0; x < 2 ** z; x++)
        for (let y = 0; y < 2 ** z; y++)
          records.push({
            rel: `${z}/${x}/${y}.pbf`,
            bytes: 100,
            sha256: sha256(`${z}${x}${y}`),
          });
    return records.sort((a, b) => (a.rel < b.rel ? -1 : 1));
  };
  const manifestFor = (records: any[], maxzoom: number) => ({
    tiles: { maxzoom, digest: treeDigest(records), zooms: zoomStats(records) },
  });

  it('accepts a complete pyramid that matches its manifest', () => {
    const records = pyramid(2);
    expect(validateTileTree(records, manifestFor(records, 2))).toEqual([]);
  });

  it('rejects missing tiles, stray files, oversize tiles and silent edits', () => {
    const records = pyramid(2);
    const manifest = manifestFor(records, 2);
    const missing = records.filter((r) => r.rel !== '2/1/1.pbf');
    expect(validateTileTree(missing, manifest)).toEqual(
      expect.arrayContaining([
        'tiles: 1 tiles missing from the z0-2 pyramid',
        expect.stringContaining('tiles: z2 has 15 files'),
        expect.stringContaining('tree digest'),
      ]),
    );
    const stray = [...records, { rel: 'README.txt', bytes: 5, sha256: 'x' }];
    expect(validateTileTree(stray, manifest)).toContain(
      'tiles: unexpected file README.txt',
    );
    const outside = [...records, { rel: '3/0/0.pbf', bytes: 5, sha256: 'x' }];
    expect(validateTileTree(outside, manifest)).toContain(
      'tiles: 3/0/0.pbf is outside z0-2',
    );
    const big = records.map((r) =>
      r.rel === '0/0/0.pbf' ? { ...r, bytes: 26 * 1024 * 1024 } : r,
    );
    expect(validateTileTree(big, manifest)).toEqual(
      expect.arrayContaining([
        'tiles: 0/0/0.pbf exceeds the 25 MiB per-file limit',
        expect.stringContaining('over the 81920 B tile budget'),
      ]),
    );
    const edited = records.map((r) =>
      r.rel === '1/0/0.pbf' ? { ...r, sha256: 'changed' } : r,
    );
    expect(validateTileTree(edited, manifest)).toEqual([
      'tiles: tree digest does not match the manifest (tiles changed without a refresh)',
    ]);
  });

  it('enforces byte budgets', () => {
    const records = pyramid(1);
    expect(
      validateTileTree(records, manifestFor(records, 1), {
        ...BUDGETS,
        tileBytesTotal: 400,
      }),
    ).toEqual(['tiles: 500 B exceeds the 400 B budget']);
  });

  it('checks every tile against the layer contract', () => {
    const good = {
      ocean: [{ type: 'Polygon', properties: {} }],
      coast: [{ type: 'LineString', properties: { landmass_km2: 7000 } }],
      lakes: [{ type: 'Polygon', properties: { rank: 0, name: 'Lake' } }],
      rivers: [{ type: 'LineString', properties: { rank: 3 } }],
      marine_labels: [
        { type: 'Point', properties: { name: 'Sea', kind: 'sea', rank: 1 } },
      ],
    };
    expect(validateLayers([{ rel: '0/0/0.pbf', layers: good }])).toEqual([]);
    const bad = {
      ...good,
      coast: [{ type: 'LineString', properties: { landmass_km2: 0 } }],
      rivers: [{ type: 'Polygon', properties: { rank: '3', extra: 1 } }],
      roads: [{ type: 'LineString', properties: {} }],
      marine_labels: [],
    };
    expect(validateLayers([{ rel: '0/0/0.pbf', layers: bad }])).toEqual([
      'layers: 0/0/0.pbf coast landmass_km2 must be positive',
      'layers: 0/0/0.pbf rivers has Polygon, expected LineString',
      'layers: 0/0/0.pbf rivers feature lacks number rank',
      'layers: 0/0/0.pbf rivers has undocumented attribute extra',
      'layers: 0/0/0.pbf has unknown layer roads',
      'layers: required layer marine_labels is missing from every tile',
      'layers: 0/0/0.pbf lacks marine_labels',
    ]);
  });

  it('checks the relief, globe and TileJSON assets', () => {
    const relief = Buffer.alloc(30);
    relief.write('RIFF', 0, 'ascii');
    relief.write('WEBP', 8, 'ascii');
    relief.write('VP8X', 12, 'ascii');
    relief[20] = 0x10;
    relief.writeUIntLE(9, 24, 3);
    relief.writeUIntLE(4, 27, 3);
    const globe = Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: square(0, 0, 1) },
          },
        ],
      }),
    );
    const manifest = {
      buildId: BUILD_ID,
      tiles: { maxzoom: 5 },
      relief: {
        width: 10,
        height: 5,
        sha256: sha256(relief),
        coordinates: [
          [-180, 76],
          [180, 76],
          [180, -58],
          [-180, -58],
        ],
      },
      globe: { sha256: sha256(globe) },
    };
    const assets = {
      'relief.webp': relief,
      'land-110m.geojson': globe,
      'tiles.json': Buffer.from(tileJson(5)),
    };
    expect(validateAssets(assets, manifest)).toEqual([]);
    expect(
      validateAssets(
        {
          ...assets,
          'tiles.json': Buffer.from(tileJson(6)),
          'notes.txt': Buffer.from('x'),
        },
        manifest,
      ),
    ).toEqual([
      'assets: tiles.json maxzoom differs from the manifest',
      'assets: unexpected file notes.txt',
    ]);
    expect(validateAssets({}, manifest)).toEqual([
      'assets: relief.webp is missing',
      'assets: land-110m.geojson is missing',
      'assets: tiles.json is missing',
    ]);
  });

  it('flags stale builds and the file budget', () => {
    expect(validateBuildDirectories([BUILD_ID], [BUILD_ID], BUILD_ID)).toEqual(
      [],
    );
    expect(
      validateBuildDirectories([BUILD_ID, 'ne-5.1.2-r0'], [], BUILD_ID),
    ).toEqual([
      'tiles: stale build directory ne-5.1.2-r0',
      `assets: build ${BUILD_ID} is missing`,
    ]);
    expect(validateFileBudget(1500)).toEqual([]);
    expect(validateFileBudget(1501)[0]).toContain(
      'over its 1500-file share of the 16000-file gate',
    );
  });
});

describe('committed basemap', () => {
  it('passes every validation rule', () => {
    const result = validateBasemap();
    expect(result.errors).toEqual([]);
    expect(result.files).toBeLessThanOrEqual(BUDGETS.basemapFiles);
    // Decodes all 1,365 tiles; allow for slow CI machines.
  }, 30000);

  it('is served with one compressible content type and immutable caching', () => {
    const rules = parseHeadersFile(fs.readFileSync('public/_headers', 'utf8'));
    const immutable = 'public, max-age=31536000, immutable';
    const manifest = JSON.parse(
      fs.readFileSync('data/basemap-manifest.json', 'utf8'),
    );
    const tile = manifest.tiles.url.replace('{z}/{x}/{y}', '5/18/11');
    expect(resolveHeaders(rules, tile)).toMatchObject({
      'content-type': 'application/x-protobuf',
      'cache-control': immutable,
    });
    expect(
      resolveHeaders(rules, '/tiles/pa/pm-20260811-r1/13/2300/3000.pbf'),
    ).toMatchObject({
      'content-type': 'application/x-protobuf',
      'cache-control': immutable,
    });
    expect(resolveHeaders(rules, manifest.relief.url)).toMatchObject({
      'content-type': 'image/webp',
      'cache-control': immutable,
    });
    expect(resolveHeaders(rules, manifest.globe.url)['cache-control']).toBe(
      immutable,
    );
    expect(
      resolveHeaders(rules, manifest.globe.url)['content-type'],
    ).toBeUndefined();
    expect(
      resolveHeaders(rules, '/year/1492')['cache-control'],
    ).toBeUndefined();
    expect(
      resolveHeaders(rules, '/data/historical/1492.abc.json')['cache-control'],
    ).toBe(immutable);
  });
});
