import { describe, expect, it } from 'vitest';

const lib = require('../scripts/lib/pa-basemap');
const manifest = require('../data/pa-basemap-manifest.json');
const sources = require('../data/pa-basemap-sources.json');

const {
  BUDGETS,
  EXTENT,
  RECIPE,
  bboxTiles,
  checkTileContract,
  clipLine,
  coverageIndex,
  coveredKeys,
  decodeTile,
  drawable,
  dropSmallWater,
  encodeTile,
  joinLines,
  mergedRoads,
  simplify,
  stateTiles,
} = lib;

const road = (geometry: number[][][], properties = {}) => ({
  type: 2,
  properties: { kind: 'minor_road', kind_detail: 'residential', ...properties },
  geometry,
});

describe('PA street basemap recipe (T8)', () => {
  it('clips lines to a tile square and splits pieces that leave it', () => {
    expect(
      clipLine(
        [
          [-10, 10],
          [10, 10],
        ],
        0,
        100,
      ),
    ).toEqual([
      [
        [0, 10],
        [10, 10],
      ],
    ]);
    const pieces = clipLine(
      [
        [10, 10],
        [150, 10],
        [150, 50],
        [10, 50],
      ],
      0,
      100,
    );
    expect(pieces).toEqual([
      [
        [10, 10],
        [100, 10],
      ],
      [
        [100, 50],
        [10, 50],
      ],
    ]);
    expect(
      clipLine(
        [
          [200, 200],
          [300, 300],
        ],
        0,
        100,
      ),
    ).toEqual([]);
  });

  it('simplifies within the tolerance and keeps the end points', () => {
    const line = [
      [0, 0],
      [5, 0.4],
      [10, 0],
      [10, 10],
    ];
    expect(simplify(line, 1)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(simplify(line, 0.1)).toEqual(line);
  });

  it('joins pieces of the same street that meet end to start', () => {
    const joined = joinLines([
      road(
        [
          [
            [0, 0],
            [5, 0],
          ],
        ],
        { name: 'Market Street' },
      ),
      road(
        [
          [
            [5, 0],
            [9, 0],
          ],
        ],
        { name: 'Market Street' },
      ),
      road(
        [
          [
            [9, 0],
            [12, 0],
          ],
        ],
        { name: 'Chestnut Street' },
      ),
    ]);
    expect(joined).toHaveLength(2);
    expect(
      joined.find(
        (f: { properties: { name: string } }) =>
          f.properties.name === 'Market Street',
      ).geometry,
    ).toEqual([
      [
        [0, 0],
        [5, 0],
        [9, 0],
      ],
    ]);
  });

  it('folds z14 streets into the parent tile without buffer duplicates', () => {
    // Two children of z13 tile (0, 0): a street crosses from the west child
    // into the east child, each child carrying it into its buffer.
    const children: Record<string, unknown> = {
      '0,0': {
        roads: [
          road(
            [
              [
                [1000, 2048],
                [4200, 2048],
              ],
            ],
            { name: 'Main Street' },
          ),
        ],
      },
      '1,0': {
        roads: [
          road(
            [
              [
                [-100, 2048],
                [3000, 2048],
              ],
            ],
            { name: 'Main Street' },
          ),
        ],
      },
    };
    const roads = mergedRoads(
      { z: 13, x: 0, y: 0 },
      14,
      (x: number, y: number) => children[`${x},${y}`] ?? null,
      1,
    );
    expect(roads).toHaveLength(1);
    expect(roads[0].geometry).toEqual([
      [
        [500, 1024],
        [3548, 1024],
      ],
    ]);
    expect(roads[0].properties.name).toBe('Main Street');
  });

  it('drops ponds a few pixels across, per ring, and keeps lakes', () => {
    const square = (x: number, size: number) => [
      [x, 0],
      [x + size, 0],
      [x + size, size],
      [x, size],
      [x, 0],
    ];
    const layers = dropSmallWater(
      {
        water: [
          {
            type: 3,
            properties: { kind: 'water' },
            geometry: [square(0, 10), square(100, 200)],
          },
          {
            type: 2,
            properties: { kind: 'river' },
            geometry: [
              [
                [0, 0],
                [1, 1],
              ],
            ],
          },
        ],
      },
      1024,
    );
    expect(layers.water).toHaveLength(2);
    expect(layers.water[0].geometry).toEqual([square(100, 200)]);
  });

  it('keeps names drawable with T3’s published glyph ranges', () => {
    expect(drawable('Camp Hill')).toBe(true);
    expect(drawable('Wilkes-Barre – Scranton ’s')).toBe(true);
    expect(drawable('Москва')).toBe(false);
  });

  it('round-trips a slim tile and rejects anything outside the layer contract', () => {
    const buffer = encodeTile({
      roads: [
        road(
          [
            [
              [0, 0],
              [100, 100],
            ],
          ],
          { name: 'Main Street' },
        ),
      ],
      places: [
        {
          type: 1,
          properties: { kind: 'locality', name: 'Camp Hill', min_zoom: 9 },
          geometry: [[[50, 50]]],
        },
      ],
    });
    expect(checkTileContract('t.pbf', buffer)).toEqual([]);
    const decoded = decodeTile(buffer);
    expect(decoded.roads[0].properties).toEqual({
      kind: 'minor_road',
      kind_detail: 'residential',
      name: 'Main Street',
    });
    const bad = encodeTile({
      roads: [
        road(
          [
            [
              [0, 0],
              [1, 1],
            ],
          ],
          { oneway: true },
        ),
      ],
    });
    expect(checkTileContract('bad.pbf', bad)).toEqual([
      'bad.pbf: roads has attribute oneway',
    ]);
  });

  it('covers Pennsylvania tile by tile and indexes coverage as row runs', () => {
    const square = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-78, 40],
            [-77, 40],
            [-77, 41],
            [-78, 41],
            [-78, 40],
          ],
        ],
      },
    };
    const exact = stateTiles([square], 9, 0);
    expect(exact.length).toBe(bboxTiles([-78, 40, -77, 41], 9).length);
    expect(stateTiles([square], 9, 1).length).toBeGreaterThan(exact.length);
    const index = coverageIndex(exact);
    expect(coveredKeys(index).sort()).toEqual([...exact].sort());
  });
});

describe('committed PA basemap manifest', () => {
  it('matches the pin, the recipe and the budgets', () => {
    expect(manifest.source.url).toBe(sources.archive.url);
    expect(manifest.source.etag).toBe(sources.archive.etag);
    expect(manifest.recipe).toBe(RECIPE);
    expect(manifest.tiles.url).toBe(
      `/tiles/pa/${manifest.buildId}/{z}/{x}/{y}.pbf`,
    );
    expect(manifest.tiles.files).toBeLessThanOrEqual(BUDGETS.files);
    expect(manifest.tiles.bytes).toBeLessThanOrEqual(BUDGETS.bytesTotal);
    expect(manifest.tiles.maxzoom).toBe(12);
    expect(EXTENT).toBe(4096);
  });

  it('credits OpenStreetMap under the ODbL', () => {
    expect(manifest.license).toMatch(/ODbL/);
    expect(manifest.attribution).toMatch(/openstreetmap\.org\/copyright/);
  });
});
