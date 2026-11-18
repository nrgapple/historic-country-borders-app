import { describe, expect, it } from 'vitest';

const {
  MAX_DISTANCE_KM,
  buildCapitalFiles,
  buildCapitalsYear,
  capitalIds,
  distanceToTerritoryKm,
  insidePolygon,
  validateCapitalsYear,
} = require('../scripts/lib/historical-capitals');
const {
  PROPERTY,
  earthCoordinates,
  haversineKm,
  itemValues,
  trimEntity,
} = require('../scripts/lib/wikidata');
const { validateSnapshot } = require('../scripts/lib/historical-context');

type Ring = [number, number][];
const box = (west: number, south: number, east: number, north: number) =>
  [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ] as Ring;

const coordinateClaim = (
  latitude: number,
  longitude: number,
  rank = 'normal',
  globe = 'http://www.wikidata.org/entity/Q2',
) => ({
  rank,
  mainsnak: {
    snaktype: 'value',
    property: 'P625',
    datavalue: {
      type: 'globecoordinate',
      value: { latitude, longitude, precision: 0.0001, globe },
    },
  },
});
const entityWith = (...claims: unknown[]) => ({
  id: 'Q1',
  lastrevid: 7,
  claims: { P625: claims },
});

describe('capital coordinates (P625)', () => {
  it('rounds the single Earth coordinate to five decimals as [lon, lat]', () => {
    expect(
      earthCoordinates(entityWith(coordinateClaim(41.0082376, 28.9783589))),
    ).toEqual({
      coordinates: [28.97836, 41.00824],
    });
  });

  it('prefers preferred-rank values and ignores deprecated ones', () => {
    expect(
      earthCoordinates(
        entityWith(
          coordinateClaim(10, 10),
          coordinateClaim(20, 20, 'preferred'),
          coordinateClaim(30, 30, 'deprecated'),
        ),
      ),
    ).toEqual({ coordinates: [20, 20] });
  });

  it('ignores other globes and out-of-range values', () => {
    expect(
      earthCoordinates(
        entityWith(
          coordinateClaim(
            1,
            1,
            'normal',
            'http://www.wikidata.org/entity/Q405',
          ),
          coordinateClaim(95, 1),
        ),
      ),
    ).toEqual({ issue: 'missing' });
    expect(earthCoordinates({ claims: {} })).toEqual({ issue: 'missing' });
  });

  it('uses the first value when best-rank points are within 10 km of each other', () => {
    expect(
      earthCoordinates(
        entityWith(
          coordinateClaim(33.5138, 36.2765),
          coordinateClaim(33.51, 36.3),
        ),
      ),
    ).toEqual({ coordinates: [36.2765, 33.5138] });
  });

  it('reports ambiguity when best-rank points are far apart', () => {
    expect(
      earthCoordinates(
        entityWith(coordinateClaim(36.85, 10.32), coordinateClaim(36.0, 10.0)),
      ),
    ).toEqual({ issue: 'ambiguous' });
  });

  it('keeps P625 when trimming entities for the cache', () => {
    const trimmed = trimEntity({
      id: 'Q1',
      claims: { P625: [coordinateClaim(1, 2)], P999: [] },
    });
    expect(trimmed.claims).toHaveProperty(PROPERTY.coordinateLocation);
    expect(trimmed.claims).not.toHaveProperty('P999');
  });

  it('measures great-circle distance', () => {
    expect(haversineKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
  });
});

describe('territory distance', () => {
  const donut = [box(0, 0, 10, 10), box(4, 4, 6, 6).reverse()];

  it('counts points in holes as outside', () => {
    expect(insidePolygon([2, 2], donut)).toBe(true);
    expect(insidePolygon([5, 5], donut)).toBe(false);
    expect(insidePolygon([11, 5], donut)).toBe(false);
  });

  it('is zero inside and the border distance outside', () => {
    const geometry = { type: 'Polygon', coordinates: donut };
    expect(distanceToTerritoryKm([2, 2], [geometry])).toBe(0);
    // 1° of latitude ≈ 111.2 km; the hole's edge is 1° from its centre.
    expect(distanceToTerritoryKm([5, 5], [geometry])).toBeCloseTo(111.2, 0);
    expect(distanceToTerritoryKm([5, 10.2], [geometry])).toBeCloseTo(22.2, 0);
  });

  it('measures across the antimeridian', () => {
    const geometry = { type: 'Polygon', coordinates: [box(170, -10, 180, 10)] };
    expect(distanceToTerritoryKm([-179.9, 0], [geometry])).toBeCloseTo(11.1, 0);
  });
});

describe('capital points', () => {
  const split = {
    index: {
      territories: [
        { id: 0, NAME: 'Ottoman Empire' },
        { id: 1, NAME: 'Coree' },
      ],
    },
    polygons: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 0,
          properties: { c: 1 },
          geometry: { type: 'Polygon', coordinates: [box(26, 36, 45, 45)] },
        },
        {
          type: 'Feature',
          id: 1,
          properties: { c: 2 },
          geometry: { type: 'Polygon', coordinates: [box(125, 34, 130, 43)] },
        },
        {
          type: 'Feature',
          properties: { c: 3 },
          geometry: { type: 'Polygon', coordinates: [box(0, 0, 1, 1)] },
        },
      ],
    },
  };
  const context = (places: Record<string, unknown>) => ({ year: 1492, places });
  const capital = (qid: string, label: string | null = 'Constantinople') => ({
    qid,
    label,
    start: 1453,
  });

  it('publishes a capital inside its territory as {name, t, qid}', () => {
    const { collection, rejected } = buildCapitalsYear(
      1492,
      context({
        'Ottoman Empire': { qid: 'Q12560', capital: [capital('Q16869')] },
      }),
      split,
      {
        Q16869: {
          label: 'Istanbul',
          coordinates: [28.97836, 41.00824],
          coordinateRevision: 1,
        },
      },
    );
    expect(rejected).toEqual([]);
    expect(collection.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [28.97836, 41.00824] },
        properties: { name: 'Constantinople', t: 0, qid: 'Q16869' },
      },
    ]);
  });

  it(`accepts a capital within ${MAX_DISTANCE_KM} km of the border and rejects one farther out`, () => {
    const near = [25.7, 40]; // ≈ 26 km west of the border at 26° E
    const far = [24, 40]; // ≈ 170 km west
    const run = (coordinates: number[]) =>
      buildCapitalsYear(
        1492,
        context({
          'Ottoman Empire': { qid: 'Q12560', capital: [capital('Q16869')] },
        }),
        split,
        { Q16869: { label: 'X', coordinates, coordinateRevision: 1 } },
      );
    expect(run(near).collection.features).toHaveLength(1);
    const outside = run(far);
    expect(outside.collection.features).toEqual([]);
    expect(outside.rejected).toEqual([
      {
        year: 1492,
        name: 'Ottoman Empire',
        qid: 'Q16869',
        label: 'Constantinople',
        reason: 'outside territory',
        distanceKm: 170,
      },
    ]);
  });

  it('records why a capital could not be placed', () => {
    const { collection, rejected } = buildCapitalsYear(
      1492,
      context({
        'Ottoman Empire': {
          qid: 'Q12560',
          capital: [
            capital('Q1'),
            capital('Q2'),
            capital('Q3'),
            capital('Q4', null),
          ],
        },
        Atlantis: { qid: 'Q5', capital: [capital('Q6')] },
        Coree: { qid: 'Q7', headOfState: [] },
      }),
      split,
      {
        Q1: { label: 'A' },
        Q2: { label: 'B', coordinateIssue: 'ambiguous', coordinateRevision: 1 },
        Q3: { label: 'C', coordinateIssue: 'missing', coordinateRevision: 1 },
        Q4: { label: 'D', coordinates: [30, 40], coordinateRevision: 1 },
      },
    );
    expect(collection.features).toEqual([]);
    expect(rejected.map((entry: { reason: string }) => entry.reason)).toEqual([
      'territory not in the split index',
      'coordinates not fetched',
      'coordinates ambiguous',
      'coordinates missing',
      'capital has no label',
    ]);
  });

  it('publishes a capital once even if a context lists it twice', () => {
    const { collection } = buildCapitalsYear(
      1492,
      context({
        'Ottoman Empire': {
          qid: 'Q12560',
          capital: [capital('Q16869'), capital('Q16869')],
        },
      }),
      split,
      { Q16869: { label: 'X', coordinates: [29, 41], coordinateRevision: 1 } },
    );
    expect(collection.features).toHaveLength(1);
  });

  it('builds content-hashed files and a review manifest deterministically', () => {
    const contextJson = `${JSON.stringify(context({ 'Ottoman Empire': { qid: 'Q12560', capital: [capital('Q16869')] } }))}\n`;
    const snapshot = {
      retrievedAt: '2026-11-17T00:00:00Z',
      referenced: {
        Q16869: { label: 'X', coordinates: [29, 41], coordinateRevision: 1 },
      },
    };
    const build = () =>
      buildCapitalFiles(
        [{ year: 1492, json: contextJson }],
        new Map([[1492, split]]),
        snapshot,
      );
    const result = build();
    expect(result.files[0].name).toMatch(
      /^1492\.capitals\.[a-f0-9]{16}\.json$/,
    );
    expect(result.manifest.years['1492']).toMatchObject({
      url: `/data/context/${result.files[0].name}`,
      capitals: 1,
      rejected: 0,
    });
    expect(result.manifest.maxDistanceKm).toBe(MAX_DISTANCE_KM);
    expect(build().manifestJson).toBe(result.manifestJson);
    expect(() =>
      buildCapitalFiles(
        [{ year: 1500, json: contextJson }],
        new Map(),
        snapshot,
      ),
    ).toThrow(/no split files/);
  });

  it.each([
    [
      'an unknown territory id',
      { name: 'X', t: 9, qid: 'Q1' },
      /unknown territory/,
    ],
    ['a blank name', { name: ' ', t: 0, qid: 'Q1' }, /blank name/],
    ['an invalid QID', { name: 'X', t: 0, qid: 'P1' }, /invalid QID/],
    [
      'extra properties',
      { name: 'X', t: 0, qid: 'Q1', label: 'X' },
      /unexpected/,
    ],
  ])('rejects a capital file with %s', (_, properties, message) => {
    expect(() =>
      validateCapitalsYear(
        1492,
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [29, 41] },
              properties,
            },
          ],
        },
        split.index,
      ),
    ).toThrow(message);
  });

  it('collects capital ids from every snapshot entity', () => {
    const snapshot = {
      entities: {
        Q1: {
          claims: {
            P36: [
              {
                rank: 'normal',
                mainsnak: {
                  snaktype: 'value',
                  property: 'P36',
                  datavalue: { value: { id: 'Q20' } },
                },
              },
            ],
          },
        },
        Q2: {
          claims: {
            P36: [
              {
                rank: 'normal',
                mainsnak: {
                  snaktype: 'value',
                  property: 'P36',
                  datavalue: { value: { id: 'Q3' } },
                },
              },
            ],
          },
        },
      },
    };
    expect(capitalIds(snapshot, itemValues, PROPERTY.capital)).toEqual([
      'Q3',
      'Q20',
    ]);
  });
});

describe('snapshot coordinate fields', () => {
  const mapping = { entities: {} };
  const snapshot = (entry: Record<string, unknown>) => ({
    schemaVersion: 1,
    retrievedAt: '2026-11-17T00:00:00Z',
    entities: {},
    referenced: { Q1: { label: 'Town', ...entry } },
  });

  it('accepts a point or an issue with a pinned revision', () => {
    expect(() => validateSnapshot(snapshot({}), mapping)).not.toThrow();
    expect(() =>
      validateSnapshot(
        snapshot({ coordinates: [1.5, 2.25], coordinateRevision: 3 }),
        mapping,
      ),
    ).not.toThrow();
    expect(() =>
      validateSnapshot(
        snapshot({ coordinateIssue: 'missing', coordinateRevision: 3 }),
        mapping,
      ),
    ).not.toThrow();
  });

  it.each([
    [
      'both a point and an issue',
      {
        coordinates: [1, 2],
        coordinateIssue: 'missing',
        coordinateRevision: 3,
      },
    ],
    ['no revision', { coordinates: [1, 2] }],
    ['an unknown issue', { coordinateIssue: 'far', coordinateRevision: 3 }],
    [
      'unrounded coordinates',
      { coordinates: [1.123456, 2], coordinateRevision: 3 },
    ],
    [
      'out-of-range coordinates',
      { coordinates: [200, 2], coordinateRevision: 3 },
    ],
    ['a stray revision', { coordinateRevision: 3 }],
  ])('rejects %s', (_, entry) => {
    expect(() => validateSnapshot(snapshot(entry), mapping)).toThrow(
      /facts snapshot reference Q1/,
    );
  });
});
